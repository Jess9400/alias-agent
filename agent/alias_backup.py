import os
import subprocess
from dotenv import load_dotenv
load_dotenv()
CONTRACT = "0x0F2f94281F87793ee086a2B6517B6db450192874"
RPC_URL = os.getenv("RPC_URL", "https://mainnet.base.org")
PRIVATE_KEY = os.getenv("PRIVATE_KEY")

class AliasSoulAgent:
    def __init__(self):
        self.contract = CONTRACT
        self.rpc = RPC_URL

    def has_soul(self, addr):
        cmd = ["cast", "call", "--rpc-url", self.rpc, self.contract, "hasSoul(address)", addr]
        r = subprocess.run(cmd, capture_output=True, text=True)
        return "0x0000000000000000000000000000000000000000000000000000000000000001" in r.stdout

    def get_total_souls(self):
        cmd = ["cast", "call", "--rpc-url", self.rpc, self.contract, "totalSouls()"]
        r = subprocess.run(cmd, capture_output=True, text=True)
        return int(r.stdout.strip(), 16) if r.stdout.strip() else 0

    def mint_soul(self, addr, name, model, desc):
        cmd = ["cast", "send", "--rpc-url", self.rpc, "--private-key", PRIVATE_KEY, self.contract, "mintSoul(address,string,string,string)", addr, name, model, desc]
        r = subprocess.run(cmd, capture_output=True, text=True)
        return r.stdout if r.returncode == 0 else r.stderr

    def record_action(self, token_id, action_type, action_hash):
        cmd = ["cast", "send", "--rpc-url", self.rpc, "--private-key", PRIVATE_KEY, self.contract, "recordAction(uint256,string,string)", str(token_id), action_type, action_hash]
        r = subprocess.run(cmd, capture_output=True, text=True)
        return r.stdout if r.returncode == 0 else r.stderr

    def resolve_ens(self, ens_name):
        cmd = ["cast", "resolve-name", "--rpc-url", "https://eth.llamarpc.com", ens_name]
        r = subprocess.run(cmd, capture_output=True, text=True)
        return r.stdout.strip() if r.returncode == 0 else None

    def lookup_by_ens(self, ens_name):
        addr = self.resolve_ens(ens_name)
        if addr:
            return {"ens": ens_name, "address": addr, "has_soul": self.has_soul(addr)}
        return {"ens": ens_name, "error": "Could not resolve ENS name"}

if __name__ == "__main__":
    agent = AliasSoulAgent()
    print("=== ALIAS Soul Agent ===")
    print(f"Total souls: {agent.get_total_souls()}")
    print(f"ALIAS has soul: {agent.has_soul('0x6FFa1e00509d8B625c2F061D7dB07893B37199BC')}")
    print(f"ENS test: {agent.lookup_by_ens('vitalik.eth')}")
