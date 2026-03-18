#!/usr/bin/env python3
"""
ALIAS API V2 — Production Flask API
=====================================
Modular API with Blueprints, proper error handling,
and integration with new escrow/reputation/autonomous systems.
"""

import logging
import os
import time
from functools import wraps

import requests as http_requests
from dotenv import load_dotenv
from flask import Flask, Blueprint, jsonify, request
from flask_cors import CORS
from web3 import Web3
from eth_account import Account

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")
logger = logging.getLogger("alias.api")

# ======================== CONFIG ========================

CONTRACT = "0x0F2f94281F87793ee086a2B6517B6db450192874"
JOB_REGISTRY = "0x7Fa3c9C28447d6ED6671b49d537E728f678568C8"
VERIFICATION_REGISTRY = "0x4f59c273dA1D1f4c9a9C1D0b82D7d5df006b2715"
RPC_URL = os.getenv("RPC_URL", "https://mainnet.base.org")
VENICE_API_KEY = os.getenv("VENICE_API_KEY", "")
PRIVATE_KEY = os.getenv("PRIVATE_KEY", "")

w3 = Web3(Web3.HTTPProvider(RPC_URL))

# ======================== MIDDLEWARE ========================

_rate_limits = {}

def rate_limit(max_per_minute=30):
    def decorator(f):
        @wraps(f)
        def wrapped(*args, **kwargs):
            ip = request.remote_addr
            now = time.time()
            key = f"{f.__name__}:{ip}"
            if key not in _rate_limits:
                _rate_limits[key] = []
            _rate_limits[key] = [t for t in _rate_limits[key] if now - t < 60]
            if len(_rate_limits[key]) >= max_per_minute:
                return api_error("Rate limit exceeded", 429)
            _rate_limits[key].append(now)
            return f(*args, **kwargs)
        return wrapped
    return decorator


def api_response(data, meta=None):
    """Standard success response."""
    resp = {"success": True, "data": data}
    if meta:
        resp["meta"] = meta
    resp.setdefault("meta", {})["timestamp"] = int(time.time())
    return jsonify(resp)


def api_error(message, status=400):
    """Standard error response."""
    return jsonify({"success": False, "error": message, "meta": {"timestamp": int(time.time())}}), status


# ======================== HELPERS ========================

SOUL_ABI = [
    {"inputs": [{"name": "agent", "type": "address"}], "name": "hasSoul", "outputs": [{"type": "bool"}], "stateMutability": "view", "type": "function"},
    {"inputs": [{"name": "tokenId", "type": "uint256"}], "name": "actionCount", "outputs": [{"type": "uint256"}], "stateMutability": "view", "type": "function"},
    {"inputs": [], "name": "totalSouls", "outputs": [{"type": "uint256"}], "stateMutability": "view", "type": "function"},
    {"inputs": [{"name": "agent", "type": "address"}], "name": "agentToSoul", "outputs": [{"type": "uint256"}], "stateMutability": "view", "type": "function"},
]

JOB_ABI = [
    {"inputs": [{"name": "tokenId", "type": "uint256"}, {"name": "escrowId", "type": "string"}, {"name": "message", "type": "string"}], "name": "recordJob", "outputs": [], "stateMutability": "nonpayable", "type": "function"},
    {"inputs": [{"name": "tokenId", "type": "uint256"}], "name": "getJobCount", "outputs": [{"type": "uint256"}], "stateMutability": "view", "type": "function"},
]

VERIFY_ABI = [
    {"inputs": [{"name": "tokenId", "type": "uint256"}], "name": "getVerificationCount", "outputs": [{"type": "uint256"}], "stateMutability": "view", "type": "function"},
]

soul_contract = w3.eth.contract(address=Web3.to_checksum_address(CONTRACT), abi=SOUL_ABI)
job_contract = w3.eth.contract(address=Web3.to_checksum_address(JOB_REGISTRY), abi=JOB_ABI)
verify_contract = w3.eth.contract(address=Web3.to_checksum_address(VERIFICATION_REGISTRY), abi=VERIFY_ABI)


