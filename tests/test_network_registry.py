"""Tests for the network registry."""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'agent'))

from network_registry import NETWORK_AGENTS, get_agent_by_skill, find_by_address, all_skills


class TestNetworkRegistry:
    def test_agents_exist(self):
        assert len(NETWORK_AGENTS) > 0

    def test_required_fields(self):
        for name, data in NETWORK_AGENTS.items():
            assert "address" in data, f"{name} missing address"
            assert "token_id" in data, f"{name} missing token_id"
            assert "skills" in data, f"{name} missing skills"
            assert "hourly_rate" in data, f"{name} missing hourly_rate"
            assert isinstance(data["skills"], list)
            assert len(data["skills"]) > 0

    def test_addresses_valid_format(self):
        for name, data in NETWORK_AGENTS.items():
            assert data["address"].startswith("0x"), f"{name} address invalid"
            assert len(data["address"]) == 42, f"{name} address wrong length"

    def test_get_agent_by_skill(self):
        results = get_agent_by_skill("data-analysis")
        assert len(results) > 0
        assert all("data-analysis" in r["skills"] for r in results)

    def test_get_agent_by_skill_no_match(self):
        results = get_agent_by_skill("nonexistent-skill")
        assert len(results) == 0

    def test_find_by_address(self):
        addr = NETWORK_AGENTS["ALIAS-Prime"]["address"]
        result = find_by_address(addr)
        assert result is not None
        assert result["name"] == "ALIAS-Prime"

    def test_find_by_address_case_insensitive(self):
        addr = NETWORK_AGENTS["ALIAS-Prime"]["address"].lower()
        result = find_by_address(addr)
        assert result is not None

    def test_find_by_address_not_found(self):
        result = find_by_address("0x0000000000000000000000000000000000000000")
        assert result is None

    def test_all_skills(self):
        skills = all_skills()
        assert len(skills) > 0
        assert isinstance(skills, list)
        assert skills == sorted(skills)  # Should be sorted

    def test_token_ids_unique(self):
        ids = [d["token_id"] for d in NETWORK_AGENTS.values()]
        assert len(ids) == len(set(ids)), "Duplicate token IDs found"
