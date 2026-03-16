from flask import Flask, jsonify, request
from flask_cors import CORS
from functools import wraps
from time import time as _time
from alias import AliasSoulAgent

# Simple in-memory rate limiter
_rate_limits = {}
def rate_limit(max_per_minute=30):
    def decorator(f):
        @wraps(f)
        def wrapped(*args, **kwargs):
            ip = request.remote_addr
            now = _time()
            key = f"{f.__name__}:{ip}"
            if key not in _rate_limits:
                _rate_limits[key] = []
            _rate_limits[key] = [t for t in _rate_limits[key] if now - t < 60]
            if len(_rate_limits[key]) >= max_per_minute:
                return jsonify({"error": "Rate limit exceeded"}), 429
            _rate_limits[key].append(now)
            return f(*args, **kwargs)
        return wrapped
    return decorator

app = Flask(__name__)
CORS(app, origins=["https://jess9400.github.io", "http://localhost:*"])
agent = AliasSoulAgent()

@app.route('/')
def index():
    return jsonify({
        "name": "ALIAS",
        "description": "Soulbound Identity for AI Agents",
        "contract": "0x0F2f94281F87793ee086a2B6517B6db450192874",
        "chain": "Base Mainnet",
        "powered_by": "Venice AI",
        "endpoints": ["/stats", "/soul/<address>", "/ens/<name>", "/chat", "/health"]
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
    result = agent.chat(data['message'], data.get('model', 'llama-3.3-70b'))
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
            "model": "llama-3.3-70b",
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Job: {job_desc}"}
            ],
            "max_tokens": 800
        }
        r = __import__('requests').post(
            "https://api.venice.ai/api/v1/chat/completions",
            headers=headers, json=payload, timeout=60
        )
        r.raise_for_status()
        result = r.json()["choices"][0]["message"]["content"]

        # Record verification on-chain via VerificationRegistry
        token_id = data.get('token_id')
        tx_result = None
        if token_id:
            try:
                import subprocess, os
                verification_registry = "0x4f59c273dA1D1f4c9a9C1D0b82D7d5df006b2715"
                pk = os.getenv("PRIVATE_KEY")
                msg = f"Job completed: {job_desc[:80]}"
                r2 = subprocess.run([
                    "cast", "send", "--rpc-url", "https://mainnet.base.org",
                    "--private-key", pk,
                    verification_registry,
                    "verify(uint256,string)", str(token_id), msg
                ], capture_output=True, text=True)
                tx_result = "transactionHash" in r2.stdout if r2.returncode == 0 else False
            except Exception:
                pass

        return jsonify({
            "status": "completed",
            "agent": agent_name,
            "job": job_desc,
            "escrow_id": escrow_id,
            "result": result,
            "provider": "venice",
            "model": "llama-3.3-70b",
            "reputation_updated": tx_result is not None
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/health')
def health():
    return jsonify({"status": "healthy", "blockchain": "connected", "ai": "venice"})

if __name__ == '__main__':
    print("ALIAS API - Powered by Venice AI")
    app.run(host='0.0.0.0', port=5000)
