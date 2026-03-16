#!/usr/bin/env python3
"""ALIAS Base Agent - Shared functionality for all agents"""
import os, subprocess, requests
from dotenv import load_dotenv
load_dotenv()

CONTRACT = "0x0F2f94281F87793ee086a2B6517B6db450192874"
RPC_URL = "https://mainnet.base.org"
PRIVATE_KEY = os.getenv("PRIVATE_KEY")
VENICE_API_KEY = os.getenv("VENICE_API_KEY")
BANKR_API_KEY = os.getenv("BANKR_API_KEY")

class BaseAgent:
    def __init__(self, name="ALIAS-Agent"):
        self.name = name
        self.wallet = self._get_wallet()
        self.token_id = None
        self.action_count = 0

    def _get_wallet(self):
        r = subprocess.run(["cast", "wallet", "address", "--private-key", PRIVATE_KEY], capture_output=True, text=True)
        return r.stdout.strip()

    def _call(self, func, *args):
        r = subprocess.run(["cast", "call", "--rpc-url", RPC_URL, CONTRACT, func] + list(args), capture_output=True, text=True)
        return r.stdout.strip()

    def _send(self, func, *args):
        r = subprocess.run(["cast", "send", "--rpc-url", RPC_URL, "--private-key", PRIVATE_KEY, CONTRACT, func] + list(args), capture_output=True, text=True)
        if r.returncode == 0:
            for line in r.stdout.split("\n"):
                if "transactionHash" in line:
                    return line.split()[-1]
        return None

    def has_soul(self, addr=None):
        result = self._call("hasSoul(address)", addr or self.wallet)
        return "0x0000000000000000000000000000000000000000000000000000000000000001" in result

    def get_token_id(self, addr=None):
        result = self._call("agentToSoul(address)", addr or self.wallet)
        try: return int(result, 16)
        except Exception: return None

    def get_reputation(self, token_id=None):
        tid = token_id or self.token_id
        if not tid: return 0
        result = self._call("actionCount(uint256)", str(tid))
        try: return int(result, 16) * 10
        except Exception: return 0

    def get_tier(self, rep=None):
        score = rep if rep is not None else self.get_reputation()
        if score >= 500: return "LEGENDARY", 5
        elif score >= 200: return "ELITE", 15
        elif score >= 100: return "TRUSTED", 30
        elif score >= 50: return "VERIFIED", 50
        elif score >= 1: return "NEWCOMER", 70
        return "NO_SOUL", 100

    def ensure_soul(self):
        if self.has_soul():
            self.token_id = self.get_token_id()
            tier, _ = self.get_tier()
            print(f"[SOUL] Token #{self.token_id}, Rep: {self.get_reputation()} ({tier})")
            return True
        print("[SOUL] No soul found")
        return False

    def record_action(self, atype, ahash):
        if not self.token_id: return None
        print(f"[CHAIN] {atype}")
        tx = self._send("recordAction(uint256,string,string)", str(self.token_id), atype, ahash)
        if tx: self.action_count += 1
        return tx

    def think(self, prompt):
        if not VENICE_API_KEY: return "No API key"
        tier, _ = self.get_tier()
        system = f"You are {self.name}, AI agent Token #{self.token_id}, Rep {self.get_reputation()} ({tier}). Be concise (1 sentence)."
        headers = {"Authorization": f"Bearer {VENICE_API_KEY}", "Content-Type": "application/json"}
        payload = {"model": "llama-3.3-70b", "messages": [{"role": "system", "content": system}, {"role": "user", "content": prompt}], "max_tokens": 80}
        try:
            r = requests.post("https://api.venice.ai/api/v1/chat/completions", headers=headers, json=payload, timeout=30)
            return r.json()["choices"][0]["message"]["content"]
        except Exception as e:
            return f"Error: {e}"
