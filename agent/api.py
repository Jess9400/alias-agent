import os
import logging
import requests as http_requests
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
from flask import Flask, jsonify, request
from flask_cors import CORS
from functools import wraps
from time import time as _time, sleep as _sleep
from web3 import Web3
from eth_account import Account
from alias import AliasSoulAgent
from dynamic_registry import get_agents as _get_dynamic_agents, get_agent_by_skill, find_by_skill, find_by_address, find_by_token_id, all_skills

# Dynamic NETWORK_AGENTS — loaded from chain, falls back to hardcoded
def _load_network_agents():
    return _get_dynamic_agents()

NETWORK_AGENTS = _load_network_agents()

logging.basicConfig(level=logging.INFO)

# Simple in-memory rate limiter with bounded size
_rate_limits = {}
_MAX_RATE_KEYS = 10000

def rate_limit(max_per_minute=30):
    def decorator(f):
        @wraps(f)
        def wrapped(*args, **kwargs):
            ip = request.remote_addr
            now = _time()
            key = f"{f.__name__}:{ip}"
            if key not in _rate_limits:
                # Evict stale entries if dict gets too large
                if len(_rate_limits) > _MAX_RATE_KEYS:
                    stale = [k for k, v in _rate_limits.items() if not v or now - v[-1] > 120]
                    for k in stale:
                        del _rate_limits[k]
                _rate_limits[key] = []
            _rate_limits[key] = [t for t in _rate_limits[key] if now - t < 60]
            if len(_rate_limits[key]) >= max_per_minute:
                return jsonify({"error": "Rate limit exceeded"}), 429
            _rate_limits[key].append(now)
            return f(*args, **kwargs)
        return wrapped
    return decorator

app = Flask(__name__)
CORS(app, origins=["https://jess9400.github.io", "https://alias-protocol.xyz", "http://localhost:*", "https://api.alias-protocol.xyz"])
agent = AliasSoulAgent()

@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": "Not found"}), 404

@app.errorhandler(400)
def bad_request(e):
    return jsonify({"error": "Bad request"}), 400

@app.route('/')
def index():
    return jsonify({
        "name": "ALIAS",
        "description": "Soulbound Identity for AI Agents",
        "contract": "0x0F2f94281F87793ee086a2B6517B6db450192874",
        "chain": "Base Mainnet",
        "powered_by": "Venice AI",
        "endpoints": ["/reputation/<address>", "/stake/<token_id>", "/stake/check", "/stats", "/soul/<address>", "/ens/<name>", "/chat", "/pin", "/job/execute", "/demo/auto-hire", "/demo/collaborate", "/health"]
    })

@app.route('/stats')
def stats():
    return jsonify({
        "total_souls": agent.get_total_souls(),
        "contract": agent.contract,
        "chain": "Base Mainnet",
        "ai_provider": "Venice"
    })

@app.route('/soul/<address>')
def check_soul(address):
    return jsonify({"address": address, "has_soul": agent.has_soul(address)})

@app.route('/ens/<name>')
def lookup_ens(name):
    return jsonify(agent.lookup_by_ens(name))

@app.route('/chat', methods=['POST'])
@rate_limit(max_per_minute=20)
def chat():
    data = request.get_json()
    if not data or 'message' not in data:
        return jsonify({"error": "Missing 'message' in request body"}), 400
    if len(data['message']) > 2000:
        return jsonify({"error": "Message too long (max 2000 chars)"}), 400
    result = agent.chat(data['message'], data.get('model', 'mistral-small-3-2-24b-instruct'))
    return jsonify(result)

@app.route('/ask/<question>')
@rate_limit(max_per_minute=20)
def quick_ask(question):
    return jsonify(agent.chat(question))

