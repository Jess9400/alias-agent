"""Tests for BaseAgent."""

import pytest
from unittest.mock import MagicMock, patch


class TestBaseAgent:
    @patch("subprocess.run")
    def test_has_soul_true(self, mock_run, mock_env):
        mock_run.return_value = MagicMock(
            stdout="0x0000000000000000000000000000000000000000000000000000000000000001",
            returncode=0,
        )
        from base_agent import BaseAgent
        agent = BaseAgent("TestAgent")
        assert agent.has_soul("0x6FFa1e00509d8B625c2F061D7dB07893B37199BC")

    @patch("subprocess.run")
    def test_has_soul_false(self, mock_run, mock_env):
        mock_run.return_value = MagicMock(
            stdout="0x0000000000000000000000000000000000000000000000000000000000000000",
            returncode=0,
        )
        from base_agent import BaseAgent
        agent = BaseAgent("TestAgent")
        assert not agent.has_soul("0x1234567890123456789012345678901234567890")

    @patch("subprocess.run")
    def test_get_token_id(self, mock_run, mock_env):
        mock_run.return_value = MagicMock(
            stdout="0x0000000000000000000000000000000000000000000000000000000000000002",
            returncode=0,
        )
        from base_agent import BaseAgent
        agent = BaseAgent("TestAgent")
        assert agent.get_token_id() == 2

    @patch("subprocess.run")
    def test_get_reputation(self, mock_run, mock_env):
        mock_run.side_effect = [
            MagicMock(stdout="0x6FFa1e00509d8B625c2F061D7dB07893B37199BC", returncode=0),  # wallet
            MagicMock(stdout="0x0000000000000000000000000000000000000000000000000000000000000005", returncode=0),  # actionCount
        ]
        from base_agent import BaseAgent
        agent = BaseAgent("TestAgent")
        agent.token_id = 1
        assert agent.get_reputation(1) == 50  # 5 * 10

    def test_get_tier_legendary(self, mock_env):
        with patch("subprocess.run") as mock_run:
            mock_run.return_value = MagicMock(stdout="0xaddr", returncode=0)
            from base_agent import BaseAgent
            agent = BaseAgent("TestAgent")
            assert agent.get_tier(500) == ("LEGENDARY", 5)

    def test_get_tier_elite(self, mock_env):
        with patch("subprocess.run") as mock_run:
            mock_run.return_value = MagicMock(stdout="0xaddr", returncode=0)
            from base_agent import BaseAgent
            agent = BaseAgent("TestAgent")
            assert agent.get_tier(200) == ("ELITE", 15)

    def test_get_tier_trusted(self, mock_env):
        with patch("subprocess.run") as mock_run:
            mock_run.return_value = MagicMock(stdout="0xaddr", returncode=0)
            from base_agent import BaseAgent
            agent = BaseAgent("TestAgent")
            assert agent.get_tier(100) == ("TRUSTED", 30)

    def test_get_tier_verified(self, mock_env):
        with patch("subprocess.run") as mock_run:
            mock_run.return_value = MagicMock(stdout="0xaddr", returncode=0)
            from base_agent import BaseAgent
            agent = BaseAgent("TestAgent")
            assert agent.get_tier(50) == ("VERIFIED", 50)

    def test_get_tier_newcomer(self, mock_env):
        with patch("subprocess.run") as mock_run:
            mock_run.return_value = MagicMock(stdout="0xaddr", returncode=0)
            from base_agent import BaseAgent
            agent = BaseAgent("TestAgent")
            assert agent.get_tier(1) == ("NEWCOMER", 70)

    def test_get_tier_no_soul(self, mock_env):
        with patch("subprocess.run") as mock_run:
            mock_run.return_value = MagicMock(stdout="0xaddr", returncode=0)
            from base_agent import BaseAgent
            agent = BaseAgent("TestAgent")
            assert agent.get_tier(0) == ("NO_SOUL", 100)

    @patch("requests.post")
    @patch("subprocess.run")
    def test_think_calls_venice(self, mock_run, mock_post, mock_env):
        mock_run.return_value = MagicMock(stdout="0xaddr", returncode=0)
        mock_post.return_value = MagicMock(
            json=lambda: {"choices": [{"message": {"content": "AI response"}}]}
        )
        from base_agent import BaseAgent
        agent = BaseAgent("TestAgent")
        agent.token_id = 1
        result = agent.think("test prompt")
        assert "AI response" in result

    @patch("requests.post")
    @patch("subprocess.run")
    def test_think_handles_error(self, mock_run, mock_post, mock_env):
        mock_run.return_value = MagicMock(stdout="0xaddr", returncode=0)
        mock_post.side_effect = Exception("Connection failed")
        from base_agent import BaseAgent
        agent = BaseAgent("TestAgent")
        agent.token_id = 1
        result = agent.think("test prompt")
        assert "Error" in result
