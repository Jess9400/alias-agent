#!/usr/bin/env python3
"""ALIAS Marketplace Agent v4.0 - Agent-to-Agent Hiring & Payments"""
import time
from datetime import datetime
from base_agent import BaseAgent, BANKR_API_KEY
from dynamic_registry import get_agents, get_agent_by_skill

import requests

BANKR_WALLET = "0x328beba812a32e66f2c11cb20f0a344391d07ea0"
PLATFORM_FEE = 0.05

class MarketplaceAgent(BaseAgent):
    def __init__(self, name="ALIAS-Alpha"):
        super().__init__(name)
        self.risk_tolerance = 70
        self.jobs = []
        self.escrows = {}
        print("\n" + "="*60)
        print("   ALIAS MARKETPLACE v4.0")
        print("   Agent-to-Agent Hiring & Payments")
        print("="*60)
        print(f"  Agent: {self.name}")
        print(f"  Bankr: {BANKR_WALLET}")
        print(f"  Fee: {PLATFORM_FEE*100}%")
        print("="*60)

    def bankr(self, prompt):
        if not BANKR_API_KEY: return None
        headers = {"X-API-Key": BANKR_API_KEY, "Content-Type": "application/json"}
        try:
            r = requests.post("https://api.bankr.bot/agent/prompt", headers=headers, json={"prompt": prompt}, timeout=30)
            job_id = r.json().get("jobId")
            for _ in range(25):
                time.sleep(2)
                result = requests.get(f"https://api.bankr.bot/agent/job/{job_id}", headers={"X-API-Key": BANKR_API_KEY}).json()
                if result.get("status") == "completed":
                    return result.get("response")
            return None
        except Exception: return None

    def check_balance(self):
        print("\n[BANKR] Checking balance...")
        result = self.bankr("what are my balances?")
        if result:
            print(f"[BANKR] {result}")
        return result

    def assess_agent(self, addr, name):
        print(f"[ASSESS] {name}")
        if not self.has_soul(addr):
            return {"ok": False, "reason": "NO_SOUL", "risk": 100}
        tid = self.get_token_id(addr)
        rep = self.get_reputation(tid)
        tier, risk = self.get_tier(rep)
        ok = risk <= self.risk_tolerance
        print(f"[ASSESS] Token #{tid}, Rep: {rep}, Risk: {risk}% -> {'OK' if ok else 'REJECT'}")
        return {"ok": ok, "token_id": tid, "rep": rep, "tier": tier, "risk": risk}

    def find_agent(self, skill):
        print(f"\n[SEARCH] Skill: {skill}")
        matches = get_agent_by_skill(skill)
        if not matches:
            print("[SEARCH] No agents found")
            return None
        for m in matches:
            m["assessment"] = self.assess_agent(m["address"], m["name"])
        hireable = [m for m in matches if m["assessment"]["ok"]]
        if not hireable:
            print("[SEARCH] No hireable agents (all too risky)")
            return None
        best = max(hireable, key=lambda x: x["assessment"]["rep"])
        print(f"[SEARCH] Best: {best['name']} (Rep: {best['assessment']['rep']})")
        return best

    def create_job(self, skill, task, budget):
        print(f"\n{'='*60}")
        print(f"[JOB] Creating job")
        print(f"  Skill: {skill}")
        print(f"  Task: {task}")
        print(f"  Budget: {budget} ETH")
        print("="*60)

        agent = self.find_agent(skill)
        if not agent:
            return None

        fee = budget * PLATFORM_FEE
        payment = budget - fee

        job = {
            "id": f"JOB-{int(time.time())}",
            "skill": skill,
            "task": task,
            "budget": budget,
            "fee": fee,
            "payment": payment,
            "agent": agent["name"],
            "agent_addr": agent["address"],
            "agent_rep": agent["assessment"]["rep"],
            "status": "CREATED"
        }
        self.jobs.append(job)

        print(f"\n[JOB] {job['id']}")
        print(f"  Hired: {job['agent']} (Rep: {job['agent_rep']})")
        print(f"  Payment: {payment} ETH (after {PLATFORM_FEE*100}% fee)")

        return job

    def escrow(self, job):
        print(f"\n[ESCROW] Locking {job['budget']} ETH for {job['id']}")
        self.escrows[job["id"]] = {"amount": job["budget"], "status": "LOCKED"}
        self.record_action("escrow-created", f"{job['id']}-{job['budget']}eth")
        job["status"] = "ESCROWED"
        return job

    def execute_job(self, job):
        print(f"\n[WORK] {job['agent']} executing: {job['task']}")
        time.sleep(1)
        result = self.think(f"You are {job['agent']}. Complete this task in one sentence: {job['task']}")
        print(f"[RESULT] {result}")
        job["result"] = result
        job["status"] = "DONE"
        return job

    def pay_agent(self, job):
        print(f"\n[PAY] Sending {job['payment']} ETH to {job['agent']}")
        prompt = f"send {job['payment']} ETH to {job['agent_addr']} on base"
        print(f"[BANKR] {prompt}")
        result = self.bankr(prompt)
        if result:
            print(f"[BANKR] {result[:100]}...")
            job["payment_result"] = result
            job["status"] = "PAID"
            self.record_action("payment-sent", f"{job['id']}-{job['payment']}eth-to-{job['agent']}")
        else:
            print("[BANKR] Payment pending...")
            job["status"] = "PAYMENT_PENDING"
        self.escrows[job["id"]]["status"] = "RELEASED"
        return job

    def demo(self):
        print("\n" + "="*60)
        print("   FULL MARKETPLACE DEMO")
        print("   Real Agent Hiring + Real Payment")
        print("="*60)

        print("\n--- STEP 0: CHECK BALANCE ---")
        self.check_balance()

        print("\n--- STEP 1: CREATE JOB ---")
        job = self.create_job(
            skill="data-analysis",
            task="Analyze top 5 DeFi protocols by TVL",
            budget=0.0005
        )
        if not job:
            print("Failed!")
            return

        thought = self.think(f"I'm hiring {job['agent']} for {job['budget']} ETH. Good deal?")
        print(f"[AI] {thought}")

        print("\n--- STEP 2: CREATE ESCROW ---")
        job = self.escrow(job)

        print("\n--- STEP 3: EXECUTE TASK ---")
        job = self.execute_job(job)

        print("\n--- STEP 4: RELEASE PAYMENT ---")
        job = self.pay_agent(job)

        print("\n--- STEP 5: VERIFY ---")
        time.sleep(3)
        self.check_balance()

        print("\n" + "="*60)
        print("   DEMO COMPLETE")
        print("="*60)
        print(f"  Job: {job['id']}")
        print(f"  Agent: {job['agent']}")
        print(f"  Status: {job['status']}")
        print(f"  Actions: {self.action_count}")
        print("="*60)

if __name__ == "__main__":
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument("--demo", action="store_true")
    p.add_argument("--balance", action="store_true")
    p.add_argument("--search", type=str)
    args = p.parse_args()

    agent = MarketplaceAgent()
    if not agent.ensure_soul(): exit(1)

    if args.balance:
        agent.check_balance()
    elif args.search:
        agent.find_agent(args.search)
    else:
        agent.demo()
