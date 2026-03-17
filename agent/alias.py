import os
import subprocess
import requests
from dotenv import load_dotenv
from web3 import Web3
load_dotenv()
CONTRACT = "0x0F2f94281F87793ee086a2B6517B6db450192874"
RPC_URL = os.getenv("RPC_URL", "https://mainnet.base.org")
PRIVATE_KEY = os.getenv("PRIVATE_KEY")
VENICE_API_KEY = os.getenv("VENICE_API_KEY")
BANKR_API_KEY = os.getenv("BANKR_API_KEY")

# Minimal ABI for on-chain reads
SOUL_ABI = [
    {"inputs":[{"name":"addr","type":"address"}],"name":"hasSoul","outputs":[{"type":"bool"}],"stateMutability":"view","type":"function"},
    {"inputs":[],"name":"totalSouls","outputs":[{"type":"uint256"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"name":"tokenId","type":"uint256"},{"name":"actionType","type":"string"},{"name":"actionHash","type":"string"}],"name":"recordAction","outputs":[],"stateMutability":"nonpayable","type":"function"},
]

class AliasSoulAgent:
    def __init__(self):
        self.contract = CONTRACT
        self.rpc = RPC_URL
        self.venice_api_key = VENICE_API_KEY
        self.bankr_api_key = BANKR_API_KEY
        self.w3 = Web3(Web3.HTTPProvider(RPC_URL))
        self.soul_contract = self.w3.eth.contract(
            address=Web3.to_checksum_address(CONTRACT),
            abi=SOUL_ABI
        )

    # ============== VENICE AI ==============
    def chat(self, message, model="llama-3.3-70b"):
        if not self.venice_api_key:
            return {"error": "VENICE_API_KEY not set"}
        headers = {"Authorization": f"Bearer {self.venice_api_key}", "Content-Type": "application/json"}
        payload = {"model": model, "messages": [{"role": "system", "content": "You are ALIAS, an AI agent with a Soulbound Token identity on Base."}, {"role": "user", "content": message}], "max_tokens": 500}
        try:
            r = requests.post("https://api.venice.ai/api/v1/chat/completions", headers=headers, json=payload, timeout=30)
            r.raise_for_status()
            return {"response": r.json()["choices"][0]["message"]["content"], "model": model, "provider": "venice"}
        except Exception as e:
            return {"error": str(e)}

    # ============== BANKR WALLET ==============
    def bankr_prompt(self, prompt):
        if not self.bankr_api_key:
            return {"error": "BANKR_API_KEY not set"}
        headers = {"X-API-Key": self.bankr_api_key, "Content-Type": "application/json"}
        try:
            r = requests.post("https://api.bankr.bot/agent/prompt", headers=headers, json={"prompt": prompt}, timeout=30)
            r.raise_for_status()
            job = r.json()
            return {"jobId": job.get("jobId"), "status": "submitted"}
        except Exception as e:
            return {"error": str(e)}

    def bankr_job(self, job_id):
        if not self.bankr_api_key:
            return {"error": "BANKR_API_KEY not set"}
        headers = {"X-API-Key": self.bankr_api_key}
        try:
            r = requests.get(f"https://api.bankr.bot/agent/job/{job_id}", headers=headers, timeout=30)
            r.raise_for_status()
            return r.json()
        except Exception as e:
            return {"error": str(e)}

    def bankr_balances(self):
        import time
        result = self.bankr_prompt("what are my balances?")
        if "error" in result:
            return result
        job_id = result.get("jobId")
        for _ in range(10):
            time.sleep(2)
            job = self.bankr_job(job_id)
            if job.get("status") == "completed":
                return {"response": job.get("response"), "wallets": {"evm": "0x328beba812a32e66f2c11cb20f0a344391d07ea0", "solana": "2aVoGt8N15Mm2d9XD74F3MoAG58nS5of72iuQu8dPAKr"}}
        return {"error": "timeout"}

    # ============== BLOCKCHAIN (web3.py) ==============
    def has_soul(self, addr):
        try:
            addr = Web3.to_checksum_address(addr)
            return self.soul_contract.functions.hasSoul(addr).call()
        except Exception:
            return False

    def get_total_souls(self):
        try:
            return self.soul_contract.functions.totalSouls().call()
        except Exception:
            return 0

    def record_action(self, token_id, action_type, action_hash):
        try:
            if not PRIVATE_KEY:
                return "Error: PRIVATE_KEY not set"
            account = self.w3.eth.account.from_key(PRIVATE_KEY)
            tx = self.soul_contract.functions.recordAction(
                int(token_id), action_type, action_hash
            ).build_transaction({
                "from": account.address,
                "nonce": self.w3.eth.get_transaction_count(account.address),
                "gas": 300000,
                "gasPrice": self.w3.eth.gas_price,
            })
            signed = account.sign_transaction(tx)
            tx_hash = self.w3.eth.send_raw_transaction(signed.raw_transaction)
            return self.w3.to_hex(tx_hash)
        except Exception as e:
            return f"Error: {str(e)}"

    # ============== ENS ==============
    def resolve_ens(self, ens_name):
        try:
            # Use ensdata.net API (same as frontend) — no cast needed
            r = requests.get(f"https://api.ensdata.net/{ens_name}", timeout=10)
            if r.status_code == 200:
                data = r.json()
                return data.get("address")
            return None
        except Exception:
            return None

    def lookup_by_ens(self, ens_name):
        addr = self.resolve_ens(ens_name)
        if addr:
            return {"ens": ens_name, "address": addr, "has_soul": self.has_soul(addr)}
        return {"ens": ens_name, "error": "Could not resolve ENS name"}

if __name__ == "__main__":
    agent = AliasSoulAgent()
    print("=== ALIAS - Venice + Bankr ===")
    print(f"Total souls: {agent.get_total_souls()}")
    print(f"Venice test: {agent.chat('Say hi in 5 words')}")
    print(f"Bankr wallets: {agent.bankr_balances()}")