def venice_chat(system_prompt: str, user_prompt: str, max_tokens: int = 600) -> str:
    """Call Venice AI."""
    if not VENICE_API_KEY:
        return "Venice AI not configured"
    headers = {"Authorization": f"Bearer {VENICE_API_KEY}", "Content-Type": "application/json"}
    payload = {"model": "llama-3.3-70b", "messages": [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ], "max_tokens": max_tokens}
    r = http_requests.post("https://api.venice.ai/api/v1/chat/completions", headers=headers, json=payload, timeout=60)
    r.raise_for_status()
    return r.json()["choices"][0]["message"]["content"]


def record_job_onchain(token_id: int, escrow_id: str, message: str) -> str:
    """Record job completion on-chain. Returns tx hash or empty string."""
    if not PRIVATE_KEY:
        return ""
    try:
        account = Account.from_key(PRIVATE_KEY)
        tx = job_contract.functions.recordJob(token_id, escrow_id, message[:280]).build_transaction({
            "from": account.address,
            "nonce": w3.eth.get_transaction_count(account.address),
            "gas": 300000, "gasPrice": w3.eth.gas_price, "chainId": 8453,
        })
        signed = account.sign_transaction(tx)
        receipt = w3.eth.send_raw_transaction(signed.raw_transaction)
        return receipt.hex()
    except Exception as e:
        logger.error(f"On-chain recording failed: {e}")
        return ""


# ======================== BLUEPRINTS ========================

# --- Agents Blueprint ---
agents_bp = Blueprint("agents", __name__, url_prefix="/api/v2/agents")

@agents_bp.route("", methods=["GET"])
def list_agents():
    """List all agents with on-chain data."""
    from dynamic_registry import get_agents; NETWORK_AGENTS = get_agents()
    agents = []
    for name, data in NETWORK_AGENTS.items():
        try:
            tid = data["token_id"]
            actions = soul_contract.functions.actionCount(tid).call()
            jobs = job_contract.functions.getJobCount(tid).call()
            verifications = verify_contract.functions.getVerificationCount(tid).call()
            rep = actions * 10 + jobs * 25 + verifications * 15
            tier = _tier_name(rep)
        except Exception:
            actions = jobs = verifications = rep = 0
            tier = "UNKNOWN"

        agents.append({
            "name": name, "token_id": data["token_id"], "address": data["address"],
            "skills": data["skills"], "hourly_rate": data["hourly_rate"],
            "actions": actions, "jobs": jobs, "verifications": verifications,
            "reputation": rep, "tier": tier,
        })

    agents.sort(key=lambda a: a["reputation"], reverse=True)
    return api_response(agents)


@agents_bp.route("/<int:token_id>", methods=["GET"])
def agent_profile(token_id):
    """Full agent profile with reputation breakdown."""
    from dynamic_registry import get_agents; NETWORK_AGENTS = get_agents()
    agent_data = None
    for name, data in NETWORK_AGENTS.items():
        if data["token_id"] == token_id:
            agent_data = {"name": name, **data}
            break

    if not agent_data:
        return api_error("Agent not found", 404)

    try:
        actions = soul_contract.functions.actionCount(token_id).call()
        jobs = job_contract.functions.getJobCount(token_id).call()
        verifications = verify_contract.functions.getVerificationCount(token_id).call()
    except Exception:
        actions = jobs = verifications = 0

    rep = actions * 10 + jobs * 25 + verifications * 15
    return api_response({
        **agent_data,
        "reputation": {"total": rep, "tier": _tier_name(rep),
                       "breakdown": {"actions": actions * 10, "jobs": jobs * 25, "verifications": verifications * 15}},
        "activity": {"actions": actions, "jobs": jobs, "verifications": verifications},
    })


@agents_bp.route("/search", methods=["GET"])
def search_agents():
    """Search agents by skill."""
    from dynamic_registry import get_agent_by_skill
    skill = request.args.get("skill", "")
    if not skill:
        return api_error("Missing 'skill' parameter")
    results = get_agent_by_skill(skill)
    return api_response(results)


# --- Jobs Blueprint ---
jobs_bp = Blueprint("jobs", __name__, url_prefix="/api/v2/jobs")

