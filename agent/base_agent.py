#!/usr/bin/env python3
"""ALIAS Base Agent - Shared functionality for all agents"""
import os, requests
from dotenv import load_dotenv
from web3 import Web3
from eth_account import Account
load_dotenv()

CONTRACT = "0x0F2f94281F87793ee086a2B6517B6db450192874"
VERIFY_CONTRACT = "0x4f59c273dA1D1f4c9a9C1D0b82D7d5df006b2715"
JOB_CONTRACT = "0x7Fa3c9C28447d6ED6671b49d537E728f678568C8"
RPC_URL = os.getenv("RPC_URL", "https://mainnet.base.org")
PRIVATE_KEY = os.getenv("PRIVATE_KEY")
VENICE_API_KEY = os.getenv("VENICE_API_KEY")
BANKR_API_KEY = os.getenv("BANKR_API_KEY")

SOUL_ABI = [
    {"inputs":[{"name":"addr","type":"address"}],"name":"hasSoul","outputs":[{"type":"bool"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"name":"addr","type":"address"}],"name":"agentToSoul","outputs":[{"type":"uint256"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"name":"tokenId","type":"uint256"}],"name":"actionCount","outputs":[{"type":"uint256"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"name":"tokenId","type":"uint256"},{"name":"actionType","type":"string"},{"name":"actionHash","type":"string"}],"name":"recordAction","outputs":[],"stateMutability":"nonpayable","type":"function"},
]
VERIFY_ABI = [
    {"inputs":[{"name":"tokenId","type":"uint256"}],"name":"getVerificationCount","outputs":[{"type":"uint256"}],"stateMutability":"view","type":"function"},
]
JOB_ABI = [
    {"inputs":[{"name":"tokenId","type":"uint256"}],"name":"getJobCount","outputs":[{"type":"uint256"}],"stateMutability":"view","type":"function"},
]

class BaseAgent:
    def __init__(self, name="ALIAS-Agent"):
        self.name = name
        self.w3 = Web3(Web3.HTTPProvider(RPC_URL))
        self.soul_contract = self.w3.eth.contract(address=Web3.to_checksum_address(CONTRACT), abi=SOUL_ABI)
        self.verify_contract = self.w3.eth.contract(address=Web3.to_checksum_address(VERIFY_CONTRACT), abi=VERIFY_ABI)
        self.job_contract = self.w3.eth.contract(address=Web3.to_checksum_address(JOB_CONTRACT), abi=JOB_ABI)
        self.wallet = self._get_wallet()
        self.token_id = None
        self.action_count = 0

    def _get_wallet(self):
        try:
            if not PRIVATE_KEY:
                return ""
            return Account.from_key(PRIVATE_KEY).address
        except Exception:
            return ""

    def has_soul(self, addr=None):
        try:
            addr = Web3.to_checksum_address(addr or self.wallet)
            return self.soul_contract.functions.hasSoul(addr).call()
        except Exception:
            return False

    def get_token_id(self, addr=None):
        try:
            addr = Web3.to_checksum_address(addr or self.wallet)
            return self.soul_contract.functions.agentToSoul(addr).call()
        except Exception:
            return None

    def get_reputation(self, token_id=None):
        """Unified reputation: actions*20 + verifications*15 + jobs*25 (matches api.py and frontend)"""
        tid = token_id or self.token_id
        if not tid:
            return 0
        try:
            actions = self.soul_contract.functions.actionCount(tid).call()
            verifications = self.verify_contract.functions.getVerificationCount(tid).call()
            jobs = self.job_contract.functions.getJobCount(tid).call()
            return actions * 20 + verifications * 15 + jobs * 25
        except Exception:
            return 0

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
        if not self.token_id:
            return None
        print(f"[CHAIN] {atype}")
        try:
            account = Account.from_key(PRIVATE_KEY)
            tx = self.soul_contract.functions.recordAction(
                int(self.token_id), atype, ahash
            ).build_transaction({
                "from": account.address,
                "nonce": self.w3.eth.get_transaction_count(account.address),
                "gas": 300000,
                "gasPrice": self.w3.eth.gas_price,
            })
            signed = account.sign_transaction(tx)
            tx_hash = self.w3.eth.send_raw_transaction(signed.raw_transaction)
            self.action_count += 1
            return self.w3.to_hex(tx_hash)
        except Exception as e:
            print(f"[CHAIN] Error: {e}")
            return None

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