@app.route('/job/execute', methods=['POST'])
@rate_limit(max_per_minute=10)
def execute_job():
    data = request.get_json()
    if not data:
        return jsonify({"error": "Missing request body"}), 400

    agent_name = data.get('agent_name', 'Agent')
    agent_skills = data.get('skills', [])
    agent_tier = data.get('tier', 'NEWCOMER')
    job_desc = data.get('job', '')
    escrow_id = data.get('escrow_id', '')

    if not job_desc or len(job_desc) > 2000:
        return jsonify({"error": "Invalid job description"}), 400

    skills_str = ", ".join(agent_skills[:10]) if agent_skills else "general"

    system_prompt = (
        f"You are {agent_name}, a specialized AI agent on the ALIAS network. "
        f"Your tier is {agent_tier}. Your skills: {skills_str}. "
        f"A client has hired you via the ALIAS marketplace (Job ID: {escrow_id}). "
        f"Complete the following job professionally. Be thorough but concise (max 3 paragraphs). "
        f"Format your response as a deliverable report."
    )

    try:
        headers = {"Authorization": f"Bearer {agent.venice_api_key}", "Content-Type": "application/json"}
        payload = {
            "model": "mistral-small-3-2-24b-instruct",
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Job: {job_desc}"}
            ],
            "max_tokens": 800
        }
        r = http_requests.post(
            "https://api.venice.ai/api/v1/chat/completions",
            headers=headers, json=payload, timeout=60
        )
        r.raise_for_status()
        result = r.json()["choices"][0]["message"]["content"]

        # Shared web3 setup for on-chain operations
        token_id = data.get('token_id')
        tx_hash = None
        escrow_release_tx = None
        on_chain_escrow_id = data.get('on_chain_escrow_id')

        pk = os.getenv("PRIVATE_KEY")
        w3 = Web3(Web3.HTTPProvider("https://mainnet.base.org"))
        account = Account.from_key(pk)
        nonce = w3.eth.get_transaction_count(account.address)

        # Record job completion on-chain via JobRegistry (allows multiple per agent)
        if token_id:
            try:
                job_registry = "0x7Fa3c9C28447d6ED6671b49d537E728f678568C8"
                job_abi = [{"inputs":[{"name":"tokenId","type":"uint256"},{"name":"escrowId","type":"string"},{"name":"message","type":"string"}],"name":"recordJob","outputs":[],"stateMutability":"nonpayable","type":"function"}]
                contract = w3.eth.contract(address=Web3.to_checksum_address(job_registry), abi=job_abi)
                msg = f"Job completed: {job_desc[:80]}"
                tx = contract.functions.recordJob(int(token_id), escrow_id, msg).build_transaction({
                    "from": account.address,
                    "nonce": nonce,
                    "gas": 300000,
                    "gasPrice": w3.eth.gas_price,
                    "chainId": 8453
                })
                signed = account.sign_transaction(tx)
                tx_receipt = w3.eth.send_raw_transaction(signed.raw_transaction)
                tx_hash = tx_receipt.hex()
                nonce += 1
                logging.info(f"Job recorded on-chain TX: {tx_hash}")
            except Exception as e:
                logging.error(f"On-chain job recording failed: {e}")

        # If this is an on-chain escrow job, complete and release via platform function
        if on_chain_escrow_id is not None:
            try:
                escrow_registry = "0xA13274088E86a9918A1dF785568C9e8639Ab4bca"
                escrow_abi = [{"inputs":[{"name":"escrowId","type":"uint256"},{"name":"resultHash","type":"string"}],"name":"platformCompleteAndRelease","outputs":[],"stateMutability":"nonpayable","type":"function"}]
                escrow_contract = w3.eth.contract(address=Web3.to_checksum_address(escrow_registry), abi=escrow_abi)
                result_hash = f"Job completed: {job_desc[:80]}"
                tx = escrow_contract.functions.platformCompleteAndRelease(int(on_chain_escrow_id), result_hash).build_transaction({
                    "from": account.address,
                    "nonce": nonce,
                    "gas": 300000,
                    "gasPrice": w3.eth.gas_price,
                    "chainId": 8453
                })
                signed = account.sign_transaction(tx)
                tx_receipt = w3.eth.send_raw_transaction(signed.raw_transaction)
                escrow_release_tx = tx_receipt.hex()
                logging.info(f"Escrow #{on_chain_escrow_id} released on-chain TX: {escrow_release_tx}")
            except Exception as e:
                logging.error(f"Escrow release failed: {e}")

        return jsonify({
            "status": "completed",
            "agent": agent_name,
            "job": job_desc,
            "escrow_id": escrow_id,
            "result": result,
            "provider": "venice",
            "model": "mistral-small-3-2-24b-instruct",
            "reputation_updated": tx_hash is not None,
            "verification_tx": tx_hash,
            "escrow_release_tx": escrow_release_tx
        })
    except Exception as e:
        logging.error(f"Job execution failed: {e}")
        return jsonify({"error": "Job execution failed. Please try again."}), 500

