from flask import Flask, jsonify, request
from alias import AliasSoulAgent

app = Flask(__name__)
agent = AliasSoulAgent()

@app.route("/")
def home():
    return jsonify({"name": "ALIAS", "description": "Soulbound Identity Registry for AI Agents", "total_souls": agent.get_total_souls()})

@app.route("/soul/<address>")
def get_soul(address):
    if agent.has_soul(address):
        return jsonify({"has_soul": True, "address": address})
    return jsonify({"has_soul": False, "address": address})

@app.route("/stats")
def stats():
    return jsonify({"total_souls": agent.get_total_souls(), "contract": "0x0F2f94281F87793ee086a2B6517B6db450192874", "chain": "Base Mainnet"})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)

@app.route("/ens/<name>")
def lookup_ens(name):
    return jsonify(agent.lookup_by_ens(name))
