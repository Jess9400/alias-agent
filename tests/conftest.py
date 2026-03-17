"""Shared pytest fixtures for ALIAS agent tests."""

import os
import sys
import pytest
from unittest.mock import MagicMock, patch

# Add agent directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'agent'))


@pytest.fixture
def mock_env(monkeypatch):
    """Set up environment variables for testing."""
    monkeypatch.setenv("PRIVATE_KEY", "0x" + "ab" * 32)
    monkeypatch.setenv("RPC_URL", "https://mainnet.base.org")
    monkeypatch.setenv("VENICE_API_KEY", "test-venice-key")
    monkeypatch.setenv("BANKR_API_KEY", "test-bankr-key")
    monkeypatch.setenv("PINATA_JWT", "test-pinata-jwt")


@pytest.fixture
def mock_subprocess():
    """Mock subprocess.run for cast calls."""
    with patch("subprocess.run") as mock:
        mock.return_value = MagicMock(
            stdout="0x0000000000000000000000000000000000000000000000000000000000000001",
            stderr="",
            returncode=0,
        )
        yield mock


@pytest.fixture
def mock_venice():
    """Mock Venice AI API responses."""
    with patch("requests.post") as mock:
        mock.return_value = MagicMock(
            status_code=200,
            json=lambda: {
                "choices": [{"message": {"content": "This is a test AI response."}}]
            },
        )
        mock.return_value.raise_for_status = lambda: None
        yield mock


@pytest.fixture
def mock_web3():
    """Mock web3 provider and contracts."""
    with patch("web3.Web3") as MockWeb3:
        mock_w3 = MagicMock()
        mock_w3.eth.block_number = 12345678
        mock_w3.eth.gas_price = 1000000000
        mock_w3.eth.get_transaction_count.return_value = 0
        mock_w3.eth.send_raw_transaction.return_value = b'\x12' * 32
        mock_w3.to_wei.return_value = 100000000000000
        mock_w3.to_checksum_address = lambda x: x

        MockWeb3.return_value = mock_w3
        MockWeb3.HTTPProvider = MagicMock()
        MockWeb3.to_checksum_address = lambda x: x

        yield mock_w3
