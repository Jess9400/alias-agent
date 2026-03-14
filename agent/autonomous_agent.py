#!/usr/bin/env python3
"""
ALIAS Autonomous Agent v2.1
- Self-mints Soulbound Token on first run
- Autonomous decision making (Venice AI)
- Onchain reputation building
- Agent-to-Agent verification
- Bankr wallet integration with reputation rewards
"""
import os
import time
import subprocess
import requests
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

CONTRACT = "0x0F2f94281F87793ee086a2B6517B6db450192874"
RPC_URL = "https://mainnet.base.org"
PRIVATE_KEY = os.getenv("PRIVATE_KEY")
VENICE_API_KEY = os.getenv("VENICE_API_KEY")
BANKR_API_KEY = os.getenv("BANKR_API_KEY")

KNOWN_AGENTS = {
    "ALIAS-Prime": "0x6FFa1e00509d8B625c2F061D7dB07893B37199BC",
    "vitalik.eth": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
}

class AutonomousAgent:
    def __init__(self, agent_name="ALIAS-Alpha"):
        self.agent_name = agent_name
        self.contract = CONTRACT
        self.rpc = RPC_URL
        self.wallet = self._get_wallet_address()
        self.token_id = None
        self.action_count = 0
        self.verified_agents = []
        self.bankr_evm = "0x328beba812a32e66f2c11cb20f0a344391d07ea0"
        self.bankr_solana = "2aVoGt8N15Mm2d9XD74F3MoAG58nS5of72iuQu8dPAKr"
        self.start_time = datetime.now()
        print("\n" + "="*60)
        print("       ALIAS AUTONOMOUS AGENT v2.1")
        print("       Soulbound Identity + Verification + Rewards")
        print("="*60)
        print(f"  Agent: {self.agent_name}")
        print(f"  Wallet: {self.wallet}")
        print(f"  Bankr EVM: {self.bankr_evm}")
        print(f"  Contract: {self.contract}")
        print(f"  Started: {self.start_time.strftime('%Y-%m-%d %H:%M:%S')}")
        print("="*60 + "\n")

    def _get_wallet_address(self):
        cmd = ["cast", "wallet", "address", "--private-key", PRIVATE_KEY]
        result = subprocess.run(cmd, capture_output=True, text=True)
        return result.stdout.strip()

    def _call_contract(self, function, *args):
        cmd = ["cast", "call", "--rpc-url", self.rpc, self.contract, function] + list(args)
        result = subprocess.run(cmd, capture_output=True, text=True)
        return result.stdout.strip()

    def _send_transaction(self, function, *args):
        cmd = ["cast", "send", "--rpc-url", self.rpc, "--private-key", PRIVATE_KEY, self.contract, function] + list(args)
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode == 0:
            for line in result.stdout.split('\n'):
                if 'transactionHash' in line:
                    return line.split()[-1]
        return None

    def has_soul(self, address=None):
        addr = address or self.wallet
        result = self._call_contract("hasSoul(address)", addr)
        return "0x0000000000000000000000000000000000000000000000000000000000000001" in result

    def get_token_id(self, address=None):
        addr = address or self.wallet
        result = self._call_contract("agentToSoul(address)", addr)
        try:
            return int(result, 16)
        except:
            return None

    def get_action_count(self, token_id=None):
        tid = token_id or self.token_id
        if not tid:
            return 0
        result = self._call_contract("actionCount(uint256)", str(tid))
        try:
            return int(result, 16)
        except:
            return 0

    def get_reputation_score(self, token_id=None):
        """Reputation = actions * 10"""
        return self.get_action_count(token_id) * 10

    def get_reputation_tier(self):
        """Get reputation tier for rewards"""
        score = self.get_reputation_score()
        if score >= 500:
            return "LEGENDARY", 0.01
        elif score >= 200:
            return "ELITE", 0.005
        elif score >= 100:
            return "TRUSTED", 0.002
        elif score >= 50:
            return "VERIFIED", 0.001
        else:
            return "NEWCOMER", 0.0

    # ============== SELF-MINTING ==============
    
    def mint_soul(self):
        """Self-mint a Soulbound Token - THE AGENT MINTS ITS OWN IDENTITY"""
        print("\n[SELF-MINT] Agent is minting its own Soulbound Token...")
        print(f"[SELF-MINT] Name: {self.agent_name}")
        print(f"[SELF-MINT] Wallet: {self.wallet}")
        
        tx_hash = self._send_transaction(
            "mintSoul(address,string,string,string)",
            self.wallet,
            self.agent_name,
            "autonomous-agent-v2.1",
            f"Self-minted autonomous AI agent. Bankr wallet: {self.bankr_evm}"
        )
        if tx_hash:
            print(f"[SELF-MINT] SUCCESS! Soul created!")
            print(f"[SELF-MINT] TX: {tx_hash[:40]}...")
            time.sleep(3)
            self.token_id = self.get_token_id()
            print(f"[SELF-MINT] Token ID: {self.token_id}")
            
            # Record the self-mint as first action
            self.record_action("genesis", f"self-minted-{int(time.time())}")
            return True
        print("[SELF-MINT] FAILED - Agent may already have a soul")
        return False

    def ensure_soul(self):
        """Ensure agent has identity - self-mint if needed"""
        print("[IDENTITY] Checking for Soulbound Token...")
        if self.has_soul():
            self.token_id = self.get_token_id()
            tier, _ = self.get_reputation_tier()
            print(f"[IDENTITY] Soul found! Token #{self.token_id}")
            print(f"[IDENTITY] Reputation: {self.get_reputation_score()} ({tier})")
            return True
        print("[IDENTITY] No soul found - initiating self-mint...")
        return self.mint_soul()

    def record_action(self, action_type, action_hash):
        if not self.token_id:
            print("[ACTION] Cannot record: No token ID")
            return None
        print(f"[ACTION] Recording: {action_type}")
        tx_hash = self._send_transaction("recordAction(uint256,string,string)", str(self.token_id), action_type, action_hash)
        if tx_hash:
            self.action_count += 1
            print(f"[ACTION] Recorded onchain! TX: {tx_hash[:20]}...")
            return tx_hash
        print("[ACTION] Recording failed")
        return None

    # ============== AGENT-TO-AGENT VERIFICATION ==============
    
    def verify_agent(self, agent_name, agent_address):
        print(f"\n[VERIFY] Checking agent: {agent_name}")
        print(f"[VERIFY] Address: {agent_address}")
        
        has_soul = self.has_soul(agent_address)
        target_token_id = self.get_token_id(agent_address) if has_soul else None
        target_reputation = self.get_reputation_score(target_token_id) if target_token_id else 0
        
        if has_soul:
            print(f"[VERIFY] VERIFIED! Token #{target_token_id}, Rep: {target_reputation}")
            verification_hash = f"verified-{agent_address[:10]}-token{target_token_id}-rep{target_reputation}"
            self.record_action("agent-verification", verification_hash)
            self.verified_agents.append({
                "name": agent_name,
                "address": agent_address,
                "token_id": target_token_id,
                "reputation": target_reputation,
                "verified_at": datetime.now().isoformat()
            })
            return {"status": "VERIFIED", "has_soul": True, "token_id": target_token_id, "reputation": target_reputation}
        else:
            print(f"[VERIFY] NOT FOUND - {agent_name} has no soul")
            self.record_action("verification-failed", f"no-soul-{agent_address[:10]}")
            return {"status": "NO_SOUL", "has_soul": False}

    def get_verification_report(self):
        if not self.verified_agents:
            return "\n[VERIFICATION REPORT] No agents verified yet."
        report = "\n[VERIFICATION REPORT]\n" + "-"*40
        for a in self.verified_agents:
            report += f"\n  {a['name']}: Token #{a['token_id']}, Rep: {a['reputation']}"
        report += "\n" + "-"*40
        return report

    # ============== VENICE AI ==============
    
    def think(self, prompt):
        if not VENICE_API_KEY:
            return "Error: VENICE_API_KEY not set"
        tier, _ = self.get_reputation_tier()
        system = f"""You are {self.agent_name}, an autonomous AI agent on Base blockchain.
Your Soulbound Token: #{self.token_id}
Reputation: {self.get_reputation_score()} ({tier} tier)
Agents verified: {len(self.verified_agents)}
Bankr wallet: {self.bankr_evm}
Be concise (1-2 sentences)."""
        
        headers = {"Authorization": f"Bearer {VENICE_API_KEY}", "Content-Type": "application/json"}
        payload = {"model": "llama-3.3-70b", "messages": [{"role": "system", "content": system}, {"role": "user", "content": prompt}], "max_tokens": 100}
        try:
            r = requests.post("https://api.venice.ai/api/v1/chat/completions", headers=headers, json=payload, timeout=30)
            r.raise_for_status()
            return r.json()["choices"][0]["message"]["content"]
        except Exception as e:
            return f"Error: {e}"

    def decide_next_action(self):
        prompt = "Pick ONE: CHECK_WALLET, MARKET_THOUGHT, AI_INSIGHT, VERIFY_AGENT, CLAIM_REWARD. Reply ONLY the action name."
        response = self.think(prompt)
        action = response.strip().upper().replace(" ", "_")
        for valid in ["CHECK_WALLET", "MARKET_THOUGHT", "AI_INSIGHT", "VERIFY_AGENT", "CLAIM_REWARD"]:
            if valid in action:
                return valid
        return "AI_INSIGHT"

    # ============== BANKR WALLET ==============
    
    def bankr_prompt(self, prompt):
        if not BANKR_API_KEY:
            return None
        headers = {"X-API-Key": BANKR_API_KEY, "Content-Type": "application/json"}
        try:
            r = requests.post("https://api.bankr.bot/agent/prompt", headers=headers, json={"prompt": prompt}, timeout=30)
            job_id = r.json().get("jobId")
            for _ in range(20):
                time.sleep(2)
                result = requests.get(f"https://api.bankr.bot/agent/job/{job_id}", headers={"X-API-Key": BANKR_API_KEY}).json()
                if result.get("status") == "completed":
                    return result.get("response")
        except Exception as e:
            print(f"[BANKR] Error: {e}")
        return None

    def check_wallet(self):
        print("[BANKR] Checking wallet balances...")
        result = self.bankr_prompt("what are my balances?")
        if result:
            print(f"[BANKR] {result[:100]}...")
            return result
        return None

    def claim_reputation_reward(self):
        """Claim reward based on reputation tier - demonstrates Bankr earning"""
        tier, reward_amount = self.get_reputation_tier()
        print(f"\n[REWARD] Checking reputation reward eligibility...")
        print(f"[REWARD] Current tier: {tier}")
        print(f"[REWARD] Potential reward: {reward_amount} ETH")
        
        if reward_amount > 0:
            # In a real system, this would trigger an actual transfer
            # For demo, we show the intent and record it onchain
            print(f"[REWARD] Agent qualifies for {tier} tier rewards!")
            print(f"[REWARD] Bankr wallet: {self.bankr_evm}")
            
            # Record the reward claim attempt onchain
            self.record_action("reward-claim", f"{tier}-tier-{reward_amount}eth-{int(time.time())}")
            
            # Use Bankr to show wallet (simulating reward flow)
            result = self.bankr_prompt(f"I am claiming my {tier} tier reward of {reward_amount} ETH for having {self.get_reputation_score()} reputation points.")
            if result:
                print(f"[BANKR] {result[:80]}...")
            
            return {"tier": tier, "amount": reward_amount, "claimed": True}
        else:
            print(f"[REWARD] Need 50+ reputation for rewards (current: {self.get_reputation_score()})")
            return {"tier": tier, "amount": 0, "claimed": False}

    # ============== TASK EXECUTION ==============
    
    def execute_task(self, task):
        print(f"\n[TASK] Executing: {task}")
        ts = int(time.time())
        
        if task == "CHECK_WALLET":
            result = self.check_wallet()
            if result:
                self.record_action("wallet-check", f"balance-{ts}")
            return True
            
        elif task == "MARKET_THOUGHT":
            thought = self.think("One sentence crypto market observation.")
            print(f"[THOUGHT] {thought}")
            self.record_action("market-analysis", f"thought-{ts}")
            return True
            
        elif task == "AI_INSIGHT":
            thought = self.think("One insight about autonomous AI agents with blockchain identity.")
            print(f"[INSIGHT] {thought}")
            self.record_action("ai-insight", f"insight-{ts}")
            return True
            
        elif task == "VERIFY_AGENT":
            result = self.verify_agent("ALIAS-Prime", KNOWN_AGENTS["ALIAS-Prime"])
            if result["status"] == "VERIFIED":
                thought = self.think(f"I verified ALIAS-Prime with {result['reputation']} reputation. Why does agent verification matter?")
                print(f"[INSIGHT] {thought}")
            return True
            
        elif task == "CLAIM_REWARD":
            self.claim_reputation_reward()
            return True
            
        elif task == "REST":
            print("[REST] Resting...")
            return True
        return False

    # ============== MAIN LOOP ==============
    
    def run(self, cycles=3, interval=10):
        if not self.ensure_soul():
            print("\n[ERROR] Cannot run without soul. Exiting.")
            return
            
        tier, reward = self.get_reputation_tier()
        print(f"\n[START] Autonomous loop: {cycles} cycles, {interval}s interval")
        print(f"[START] Tier: {tier} | Potential reward: {reward} ETH")
        print("="*60)
        
        for cycle in range(1, cycles + 1):
            print(f"\n{'='*60}")
            tier, _ = self.get_reputation_tier()
            print(f"[CYCLE {cycle}/{cycles}] {datetime.now().strftime('%H:%M:%S')} | Rep: {self.get_reputation_score()} ({tier}) | Verified: {len(self.verified_agents)}")
            print("="*60)
            
            print("\n[THINK] Venice AI deciding next action...")
            action = self.decide_next_action()
            print(f"[DECIDE] {action}")
            
            self.execute_task(action)
            
            if cycle < cycles:
                print(f"\n[WAIT] {interval}s until next cycle...")
                time.sleep(interval)
        
        if self.verified_agents:
            print(self.get_verification_report())
        
        tier, reward = self.get_reputation_tier()
        print("\n" + "="*60)
        print("            AGENT RUN COMPLETE")
        print("="*60)
        print(f"  Agent: {self.agent_name}")
        print(f"  Token ID: {self.token_id}")
        print(f"  Cycles: {cycles}")
        print(f"  Actions recorded: {self.action_count}")
        print(f"  Agents verified: {len(self.verified_agents)}")
        print(f"  Final reputation: {self.get_reputation_score()} ({tier})")
        print(f"  Reward eligible: {reward} ETH")
        print(f"  Runtime: {(datetime.now() - self.start_time).seconds}s")
        print("="*60 + "\n")


def verify_mode():
    agent = AutonomousAgent()
    if not agent.ensure_soul():
        return
    print("\n[VERIFY MODE] Checking known agents...")
    for name, address in KNOWN_AGENTS.items():
        agent.verify_agent(name, address)
        time.sleep(2)
    print(agent.get_verification_report())


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="ALIAS Autonomous Agent v2.1")
    parser.add_argument("--cycles", type=int, default=3)
    parser.add_argument("--interval", type=int, default=10)
    parser.add_argument("--demo", action="store_true", help="Demo mode")
    parser.add_argument("--verify", action="store_true", help="Verify mode")
    parser.add_argument("--reward", action="store_true", help="Check reward eligibility")
    args = parser.parse_args()
    
    if args.verify:
        verify_mode()
    elif args.reward:
        agent = AutonomousAgent()
        agent.ensure_soul()
        agent.claim_reputation_reward()
    else:
        if args.demo:
            args.cycles = 3
            args.interval = 5
        agent = AutonomousAgent()
        agent.run(cycles=args.cycles, interval=args.interval)