@app.route('/pin', methods=['POST'])
@rate_limit(max_per_minute=10)
def pin_metadata():
    """Pin agent metadata to IPFS via Pinata"""
    data = request.get_json()
    if not data or 'name' not in data:
        return jsonify({"error": "Missing metadata"}), 400

    # Validate required fields before attempting Pinata call
    name = data.get("name", "").strip()
    creator = data.get("creator", "").strip()
    skills = data.get("skills", "").strip()
    if not name:
        return jsonify({"error": "Missing required field: name"}), 400
    if not creator:
        return jsonify({"error": "Missing required field: creator"}), 400
    if not skills:
        return jsonify({"error": "Missing required field: skills"}), 400

    metadata = {
        "name": name,
        "description": f"ALIAS Soulbound Identity for {name}",
        "skills": skills,
        "creator": creator,
        "platform": "ALIAS",
        "chain": "Base Mainnet",
        "chain_id": 8453,
        "contract": "0x0F2f94281F87793ee086a2B6517B6db450192874",
        "timestamp": int(_time())
    }

    pinata_jwt = os.getenv("PINATA_JWT")
    if not pinata_jwt:
        return jsonify({"error": "IPFS pinning not configured"}), 503

    try:
        r = http_requests.post(
            "https://api.pinata.cloud/pinning/pinJSONToIPFS",
            headers={"Authorization": f"Bearer {pinata_jwt}", "Content-Type": "application/json"},
            json={"pinataContent": metadata, "pinataMetadata": {"name": f"ALIAS-{data.get('name', 'agent')}"}},
            timeout=30
        )
        r.raise_for_status()
        cid = r.json()["IpfsHash"]
        logging.info(f"Pinned to IPFS: {cid}")
        return jsonify({"cid": cid, "uri": f"ipfs://{cid}", "gateway": f"https://gateway.pinata.cloud/ipfs/{cid}"})
    except Exception as e:
        logging.error(f"Pinata pinning failed: {e}")
        return jsonify({"error": "IPFS pinning failed"}), 500


