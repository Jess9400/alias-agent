"""
ALIAS Reputation System v2.0
============================
Advanced reputation scoring with:
- Action type weights
- Verification bonuses
- Economic stake multipliers
- Trust chain tracking
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional
from enum import Enum


class ActionType(Enum):
    """Action types with their base weights"""
    REGISTRATION = ("registration", 10)
    VERIFICATION_GIVEN = ("verification-given", 20)
    VERIFICATION_RECEIVED = ("verification-received", 15)
    TASK_COMPLETED = ("task-completed", 25)
    PAYMENT_SENT = ("payment-sent", 30)
    PAYMENT_RECEIVED = ("payment-received", 20)
    COLLABORATION_ACCEPTED = ("collab-accepted", 15)
    COLLABORATION_DENIED = ("collab-denied", 5)
    ESCROW_CREATED = ("escrow-created", 10)
    ESCROW_RELEASED = ("escrow-released", 15)
    SKILL_VERIFIED = ("skill-verified", 20)
    CLIENT_RATING = ("client-rating", 25)
    
    @property
    def weight(self) -> int:
        return self.value[1]
    
    @property
    def action_name(self) -> str:
        return self.value[0]


@dataclass
class ReputationScore:
    """Detailed reputation breakdown"""
    base_score: int = 0
    verification_bonus: float = 1.0
    stake_multiplier: float = 1.0
    trust_chain_bonus: float = 1.0
    final_score: int = 0
    tier: str = "NO_SOUL"
    risk_level: int = 100
    
    def calculate(self) -> int:
        """Calculate final weighted score"""
        self.final_score = int(
            self.base_score * 
            self.verification_bonus * 
            self.stake_multiplier * 
            self.trust_chain_bonus
        )
        self.tier, self.risk_level = self._get_tier()
        return self.final_score
    
    def _get_tier(self) -> tuple:
        if self.final_score >= 500:
            return "LEGENDARY", 5
        elif self.final_score >= 200:
            return "ELITE", 15
        elif self.final_score >= 100:
            return "TRUSTED", 30
        elif self.final_score >= 50:
            return "VERIFIED", 50
        elif self.final_score >= 1:
            return "NEWCOMER", 70
        return "NO_SOUL", 100


@dataclass 
class TrustLink:
    """A verification link between two agents"""
    from_agent: str
    to_agent: str
    from_address: str
    to_address: str
    timestamp: str
    verification_type: str  # "verified", "hired", "collaborated"


@dataclass
class TrustChain:
    """Trust chain showing verification paths"""
    links: List[TrustLink] = field(default_factory=list)
    
    def add_link(self, link: TrustLink):
        self.links.append(link)
    
    def get_chain_for_agent(self, agent_name: str) -> List[TrustLink]:
        """Get all trust links involving an agent"""
        return [l for l in self.links if l.from_agent == agent_name or l.to_agent == agent_name]
    
    def get_verification_depth(self, agent_name: str) -> int:
        """How many levels deep is this agent verified?"""
        depth = 0
        current = agent_name
        visited = set()
        
        while current not in visited:
            visited.add(current)
            verifiers = [l for l in self.links if l.to_agent == current]
            if not verifiers:
                break
            # Follow first verifier
            current = verifiers[0].from_agent
            depth += 1
        
        return depth
    
    def calculate_trust_bonus(self, agent_name: str) -> float:
        """Calculate bonus based on trust chain depth"""
        depth = self.get_verification_depth(agent_name)
        # Each level of verification adds 10% bonus, max 50%
        return 1.0 + min(depth * 0.1, 0.5)


class ReputationCalculator:
    """
    Advanced reputation calculator with weighted scoring
    """
    
    def __init__(self):
        self.action_history: Dict[str, List[dict]] = {}
        self.trust_chain = TrustChain()
        self.stake_amounts: Dict[str, float] = {}
    
    def record_action(self, agent_name: str, action_type: ActionType, metadata: dict = None):
        """Record an action for an agent"""
        if agent_name not in self.action_history:
            self.action_history[agent_name] = []
        
        self.action_history[agent_name].append({
            "type": action_type,
            "weight": action_type.weight,
            "metadata": metadata or {}
        })
    
    def record_verification(self, from_agent: str, to_agent: str, 
                          from_addr: str, to_addr: str, 
                          ver_type: str = "verified"):
        """Record a verification between agents"""
        link = TrustLink(
            from_agent=from_agent,
            to_agent=to_agent,
            from_address=from_addr,
            to_address=to_addr,
            timestamp="",
            verification_type=ver_type
        )
        self.trust_chain.add_link(link)
        
        # Also record as actions
        self.record_action(from_agent, ActionType.VERIFICATION_GIVEN)
        self.record_action(to_agent, ActionType.VERIFICATION_RECEIVED)
    
    def set_stake(self, agent_name: str, eth_amount: float):
        """Set economic stake for an agent"""
        self.stake_amounts[agent_name] = eth_amount
    
    def calculate_reputation(self, agent_name: str) -> ReputationScore:
        """Calculate full weighted reputation score"""
        score = ReputationScore()
        
        # Base score from actions
        if agent_name in self.action_history:
            score.base_score = sum(a["weight"] for a in self.action_history[agent_name])
        
        # Verification bonus (verified by high-rep agents = 1.25x)
        verifiers = [l for l in self.trust_chain.links if l.to_agent == agent_name]
        if verifiers:
            score.verification_bonus = 1.25
        
        # Stake multiplier (each 0.01 ETH staked = +5%, max 50%)
        stake = self.stake_amounts.get(agent_name, 0)
        score.stake_multiplier = 1.0 + min(stake * 5, 0.5)
        
        # Trust chain bonus
        score.trust_chain_bonus = self.trust_chain.calculate_trust_bonus(agent_name)
        
        score.calculate()
        return score
    
    def get_trust_network(self) -> Dict:
        """Get the full trust network for visualization"""
        return {
            "links": [
                {
                    "from": l.from_agent,
                    "to": l.to_agent,
                    "type": l.verification_type
                }
                for l in self.trust_chain.links
            ],
            "agents": list(set(
                [l.from_agent for l in self.trust_chain.links] +
                [l.to_agent for l in self.trust_chain.links]
            ))
        }


# =============================================================================
# DEMO / TEST
# =============================================================================

if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("   ALIAS REPUTATION SYSTEM v2.0")
    print("   Weighted Scoring Demo")
    print("=" * 60)
    
    calc = ReputationCalculator()
    
    # Simulate ALIAS-Alpha's history
    print("\n[DEMO] Building ALIAS-Alpha reputation...")
    calc.record_action("ALIAS-Alpha", ActionType.REGISTRATION)
    calc.record_action("ALIAS-Alpha", ActionType.TASK_COMPLETED)
    calc.record_action("ALIAS-Alpha", ActionType.TASK_COMPLETED)
    calc.record_action("ALIAS-Alpha", ActionType.PAYMENT_SENT)
    calc.record_action("ALIAS-Alpha", ActionType.VERIFICATION_GIVEN)
    calc.record_action("ALIAS-Alpha", ActionType.ESCROW_CREATED)
    calc.record_action("ALIAS-Alpha", ActionType.ESCROW_RELEASED)
    calc.set_stake("ALIAS-Alpha", 0.005)  # Staked 0.005 ETH
    
    # Simulate DataMind's history
    print("[DEMO] Building DataMind reputation...")
    calc.record_action("DataMind", ActionType.REGISTRATION)
    calc.record_action("DataMind", ActionType.SKILL_VERIFIED)
    calc.record_action("DataMind", ActionType.TASK_COMPLETED)
    
    # Create verification chain
    print("[DEMO] Creating trust chain...")
    calc.record_verification("ALIAS-Alpha", "ALIAS-Prime", "0x07a0...", "0x6FFa...", "verified")
    calc.record_verification("ALIAS-Prime", "DataMind", "0x6FFa...", "0x1111...", "verified")
    calc.record_verification("ALIAS-Alpha", "DataMind", "0x07a0...", "0x1111...", "hired")
    
    # Calculate scores
    print("\n" + "=" * 60)
    print("   REPUTATION SCORES")
    print("=" * 60)
    
    for agent in ["ALIAS-Alpha", "ALIAS-Prime", "DataMind"]:
        score = calc.calculate_reputation(agent)
        print(f"\n[{agent}]")
        print(f"  Base Score:        {score.base_score}")
        print(f"  Verification:      ×{score.verification_bonus}")
        print(f"  Stake Multiplier:  ×{score.stake_multiplier}")
        print(f"  Trust Chain:       ×{score.trust_chain_bonus}")
        print(f"  ─────────────────────────")
        print(f"  FINAL SCORE:       {score.final_score}")
        print(f"  TIER:              {score.tier} (Risk: {score.risk_level}%)")
    
    # Show trust network
    print("\n" + "=" * 60)
    print("   TRUST NETWORK")
    print("=" * 60)
    network = calc.get_trust_network()
    print(f"\nAgents: {', '.join(network['agents'])}")
    print("\nVerification Links:")
    for link in network["links"]:
        print(f"  {link['from']} ──[{link['type']}]──▶ {link['to']}")
    
    print("\n" + "=" * 60)
