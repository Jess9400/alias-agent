"""Tests for the Flask API V2."""

import sys
import os
import pytest
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'agent'))


@pytest.fixture
def client():
    """Create Flask test client."""
    with patch("web3.Web3") as MockWeb3:
        mock_w3 = MagicMock()
        mock_contract = MagicMock()
        mock_contract.functions.totalSouls.return_value.call.return_value = 10
        mock_contract.functions.hasSoul.return_value.call.return_value = True
        mock_contract.functions.actionCount.return_value.call.return_value = 5
        mock_contract.functions.getJobCount.return_value.call.return_value = 3
        mock_contract.functions.getVerificationCount.return_value.call.return_value = 2
        mock_contract.functions.agentToSoul.return_value.call.return_value = 1

        mock_w3.eth.contract.return_value = mock_contract
        mock_w3.eth.block_number = 12345678
        mock_w3.eth.gas_price = 1000000000
        MockWeb3.return_value = mock_w3
        MockWeb3.HTTPProvider = MagicMock()
        MockWeb3.to_checksum_address = lambda x: x

        from api_v2 import create_app
        app = create_app()
        app.config["TESTING"] = True
        with app.test_client() as c:
            yield c


class TestLegacyEndpoints:
    def test_index(self, client):
        resp = client.get("/")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["name"] == "ALIAS"

    def test_health(self, client):
        resp = client.get("/health")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["status"] == "healthy"


class TestV2Agents:
    def test_list_agents(self, client):
        resp = client.get("/api/v2/agents")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["success"] is True
        assert isinstance(data["data"], list)

    def test_search_agents(self, client):
        resp = client.get("/api/v2/agents/search?skill=data-analysis")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["success"] is True

    def test_search_agents_missing_param(self, client):
        resp = client.get("/api/v2/agents/search")
        assert resp.status_code == 400


class TestV2Jobs:
    @patch("requests.post")
    def test_execute_job(self, mock_post, client):
        mock_post.return_value = MagicMock(
            status_code=200,
            json=lambda: {"choices": [{"message": {"content": "Job result"}}]},
        )
        mock_post.return_value.raise_for_status = lambda: None

        resp = client.post("/api/v2/jobs/execute", json={
            "job": "Analyze DeFi protocols",
            "agent_name": "DataMind",
            "skills": ["data-analysis"],
            "tier": "TRUSTED",
        })
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["success"] is True
        assert data["data"]["status"] == "completed"

    def test_execute_job_missing_body(self, client):
        resp = client.post("/api/v2/jobs/execute", json={})
        assert resp.status_code == 400


class TestV2Reputation:
    def test_get_reputation(self, client):
        resp = client.get("/api/v2/reputation/1")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["success"] is True
        assert "breakdown" in data["data"]

    def test_leaderboard(self, client):
        resp = client.get("/api/v2/reputation/leaderboard")
        assert resp.status_code == 200
        data = resp.get_json()
        assert isinstance(data["data"], list)


class TestV2Network:
    def test_network_stats(self, client):
        resp = client.get("/api/v2/network/stats")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["data"]["chain"] == "Base Mainnet"

    def test_trust_graph(self, client):
        resp = client.get("/api/v2/network/graph")
        assert resp.status_code == 200
        data = resp.get_json()
        assert "nodes" in data["data"]


class TestErrorHandling:
    def test_404(self, client):
        resp = client.get("/nonexistent")
        assert resp.status_code == 404

    def test_chat_missing_message(self, client):
        resp = client.post("/chat", json={})
        assert resp.status_code == 400