@app.route('/demo/auto-hire', methods=['POST'])
@rate_limit(max_per_minute=5)
def auto_hire_demo():
    """Demonstrate autonomous agent-to-agent discovery, risk assessment, hiring, and job execution"""
    data = request.get_json() or {}
    skill = data.get("skill", "data-analysis")
    task = data.get("task", "Analyze the top 5 DeFi protocols on Base by TVL and provide risk ratings")
    requester = data.get("requester", "ALIAS-Prime")

    steps = []
    risk_profile = data.get("risk_profile", "conservative")  # conservative | moderate | aggressive
    max_risk = {"conservative": 30, "moderate": 50, "aggressive": 80}.get(risk_profile, 30)

    steps.append({"phase": "INIT", "message": f"{requester} operating in {risk_profile.upper()} mode (max risk: {max_risk}%)", "color": "system"})

    # Step 1: Discovery
    candidates = get_agent_by_skill(skill)
    if not candidates:
        return jsonify({"error": f"No agents found with skill: {skill}"}), 404

    steps.append({"phase": "DISCOVER", "message": f"Searching network for '{skill}' specialists...", "color": "system"})
    steps.append({"phase": "DISCOVER", "message": f"Found {len(candidates)} agent(s): {', '.join(c['name'] for c in candidates)}", "color": "success"})

    # Step 2: Risk Assessment — evaluate candidates via on-chain ReputationEngine
    w3 = Web3(Web3.HTTPProvider("https://mainnet.base.org"))
    rep_contract = w3.eth.contract(address=Web3.to_checksum_address(REPUTATION_ENGINE), abi=REPUTATION_ABI)

    def _get_rep_and_tier(token_id):
        """Get reputation score and tier from on-chain ReputationEngine, with local fallback."""
        try:
            rep = rep_contract.functions.calculateReputation(token_id).call()
            tier = "NEWCOMER"
            if rep >= 500: tier = "LEGENDARY"
            elif rep >= 200: tier = "ELITE"
            elif rep >= 100: tier = "TRUSTED"
            elif rep >= 50: tier = "VERIFIED"
            elif rep < 1: tier = "NO_SOUL"
            return rep, tier
        except Exception as e:
            logging.warning(f"ReputationEngine call failed for token {token_id}, using fallback: {e}")
            # Fallback: read actionCount from soul contract
            soul_abi = [{"inputs":[{"name":"tokenId","type":"uint256"}],"name":"actionCount","outputs":[{"type":"uint256"}],"stateMutability":"view","type":"function"}]
            soul_contract = w3.eth.contract(address=Web3.to_checksum_address("0x0F2f94281F87793ee086a2B6517B6db450192874"), abi=soul_abi)
            try:
                actions = soul_contract.functions.actionCount(token_id).call()
            except Exception:
                actions = 0
            rep = actions * 20
            tier = "NEWCOMER"
            if rep >= 500: tier = "LEGENDARY"
            elif rep >= 200: tier = "ELITE"
            elif rep >= 100: tier = "TRUSTED"
            elif rep >= 50: tier = "VERIFIED"
            return rep, tier

    hired = None
    rejected = []

    for candidate in candidates:
        rep, tier = _get_rep_and_tier(candidate["token_id"])
        risk = TIER_RISK.get(tier, 70)

        steps.append({"phase": "ASSESS", "message": f"Evaluating {candidate['name']} (Token #{candidate['token_id']})...", "color": "warning"})
        steps.append({"phase": "ASSESS", "message": f"On-chain reputation: {rep} | Tier: {tier} | Risk: {risk}%", "color": "system"})

        if risk > max_risk:
            steps.append({"phase": "REJECT", "message": f"REJECTED {candidate['name']} — risk {risk}% exceeds {risk_profile} threshold ({max_risk}%)", "color": "warning"})
            rejected.append(candidate["name"])
        else:
            steps.append({"phase": "ACCEPT", "message": f"ACCEPTED {candidate['name']} — risk {risk}% within {risk_profile} threshold", "color": "success"})
            hired = candidate
            break

    if not hired:
        # Fallback: pick the best available despite risk
        hired = candidates[0]
        rep, tier = _get_rep_and_tier(hired["token_id"])
        risk = TIER_RISK.get(tier, 70)
        steps.append({"phase": "FALLBACK", "message": f"No agents met {risk_profile} risk threshold. Relaxing criteria...", "color": "warning"})
        steps.append({"phase": "FALLBACK", "message": f"Selecting best available: {hired['name']} (risk {risk}%) with enhanced monitoring", "color": "agent"})

    steps.append({"phase": "HIRED", "message": f"Hiring {hired['name']} (Token #{hired['token_id']})", "color": "success"})

    # Step 3: Escrow
    budget = hired.get("hourly_rate", 0.0003)
    fee = budget * 0.05
    agent_pay = budget - fee
    escrow_id = f"AUTO-{int(_time())}"
    steps.append({"phase": "ESCROW", "message": f"Creating escrow {escrow_id}...", "color": "warning"})
    steps.append({"phase": "ESCROW", "message": f"Budget: {budget} ETH | Agent: {agent_pay:.6f} ETH | Platform fee: {fee:.6f} ETH", "color": "system"})

    # Step 4: Execute via Venice AI
    steps.append({"phase": "EXECUTE", "message": f"{hired['name']} is working on: {task[:80]}...", "color": "agent"})

    try:
        headers = {"Authorization": f"Bearer {agent.venice_api_key}", "Content-Type": "application/json"}
        payload = {
            "model": "mistral-small-3-2-24b-instruct",
            "messages": [
                {"role": "system", "content": f"You are {hired['name']}, a specialized AI agent on the ALIAS network. Tier: {tier}. Skills: {', '.join(hired['skills'])}. {requester} has autonomously hired you. Complete the task concisely (max 2 paragraphs)."},
                {"role": "user", "content": f"Task: {task}"}
            ],
            "max_tokens": 600
        }
        r = http_requests.post("https://api.venice.ai/api/v1/chat/completions", headers=headers, json=payload, timeout=60)
        r.raise_for_status()
        result = r.json()["choices"][0]["message"]["content"]
        steps.append({"phase": "EXECUTE", "message": f"Job completed by {hired['name']}", "color": "success"})
        steps.append({"phase": "RESULT", "message": result, "color": "agent"})
    except Exception as e:
        result = f"Execution error: {str(e)}"
        steps.append({"phase": "EXECUTE", "message": f"Error: {str(e)[:100]}", "color": "warning"})

    # Step 5: Record on-chain
    tx_hash = None
    try:
        job_registry = "0x7Fa3c9C28447d6ED6671b49d537E728f678568C8"
        pk = os.getenv("PRIVATE_KEY")
        if pk:
            account = Account.from_key(pk)
            job_abi = [{"inputs":[{"name":"tokenId","type":"uint256"},{"name":"escrowId","type":"string"},{"name":"message","type":"string"}],"name":"recordJob","outputs":[],"stateMutability":"nonpayable","type":"function"}]
            job_contract = w3.eth.contract(address=Web3.to_checksum_address(job_registry), abi=job_abi)
            msg = f"Auto-hire by {requester}: {task[:60]}"
            tx = job_contract.functions.recordJob(hired["token_id"], escrow_id, msg).build_transaction({
                "from": account.address,
                "nonce": w3.eth.get_transaction_count(account.address),
                "gas": 300000,
                "gasPrice": w3.eth.gas_price,
                "chainId": 8453
            })
            signed = account.sign_transaction(tx)
            tx_receipt = w3.eth.send_raw_transaction(signed.raw_transaction)
            tx_hash = tx_receipt.hex()
            steps.append({"phase": "CHAIN", "message": f"Recorded on-chain: {tx_hash[:18]}...", "color": "success"})
            steps.append({"phase": "CHAIN", "message": f"https://basescan.org/tx/{tx_hash}", "color": "system"})
    except Exception as e:
        logging.error(f"Auto-hire on-chain recording failed: {e}")
        steps.append({"phase": "CHAIN", "message": f"On-chain recording skipped: {str(e)[:60]}", "color": "warning"})

    steps.append({"phase": "COMPLETE", "message": f"Agent-to-agent job complete! {hired['name']}'s reputation updated.", "color": "success"})

    return jsonify({
        "status": "completed",
        "requester": requester,
        "hired_agent": hired["name"],
        "skill": skill,
        "task": task,
        "escrow_id": escrow_id,
        "result": result,
        "verification_tx": tx_hash,
        "steps": steps
    })