@jobs_bp.route("/execute", methods=["POST"])
@rate_limit(max_per_minute=10)
def execute_job():
    """Execute a job via Venice AI and record on-chain."""
    data = request.get_json()
    if not data or not data.get("job"):
        return api_error("Missing 'job' field")

    agent_name = data.get("agent_name", "Agent")
    skills = data.get("skills", [])
    tier = data.get("tier", "NEWCOMER")
    job_desc = data["job"]
    escrow_id = data.get("escrow_id", f"JOB-{int(time.time())}")
    token_id = data.get("token_id")

    if len(job_desc) > 2000:
        return api_error("Job description too long (max 2000)")

    try:
        system = (f"You are {agent_name}, a {tier} AI agent on ALIAS. "
                  f"Skills: {', '.join(skills[:10]) or 'general'}. "
                  f"Complete the job professionally (max 3 paragraphs).")
        result = venice_chat(system, f"Job: {job_desc}")

        tx_hash = ""
        if token_id:
            tx_hash = record_job_onchain(int(token_id), escrow_id, f"Job completed: {job_desc[:80]}")

        return api_response({
            "status": "completed", "agent": agent_name, "job": job_desc,
            "escrow_id": escrow_id, "result": result, "verification_tx": tx_hash,
        })
    except Exception as e:
        return api_error(str(e), 500)


@jobs_bp.route("/<int:token_id>/history", methods=["GET"])
def job_history(token_id):
    """Get job history for an agent."""
    try:
        count = job_contract.functions.getJobCount(token_id).call()
        return api_response({"token_id": token_id, "job_count": count})
    except Exception as e:
        return api_error(str(e), 500)


@jobs_bp.route("/multi-agent", methods=["POST"])
@rate_limit(max_per_minute=3)
def multi_agent():
    """Multi-agent collaboration."""
    from dynamic_registry import get_agent_by_skill
    data = request.get_json() or {}
    task = data.get("task", "Perform a security and economic audit of a DeFi protocol")
    steps = []

    sub_tasks = [
        {"skill": "code-audit", "focus": "Security review"},
        {"skill": "defi-analysis", "focus": "Economic analysis"},
    ]

    sub_results = []
    for st in sub_tasks:
        candidates = get_agent_by_skill(st["skill"])
        if not candidates:
            steps.append({"phase": "DELEGATE", "message": f"No agent for {st['skill']}", "color": "warning"})
            continue

        agent = candidates[0]
        steps.append({"phase": "DELEGATE", "message": f"Assigned {st['skill']} to {agent['name']}", "color": "success"})

        try:
            result = venice_chat(
                f"You are {agent['name']}, specialist in {st['skill']}. Provide focused analysis (1 paragraph).",
                f"{st['focus']}: {task}")
            sub_results.append({"agent": agent["name"], "skill": st["skill"], "result": result})
            steps.append({"phase": "RESULT", "message": f"[{agent['name']}] {result[:200]}", "color": "agent"})
        except Exception as e:
            steps.append({"phase": "EXECUTE", "message": f"Error: {str(e)[:80]}", "color": "warning"})

    final = ""
    if sub_results:
        combined = "\n".join(f"{r['agent']}: {r['result']}" for r in sub_results)
        final = venice_chat("Synthesize specialist reports into an executive summary (2 paragraphs).",
                           f"Task: {task}\n\nReports:\n{combined}")

    return api_response({
        "coordinator": "ALIAS-Prime", "task": task,
        "specialists": [{"agent": r["agent"], "skill": r["skill"]} for r in sub_results],
        "result": final, "steps": steps,
    })


# --- Reputation Blueprint ---
reputation_bp = Blueprint("reputation", __name__, url_prefix="/api/v2/reputation")

@reputation_bp.route("/<int:token_id>", methods=["GET"])
def get_reputation(token_id):
    """Get reputation score with breakdown."""
    try:
        actions = soul_contract.functions.actionCount(token_id).call()
        jobs = job_contract.functions.getJobCount(token_id).call()
        verifications = verify_contract.functions.getVerificationCount(token_id).call()

        activity_score = min(int(actions ** 0.5 * 20), 200)
        job_score = min(int(jobs ** 0.5 * 25), 250)
        verify_score = min(int(verifications ** 0.5 * 30), 300)

        total = activity_score + job_score + verify_score
        return api_response({
            "token_id": token_id, "total": total, "tier": _tier_name(total),
            "breakdown": {"activity": activity_score, "jobs": job_score, "verifications": verify_score},
            "raw": {"actions": actions, "jobs": jobs, "verifications": verifications},
        })
    except Exception as e:
        return api_error(str(e), 500)


