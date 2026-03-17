#!/usr/bin/env python3
"""ALIAS Autonomous Agent v3.0 - Risk Assessment + Collaboration"""
import time, random
from datetime import datetime
from base_agent import BaseAgent

KNOWN_AGENTS = {
    "ALIAS-Prime": "0x6FFa1e00509d8B625c2F061D7dB07893B37199BC",
    "vitalik.eth": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
    "unknown-agent": "0x1234567890123456789012345678901234567890",
}

class AutonomousAgent(BaseAgent):
    def __init__(self, name="ALIAS-Alpha"):
        super().__init__(name)
        self.risk_tolerance = 50
        self.collab_history = []
        print("\n" + "="*60)
        print("       ALIAS AUTONOMOUS AGENT v3.0")
        print("   Risk Assessment + Collaboration System")
        print("="*60)
        print(f"  Agent: {self.name}")
        print(f"  Wallet: {self.wallet}")
        print(f"  Risk Tolerance: {self.risk_tolerance}%")
        print("="*60 + "\n")

    # ============== RISK ASSESSMENT ==============

    def assess_risk(self, addr, name="Unknown"):
        print(f"\n[RISK] Assessing: {name}")
        print(f"[RISK] Address: {addr[:20]}...")

        if not self.has_soul(addr):
            print("[RISK] NO SOUL - Unverified identity!")
            return {"name": name, "addr": addr, "has_soul": False, "rep": 0, "tier": "NO_SOUL", "risk": 100, "action": "DENY", "reason": "No onchain identity"}

        token_id = self.get_token_id(addr)
        rep = self.get_reputation(token_id)
        tier, risk = self.get_tier(rep)

        print(f"[RISK] Soul: Token #{token_id}, Rep: {rep} ({tier})")
        print(f"[RISK] Risk Score: {risk}%")

        if risk <= 30:
            action, reason = "ACCEPT", f"{tier} - Auto trusted"
        elif risk <= self.risk_tolerance:
            action, reason = "CAUTION", f"Risk {risk}% within tolerance {self.risk_tolerance}%"
        else:
            action, reason = "DENY", f"Risk {risk}% exceeds tolerance {self.risk_tolerance}%"

        print(f"[RISK] Decision: {action} - {reason}")
        return {"name": name, "addr": addr, "has_soul": True, "token_id": token_id, "rep": rep, "tier": tier, "risk": risk, "action": action, "reason": reason}

    # ============== COLLABORATION ==============

    def request_collab(self, addr, name, task):
        print(f"\n{'='*60}")
        print(f"[COLLAB] REQUEST: {task}")
        print(f"[COLLAB] From: {self.name} -> To: {name}")
        print("="*60)

        risk = self.assess_risk(addr, name)

        if risk["action"] == "ACCEPT":
            print(f"\n[COLLAB] ACCEPTED - {risk['tier']} agent trusted")
            self.record_action("collab-accepted", f"{name[:10]}-rep{risk['rep']}")
            thought = self.think(f"I accepted collaboration with {name} (rep {risk['rep']}). Why do I trust them?")
            print(f"[AI] {thought}")
            decision = "ACCEPTED"

        elif risk["action"] == "CAUTION":
            print(f"\n[COLLAB] EVALUATING - Asking AI...")
            thought = self.think(f"{name} has {risk['rep']} rep, {risk['risk']}% risk. Task: {task}. Should I collaborate? YES or NO.")
            print(f"[AI] {thought}")
            if "YES" in thought.upper():
                print("[COLLAB] AI APPROVED")
                self.record_action("collab-ai-approved", f"{name[:10]}-risk{risk['risk']}")
                decision = "ACCEPTED_CAUTIOUS"
            else:
                print("[COLLAB] AI DENIED")
                self.record_action("collab-ai-denied", f"{name[:10]}-risk{risk['risk']}")
                decision = "DENIED"

        else:  # DENY
            print(f"\n[COLLAB] DENIED - {risk['reason']}")
            self.record_action("collab-denied", f"{name[:10]}-risk{risk['risk']}")
            thought = self.think(f"I denied {name} with {risk['risk']}% risk. Why was this smart?")
            print(f"[AI] {thought}")
            decision = "DENIED"

        self.collab_history.append({"agent": name, "task": task, "decision": decision, "risk": risk["risk"], "time": datetime.now().isoformat()})
        return decision

    def collab_report(self):
        if not self.collab_history:
            return "\n[REPORT] No collaborations yet"

        accepted = sum(1 for c in self.collab_history if "ACCEPTED" in c["decision"])
        denied = sum(1 for c in self.collab_history if c["decision"] == "DENIED")

        report = f"\n{'='*60}\n[COLLABORATION REPORT]\n{'='*60}"
        report += f"\n  Total: {len(self.collab_history)} | Accepted: {accepted} | Denied: {denied}\n"
        for c in self.collab_history:
            icon = "Y" if "ACCEPTED" in c["decision"] else "X"
            report += f"  [{icon}] {c['agent']}: {c['decision']} (risk {c['risk']}%)\n"
        return report + "="*60

    # ============== DEMO ==============

    def demo_collab(self):
        print("\n" + "="*60)
        print("   COLLABORATION DEMO - Risk-Based Trust Decisions")
        print("="*60)

        scenarios = [
            ("ALIAS-Prime", KNOWN_AGENTS["ALIAS-Prime"], "Joint market analysis"),
            ("unknown-agent", KNOWN_AGENTS["unknown-agent"], "Process sensitive data"),
            ("vitalik.eth", KNOWN_AGENTS["vitalik.eth"], "Co-author research"),
        ]

        for name, addr, task in scenarios:
            self.request_collab(addr, name, task)
            time.sleep(2)

        print(self.collab_report())

    def run(self, cycles=3, interval=8):
        print(f"\n[RUN] Starting {cycles} cycles...")
        for i in range(1, cycles + 1):
            print(f"\n{'='*60}")
            print(f"[CYCLE {i}/{cycles}] Rep: {self.get_reputation()}")
            print("="*60)
            action = random.choice(["insight", "collab"])
            if action == "insight":
                thought = self.think("One insight about AI agent trust networks.")
                print(f"[INSIGHT] {thought}")
                self.record_action("ai-insight", f"thought-{int(time.time())}")
            else:
                self.request_collab(KNOWN_AGENTS["ALIAS-Prime"], "ALIAS-Prime", "Verify data")
            if i < cycles:
                print(f"\n[WAIT] {interval}s...")
                time.sleep(interval)
        print(self.collab_report())
        print(f"\n[DONE] Actions: {self.action_count}")

if __name__ == "__main__":
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument("--collab", action="store_true")
    p.add_argument("--demo", action="store_true")
    p.add_argument("--risk", type=int, default=50)
    p.add_argument("--cycles", type=int, default=3)
    args = p.parse_args()

    agent = AutonomousAgent()
    agent.risk_tolerance = args.risk
    if not agent.ensure_soul(): exit(1)

    if args.collab:
        agent.demo_collab()
    else:
        agent.run(cycles=args.cycles)