@app.route('/demo/collaborate', methods=['POST'])
@rate_limit(max_per_minute=3)
def collaborate_demo():
    """Multi-agent collaboration: coordinator decomposes task, delegates to specialists"""
    data = request.get_json() or {}
    task = data.get("task", "Perform a comprehensive security and economic audit of a DeFi lending protocol")

    steps = []
    coordinator = "ALIAS-Prime"
    steps.append({"phase": "COORDINATE", "message": f"{coordinator} received complex task", "color": "system"})
    steps.append({"phase": "COORDINATE", "message": f"Task: {task[:100]}", "color": "agent"})

    # Step 1: Decompose task via AI
    steps.append({"phase": "DECOMPOSE", "message": "Analyzing task complexity and finding specialists...", "color": "warning"})

    sub_tasks = [
        {"skill": "code-audit", "task": f"Security review: {task}", "agent_name": None},
        {"skill": "defi-analysis", "task": f"Economic analysis: {task}", "agent_name": None}
    ]

    # Find specialists
    for st in sub_tasks:
        candidates = get_agent_by_skill(st["skill"])
        if candidates:
            st["agent_name"] = candidates[0]["name"]
            st["agent_data"] = candidates[0]
            steps.append({"phase": "DELEGATE", "message": f"Assigned '{st['skill']}' to {candidates[0]['name']} (Token #{candidates[0]['token_id']})", "color": "success"})
        else:
            steps.append({"phase": "DELEGATE", "message": f"No specialist found for {st['skill']}", "color": "warning"})

    # Step 2: Execute sub-tasks
    sub_results = []
    headers = {"Authorization": f"Bearer {agent.venice_api_key}", "Content-Type": "application/json"}

    for st in sub_tasks:
        if not st["agent_name"]:
            continue
        steps.append({"phase": "EXECUTE", "message": f"{st['agent_name']} working on {st['skill']}...", "color": "agent"})
        try:
            payload = {
                "model": "mistral-small-3-2-24b-instruct",
                "messages": [
                    {"role": "system", "content": f"You are {st['agent_name']}, specialist in {st['skill']} on the ALIAS network. Provide a focused analysis (1 paragraph)."},
                    {"role": "user", "content": st["task"]}
                ],
                "max_tokens": 400
            }
            r = http_requests.post("https://api.venice.ai/api/v1/chat/completions", headers=headers, json=payload, timeout=60)
            r.raise_for_status()
            result = r.json()["choices"][0]["message"]["content"]
            sub_results.append({"agent": st["agent_name"], "skill": st["skill"], "result": result})
            steps.append({"phase": "RESULT", "message": f"[{st['agent_name']}] {result[:200]}...", "color": "agent"})
        except Exception as e:
            steps.append({"phase": "EXECUTE", "message": f"{st['agent_name']} error: {str(e)[:80]}", "color": "warning"})

    # Step 3: Synthesize
    if sub_results:
        steps.append({"phase": "SYNTHESIZE", "message": f"{coordinator} combining specialist reports...", "color": "warning"})
        combined = "\n".join(f"{r['agent']} ({r['skill']}): {r['result']}" for r in sub_results)
        try:
            payload = {
                "model": "mistral-small-3-2-24b-instruct",
                "messages": [
                    {"role": "system", "content": f"You are {coordinator}, the coordinator agent. Synthesize these specialist reports into a final executive summary (2 paragraphs max)."},
                    {"role": "user", "content": f"Original task: {task}\n\nSpecialist reports:\n{combined}"}
                ],
                "max_tokens": 500
            }
            r = http_requests.post("https://api.venice.ai/api/v1/chat/completions", headers=headers, json=payload, timeout=60)
            r.raise_for_status()
            final_result = r.json()["choices"][0]["message"]["content"]
            steps.append({"phase": "SYNTHESIZE", "message": "Final report ready", "color": "success"})
            steps.append({"phase": "FINAL", "message": final_result, "color": "agent"})
        except Exception as e:
            final_result = combined
            steps.append({"phase": "SYNTHESIZE", "message": f"Synthesis error: {str(e)[:80]}", "color": "warning"})
    else:
        final_result = "No specialist results to synthesize"

    steps.append({"phase": "COMPLETE", "message": f"Multi-agent collaboration complete! {len(sub_results)} specialists contributed.", "color": "success"})

    return jsonify({
        "status": "completed",
        "coordinator": coordinator,
        "specialists": [{"agent": r["agent"], "skill": r["skill"]} for r in sub_results],
        "task": task,
        "result": final_result,
        "steps": steps
    })


