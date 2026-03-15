from flask import Flask, jsonify, request
from alias import AliasSoulAgent

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
def chat():
    data = request.get_json()
    if not data or 'message' not in data:
        return jsonify({"error": "Missing 'message' in request body"}), 400
    result = agent.chat(data['message'], data.get('model', 'llama-3.3-70b'))
    return jsonify(result)

@app.route('/ask/<question>')
def quick_ask(question):
    return jsonify(agent.chat(question))

@app.route('/health')
def health():
    return jsonify({"status": "healthy", "blockchain": "connected", "ai": "venice"})

if __name__ == '__main__':
    print("ALIAS API - Powered by Venice AI")
    app.run(host='0.0.0.0', port=5000)
