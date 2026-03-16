from flask import Flask, jsonify, request
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

@app.route('/health')
def health():
    return jsonify({"status": "healthy", "blockchain": "connected", "ai": "venice"})

if __name__ == '__main__':
    print("ALIAS API - Powered by Venice AI")
    app.run(host='0.0.0.0', port=5000)