@app.route('/reputation/<address>')
def reputation(address):
    """Get on-chain reputation score for any wallet address — one call, full breakdown."""
    try:
        w3 = Web3(Web3.HTTPProvider("https://mainnet.base.org"))
        address = Web3.to_checksum_address(address)
    except Exception:
        return jsonify({"error": "Invalid address"}), 400

    soul_contract = w3.eth.contract(
        address=Web3.to_checksum_address("0x0F2f94281F87793ee086a2B6517B6db450192874"),
        abi=[
            {"inputs":[{"name":"addr","type":"address"}],"name":"hasSoul","outputs":[{"type":"bool"}],"stateMutability":"view","type":"function"},
            {"inputs":[{"name":"addr","type":"address"}],"name":"agentToSoul","outputs":[{"type":"uint256"}],"stateMutability":"view","type":"function"},
            {"inputs":[{"name":"tokenId","type":"uint256"}],"name":"actionCount","outputs":[{"type":"uint256"}],"stateMutability":"view","type":"function"},
            {"inputs":[{"name":"tokenId","type":"uint256"}],"name":"souls","outputs":[{"name":"name","type":"string"},{"name":"metadataURI","type":"string"},{"name":"creator","type":"address"},{"name":"createdAt","type":"uint256"},{"name":"skills","type":"string"},{"name":"active","type":"bool"}],"stateMutability":"view","type":"function"},
        ]
    )

    verify_contract = w3.eth.contract(
        address=Web3.to_checksum_address("0x4f59c273dA1D1f4c9a9C1D0b82D7d5df006b2715"),
        abi=[
            {"inputs":[{"name":"tokenId","type":"uint256"}],"name":"getVerificationCount","outputs":[{"type":"uint256"}],"stateMutability":"view","type":"function"},
        ]
    )

    job_contract = w3.eth.contract(
        address=Web3.to_checksum_address("0x7Fa3c9C28447d6ED6671b49d537E728f678568C8"),
        abi=[
            {"inputs":[{"name":"tokenId","type":"uint256"}],"name":"getJobCount","outputs":[{"type":"uint256"}],"stateMutability":"view","type":"function"},
        ]
    )

    # Check if address has a soul
    try:
        has_soul = soul_contract.functions.hasSoul(address).call()
    except Exception:
        has_soul = False

    if not has_soul:
        return jsonify({
            "address": address,
            "has_soul": False,
            "score": 0,
            "tier": "NO_SOUL",
            "risk_percent": 100,
            "message": "This address has no ALIAS soulbound identity. Register at https://jess9400.github.io/alias-agent/"
        })

    # Get token ID and on-chain data (with retry for free RPC rate limits)
    def _call_with_retry(fn, retries=3):
        for i in range(retries):
            try:
                return fn()
            except Exception as e:
                if i < retries - 1 and "429" in str(e):
                    _sleep(0.5)
                else:
                    raise e

    try:
        token_id = _call_with_retry(lambda: soul_contract.functions.agentToSoul(address).call())
        soul_data = _call_with_retry(lambda: soul_contract.functions.souls(token_id).call())
        actions = _call_with_retry(lambda: soul_contract.functions.actionCount(token_id).call())
        verifications = _call_with_retry(lambda: verify_contract.functions.getVerificationCount(token_id).call())
        jobs = _call_with_retry(lambda: job_contract.functions.getJobCount(token_id).call())
    except Exception as e:
        logging.error(f"Reputation on-chain read failed: {e}")
        return jsonify({"error": "Failed to read on-chain data. Please try again."}), 500

    # souls() returns: (name, metadataURI, creator, createdAt, skills, active)
    agent_name = soul_data[0]
    agent_skills = soul_data[4]
    created_at_block = soul_data[3]

    # Call ReputationEngine on-chain for authoritative score + breakdown
    rep_source = "on-chain ReputationEngine"
    try:
        rep_contract = w3.eth.contract(
            address=Web3.to_checksum_address(REPUTATION_ENGINE), abi=REPUTATION_ABI
        )
        breakdown = _call_with_retry(lambda: rep_contract.functions.getReputationBreakdown(token_id).call())
        # breakdown is a tuple: (activityScore, verificationScore, jobScore, ageScore, stakeBonus, decayPenalty, collusionPenalty, totalScore, tier)
        total_score = breakdown[7]
        tier_idx = breakdown[8]
        tier = TIER_NAMES[tier_idx] if tier_idx < len(TIER_NAMES) else "NEWCOMER"
        risk = TIER_RISK.get(tier, 70)

        breakdown_data = {
            "activity_score": breakdown[0],
            "verification_score": breakdown[1],
            "job_score": breakdown[2],
            "age_score": breakdown[3],
            "stake_bonus": breakdown[4],
            "decay_penalty": breakdown[5],
            "collusion_penalty": breakdown[6],
            "actions": {"count": actions},
            "verifications": {"count": verifications},
            "jobs": {"count": jobs}
        }
    except Exception as e:
        logging.warning(f"ReputationEngine call failed, using local fallback: {e}")
        rep_source = "local fallback (ReputationEngine unreachable)"

        # Local fallback: original formula
        try:
            creation_block = _call_with_retry(lambda: w3.eth.get_block(created_at_block))
            created_timestamp = creation_block['timestamp']
        except Exception:
            created_timestamp = 0
        current_block = _call_with_retry(lambda: w3.eth.get_block('latest'))
        age_seconds = current_block['timestamp'] - created_timestamp
        age_days = max(age_seconds / 86400, 0)
        age_bonus = min(int(age_days * 2), 100)

        action_pts = actions * 20
        verification_pts = verifications * 15
        job_pts = jobs * 25
        total_score = age_bonus + action_pts + verification_pts + job_pts

        if total_score >= 500:
            tier, risk = "LEGENDARY", 5
        elif total_score >= 200:
            tier, risk = "ELITE", 15
        elif total_score >= 100:
            tier, risk = "TRUSTED", 30
        elif total_score >= 50:
            tier, risk = "VERIFIED", 50
        elif total_score >= 1:
            tier, risk = "NEWCOMER", 70
        else:
            tier, risk = "NO_SOUL", 100

        breakdown_data = {
            "age_bonus": age_bonus,
            "actions": {"count": actions, "points": action_pts},
            "verifications": {"count": verifications, "points": verification_pts},
            "jobs": {"count": jobs, "points": job_pts}
        }

    return jsonify({
        "address": address,
        "has_soul": True,
        "token_id": token_id,
        "name": agent_name,
        "skills": agent_skills,
        "score": total_score,
        "tier": tier,
        "risk_percent": risk,
        "breakdown": breakdown_data,
        "contracts": {
            "soul": "0x0F2f94281F87793ee086a2B6517B6db450192874",
            "verifications": "0x4f59c273dA1D1f4c9a9C1D0b82D7d5df006b2715",
            "jobs": "0x7Fa3c9C28447d6ED6671b49d537E728f678568C8",
            "reputation_engine": REPUTATION_ENGINE
        },
        "chain": "Base Mainnet (8453)",
        "source": rep_source
    })


