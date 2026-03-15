import os
import subprocess
import requests
from dotenv import load_dotenv
load_dotenv()
CONTRACT = "0x0F2f94281F87793ee086a2B6517B6db450192874"
RPC_URL = os.getenv("RPC_URL", "https://mainnet.base.org")
PRIVATE_KEY = os.getenv("PRIVATE_KEY")
VENICE_API_KEY = os.getenv("VENICE_API_KEY")
BANKR_API_KEY = os.getenv("BANKR_API_KEY")

class AliasSoulAgent:
    def __init__(self):
        self.contract = CONTRACT
        self.rpc = RPC_URL
        self.venice_api_key = VENICE_API_KEY
        self.bankr_api_key = BANKR_API_KEY
    
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
    
    # ============== BLOCKCHAIN ==============
    def has_soul(self, addr):
        cmd = ["cast", "call", "--rpc-url", self.rpc, self.contract, "hasSoul(address)", addr]
        r = subprocess.run(cmd, capture_output=True, text=True)
        return "0x0000000000000000000000000000000000000000000000000000000000000001" in r.stdout

    def get_total_souls(self):
        cmd = ["cast", "call", "--rpc-url", self.rpc, self.contract, "totalSouls()"]
        r = subprocess.run(cmd, capture_output=True, text=True)
        return int(r.stdout.strip(), 16) if r.stdout.strip() else 0

    def record_action(self, token_id, action_type, action_hash):
        cmd = ["cast", "send", "--rpc-url", self.rpc, "--private-key", PRIVATE_KEY, self.contract, "recordAction(uint256,string,string)", str(token_id), action_type, action_hash]
        r = subprocess.run(cmd, capture_output=True, text=True)
        return r.stdout if r.returncode == 0 else r.stderr

    # ============== ENS ==============
    def resolve_ens(self, ens_name):
        cmd = ["cast", "resolve-name", "--rpc-url", "https://ethereum.publicnode.com", ens_name]
        r = subprocess.run(cmd, capture_output=True, text=True)
        return r.stdout.strip() if r.returncode == 0 else None

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
