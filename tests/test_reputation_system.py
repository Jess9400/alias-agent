"""Tests for the reputation system."""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'agent'))

from reputation_system import ActionType, ReputationScore, TrustChain, TrustLink, ReputationCalculator


class TestActionType:
    def test_weights(self):
        assert ActionType.REGISTRATION.weight == 10
        assert ActionType.TASK_COMPLETED.weight == 25
        assert ActionType.PAYMENT_SENT.weight == 30
        assert ActionType.VERIFICATION_GIVEN.weight == 20

    def test_action_names(self):
        assert ActionType.REGISTRATION.action_name == "registration"
        assert ActionType.TASK_COMPLETED.action_name == "task-completed"


class TestReputationScore:
    def test_calculate_basic(self):
        score = ReputationScore(base_score=100)
        result = score.calculate()
        assert result == 100
        assert score.tier == "TRUSTED"

    def test_calculate_with_multipliers(self):
        score = ReputationScore(
            base_score=100,
            verification_bonus=1.25,
            stake_multiplier=1.1,
            trust_chain_bonus=1.2,
        )
        result = score.calculate()
        assert result == int(100 * 1.25 * 1.1 * 1.2)
        assert result == 165

    def test_tier_legendary(self):
        score = ReputationScore(base_score=600)
        score.calculate()
        assert score.tier == "LEGENDARY"
        assert score.risk_level == 5

    def test_tier_no_soul(self):
        score = ReputationScore(base_score=0)
        score.calculate()
        assert score.tier == "NO_SOUL"
        assert score.risk_level == 100


class TestTrustChain:
    def test_add_link(self):
        chain = TrustChain()
        link = TrustLink("A", "B", "0xA", "0xB", "2024-01-01", "verified")
        chain.add_link(link)
        assert len(chain.links) == 1

    def test_get_chain_for_agent(self):
        chain = TrustChain()
        chain.add_link(TrustLink("A", "B", "0xA", "0xB", "", "verified"))
        chain.add_link(TrustLink("C", "D", "0xC", "0xD", "", "verified"))
        result = chain.get_chain_for_agent("A")
        assert len(result) == 1

    def test_verification_depth(self):
        chain = TrustChain()
        chain.add_link(TrustLink("A", "B", "0xA", "0xB", "", "verified"))
        chain.add_link(TrustLink("B", "C", "0xB", "0xC", "", "verified"))
        assert chain.get_verification_depth("C") == 2

    def test_trust_bonus(self):
        chain = TrustChain()
        chain.add_link(TrustLink("A", "B", "0xA", "0xB", "", "verified"))
        bonus = chain.calculate_trust_bonus("B")
        assert bonus == 1.1  # 1 depth = 10%

    def test_trust_bonus_max(self):
        chain = TrustChain()
        for i in range(10):
            chain.add_link(TrustLink(f"A{i}", f"A{i+1}", f"0x{i}", f"0x{i+1}", "", "verified"))
        bonus = chain.calculate_trust_bonus("A10")
        assert bonus == 1.5  # Max 50%


class TestReputationCalculator:
    def test_record_action(self):
        calc = ReputationCalculator()
        calc.record_action("Agent1", ActionType.REGISTRATION)
        assert len(calc.action_history["Agent1"]) == 1

    def test_record_verification(self):
        calc = ReputationCalculator()
        calc.record_verification("A", "B", "0xA", "0xB")
        assert len(calc.trust_chain.links) == 1
        assert len(calc.action_history["A"]) == 1  # VERIFICATION_GIVEN
        assert len(calc.action_history["B"]) == 1  # VERIFICATION_RECEIVED

    def test_calculate_base_score(self):
        calc = ReputationCalculator()
        calc.record_action("Agent1", ActionType.REGISTRATION)
        calc.record_action("Agent1", ActionType.TASK_COMPLETED)
        score = calc.calculate_reputation("Agent1")
        assert score.base_score == 35  # 10 + 25

    def test_verification_bonus_applied(self):
        calc = ReputationCalculator()
        calc.record_action("Agent1", ActionType.REGISTRATION)
        calc.record_verification("Other", "Agent1", "0xO", "0xA")
        score = calc.calculate_reputation("Agent1")
        assert score.verification_bonus == 1.25

    def test_stake_multiplier(self):
        calc = ReputationCalculator()
        calc.record_action("Agent1", ActionType.REGISTRATION)
        calc.set_stake("Agent1", 0.01)
        score = calc.calculate_reputation("Agent1")
        assert score.stake_multiplier == 1.05  # 0.01 * 5 = 0.05, + 1.0

    def test_trust_network(self):
        calc = ReputationCalculator()
        calc.record_verification("A", "B", "0xA", "0xB")
        network = calc.get_trust_network()
        assert len(network["links"]) == 1
        assert "A" in network["agents"]
        assert "B" in network["agents"]