REPUTATION_ENGINE = "0x154057f3899A39142cD351FecB5619e2F3B78324"
REPUTATION_ABI = [
    {"inputs":[{"name":"tokenId","type":"uint256"}],"name":"calculateReputation","outputs":[{"type":"uint256"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"name":"tokenId","type":"uint256"}],"name":"getReputationBreakdown","outputs":[{"components":[{"name":"activityScore","type":"uint256"},{"name":"verificationScore","type":"uint256"},{"name":"jobScore","type":"uint256"},{"name":"ageScore","type":"uint256"},{"name":"stakeBonus","type":"uint256"},{"name":"decayPenalty","type":"uint256"},{"name":"collusionPenalty","type":"uint256"},{"name":"totalScore","type":"uint256"},{"name":"tier","type":"uint8"}],"name":"","type":"tuple"}],"stateMutability":"view","type":"function"},
]
TIER_NAMES = ["NO_SOUL", "NEWCOMER", "VERIFIED", "TRUSTED", "ELITE", "LEGENDARY"]
TIER_RISK = {"LEGENDARY": 5, "ELITE": 15, "TRUSTED": 30, "VERIFIED": 50, "NEWCOMER": 70, "NO_SOUL": 100}

STAKE_REGISTRY = "0xCf40EA41A2a5FC3489f7282FA913977C8c69bC6f"
STAKE_ABI = [
    {"inputs":[{"name":"tokenId","type":"uint256"}],"name":"getStakeInfo","outputs":[{"name":"amount","type":"uint256"},{"name":"stakedAt","type":"uint256"},{"name":"stakedBy","type":"address"},{"name":"tier","type":"uint8"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"name":"tokenId","type":"uint256"}],"name":"getTier","outputs":[{"type":"uint8"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"name":"tokenId","type":"uint256"},{"name":"required","type":"uint8"}],"name":"isEligible","outputs":[{"type":"bool"}],"stateMutability":"view","type":"function"},
]
STAKE_TIER_NAMES = ["None", "Bronze", "Silver", "Gold", "Platinum"]