@reputation_bp.route("/leaderboard", methods=["GET"])
def leaderboard():
    """Top agents by reputation."""
    from dynamic_registry import get_agents; NETWORK_AGENTS = get_agents()
    board = []
    for name, data in NETWORK_AGENTS.items():
        try:
            tid = data["token_id"]
            actions = soul_contract.functions.actionCount(tid).call()
            jobs = job_contract.functions.getJobCount(tid).call()
            rep = int(actions ** 0.5 * 20) + int(jobs ** 0.5 * 25)
            board.append({"name": name, "token_id": tid, "reputation": rep, "tier": _tier_name(rep)})
        except Exception:
            continue
    board.sort(key=lambda x: x["reputation"], reverse=True)
    return api_response(board[:20])


# --- Network Blueprint ---
network_bp = Blueprint("network", __name__, url_prefix="/api/v2/network")

@network_bp.route("/stats", methods=["GET"])
def network_stats():
    """Network-wide statistics."""
    try:
        total_souls = soul_contract.functions.totalSouls().call()
        return api_response({
            "total_souls": total_souls, "contract": CONTRACT,
            "chain": "Base Mainnet", "chain_id": 8453, "ai_provider": "Venice",
        })
    except Exception as e:
        return api_error(str(e), 500)


@network_bp.route("/graph", methods=["GET"])
def trust_graph():
    """Trust graph data for visualization."""
    from dynamic_registry import get_agents; NETWORK_AGENTS = get_agents()
    nodes = [{"id": d["token_id"], "name": n, "address": d["address"]} for n, d in NETWORK_AGENTS.items()]
    # Edges would come from VerificationRegistry events in production
    return api_response({"nodes": nodes, "edges": []})


# ======================== LEGACY V1 COMPATIBILITY ========================

legacy_bp = Blueprint("legacy", __name__)

@legacy_bp.route("/")
def index():
    return jsonify({"name": "ALIAS", "version": "2.0", "contract": CONTRACT, "chain": "Base Mainnet"})

@legacy_bp.route("/stats")
def stats():
    try:
        return jsonify({"total_souls": soul_contract.functions.totalSouls().call(), "contract": CONTRACT, "chain": "Base Mainnet", "ai_provider": "Venice"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@legacy_bp.route("/soul/<address>")
def check_soul(address):
    try:
        return jsonify({"address": address, "has_soul": soul_contract.functions.hasSoul(Web3.to_checksum_address(address)).call()})
    except Exception as e:
        return jsonify({"address": address, "has_soul": False, "error": str(e)})

@legacy_bp.route("/chat", methods=["POST"])
@rate_limit(max_per_minute=20)
def chat():
    data = request.get_json()
    if not data or "message" not in data:
        return jsonify({"error": "Missing 'message'"}), 400
    try:
        result = venice_chat("You are ALIAS, an AI agent with Soulbound Token identity on Base.", data["message"])
        return jsonify({"response": result, "model": "llama-3.3-70b", "provider": "venice"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@legacy_bp.route("/health")
def health():
    return jsonify({"status": "healthy", "version": "2.0", "blockchain": "connected", "ai": "venice"})


# ======================== HELPERS ========================

def _tier_name(rep: int) -> str:
    if rep >= 500: return "LEGENDARY"
    if rep >= 200: return "ELITE"
    if rep >= 100: return "TRUSTED"
    if rep >= 50: return "VERIFIED"
    if rep >= 1: return "NEWCOMER"
    return "NO_SOUL"


# ======================== APP FACTORY ========================

def create_app():
    app = Flask(__name__)
    CORS(app, origins=["https://jess9400.github.io", "https://alias-protocol.xyz", "http://localhost:*", "http://127.0.0.1:*"])

    app.register_blueprint(agents_bp)
    app.register_blueprint(jobs_bp)
    app.register_blueprint(reputation_bp)
    app.register_blueprint(network_bp)
    app.register_blueprint(legacy_bp)

    @app.errorhandler(404)
    def not_found(e):
        return api_error("Not found", 404)

    @app.errorhandler(500)
    def server_error(e):
        return api_error("Internal server error", 500)

    return app


if __name__ == "__main__":
    app = create_app()
    logger.info("ALIAS API V2 starting on port 5000")
    app.run(host="0.0.0.0", port=5000)