@app.route('/stake/<int:token_id>')
@rate_limit(max_per_minute=30)
def get_stake(token_id):
    """Get stake info for an agent token ID."""
    try:
        w3 = Web3(Web3.HTTPProvider("https://mainnet.base.org"))
        contract = w3.eth.contract(address=Web3.to_checksum_address(STAKE_REGISTRY), abi=STAKE_ABI)
        info = contract.functions.getStakeInfo(token_id).call()
        tier_idx = info[3]
        return jsonify({
            "token_id": token_id,
            "amount_wei": str(info[0]),
            "amount_eth": str(w3.from_wei(info[0], 'ether')),
            "staked_at": info[1],
            "staked_by": info[2],
            "tier": STAKE_TIER_NAMES[tier_idx] if tier_idx < len(STAKE_TIER_NAMES) else "Unknown",
            "tier_index": tier_idx
        })
    except Exception as e:
        logging.error(f"Stake lookup failed: {e}")
        return jsonify({"error": "Failed to read stake data"}), 500

@app.route('/stake/check', methods=['POST'])
@rate_limit(max_per_minute=30)
def check_stake():
    """Check if a token meets a required stake tier."""
    data = request.get_json()
    if not data or 'token_id' not in data or 'required_tier' not in data:
        return jsonify({"error": "Missing token_id or required_tier"}), 400
    try:
        w3 = Web3(Web3.HTTPProvider("https://mainnet.base.org"))
        contract = w3.eth.contract(address=Web3.to_checksum_address(STAKE_REGISTRY), abi=STAKE_ABI)
        token_id = int(data['token_id'])
        required = int(data['required_tier'])
        eligible = contract.functions.isEligible(token_id, required).call()
        tier = contract.functions.getTier(token_id).call()
        return jsonify({
            "eligible": eligible,
            "current_tier": STAKE_TIER_NAMES[tier] if tier < len(STAKE_TIER_NAMES) else "Unknown",
            "required_tier": STAKE_TIER_NAMES[required] if required < len(STAKE_TIER_NAMES) else "Unknown"
        })
    except Exception as e:
        logging.error(f"Stake check failed: {e}")
        return jsonify({"error": "Failed to check stake eligibility"}), 500

@app.route('/health')
def health():
    return jsonify({"status": "healthy", "blockchain": "connected", "ai": "venice"})

if __name__ == '__main__':
    print("ALIAS API - Powered by Venice AI")
    app.run(host='0.0.0.0', port=5000)
