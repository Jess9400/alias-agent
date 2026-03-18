"""
ALIAS Dynamic Registry — reads agents from on-chain Soul Contract.

Any agent that mints a soul becomes discoverable and hireable.
Falls back to hardcoded network_registry.py if chain queries fail.
"""

import logging
import os
import time
from typing import Optional

from dotenv import load_dotenv
from web3 import Web3

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

logger = logging.getLogger("alias.dynamic_registry")

CONTRACT = "0x0F2f94281F87793ee086a2B6517B6db450192874"
# Use publicnode for reads — no rate limiting, unlike mainnet.base.org
RPC_URL = os.getenv("ALIAS_RPC_URL", "https://base.publicnode.com")

# ABI for reading souls
SOUL_ABI = [
    {"inputs": [], "name": "totalSouls", "outputs": [{"type": "uint256"}], "stateMutability": "view", "type": "function"},
    {"inputs": [{"name": "tokenId", "type": "uint256"}], "name": "souls", "outputs": [
        {"name": "name", "type": "string"},
        {"name": "model", "type": "string"},
        {"name": "creator", "type": "address"},
        {"name": "birthBlock", "type": "uint256"},
        {"name": "description", "type": "string"},
        {"name": "exists", "type": "bool"},
    ], "stateMutability": "view", "type": "function"},
    {"inputs": [{"name": "tokenId", "type": "uint256"}], "name": "actionCount", "outputs": [{"type": "uint256"}], "stateMutability": "view", "type": "function"},
]

# SoulMinted event to get tokenId -> agent address mapping
SOUL_MINTED_EVENT_ABI = [{
    "anonymous": False,
    "inputs": [
        {"indexed": True, "name": "tokenId", "type": "uint256"},
        {"indexed": True, "name": "agent", "type": "address"},
        {"indexed": False, "name": "name", "type": "string"},
        {"indexed": False, "name": "creator", "type": "address"},
    ],
    "name": "SoulMinted",
    "type": "event",
}]

# Cache
_cache = {"agents": {}, "last_refresh": 0}
CACHE_TTL = 120  # seconds

# Default rate tiers based on action count
DEFAULT_BASE_RATE = 0.0003


def _parse_skills(description: str) -> list:
    """Parse skills from the description/skills field.

    Handles multiple on-chain formats:
    - "Skills: data-analysis, forecasting, reporting" (prefix format)
    - "trading, market-analysis, portfolio-management" (raw comma-separated)
    - "Giving AI agents a portable..." (natural language — returns general)
    """
    if not description:
        return ["general"]

    text = description

    # Extract from "Skills: x, y, z" pattern if present
    lower = text.lower()
    if "skills:" in lower:
        idx = lower.index("skills:") + len("skills:")
        text = text[idx:]

    # If most "skills" have spaces (look like sentence fragments), it's natural language
    parts = [s.strip() for s in text.split(",") if s.strip()]
    if parts:
        words_per_part = sum(len(p.split()) for p in parts) / len(parts)
        if words_per_part > 3:
            return ["general"]

    # Parse comma-separated skills
    skills = []
    for s in text.split(","):
        cleaned = s.strip().lower().replace(" ", "-")
        # Skip empty, very long, or sentence-like fragments
        if cleaned and len(cleaned) < 35 and cleaned.count("-") < 5:
            skills.append(cleaned)
    return skills if skills else ["general"]


def _estimate_rate(actions: int, skills: list) -> float:
    """Estimate hourly rate based on on-chain activity and skills."""
    # More experienced agents charge more
    if actions >= 20:
        base = 0.0008
    elif actions >= 10:
        base = 0.0005
    elif actions >= 5:
        base = 0.0003
    else:
        base = 0.0001
    # Specialized skills command premium
    premium_skills = {"code-audit", "security-review", "defi-analysis", "trading",
                      "vulnerability-detection", "legal-research", "compliance"}
    if any(s in premium_skills for s in skills):
        base *= 1.5
    return round(base, 6)


def refresh_registry() -> dict:
    """Query chain for all minted souls. Returns NETWORK_AGENTS-compatible dict."""
    now = time.time()
    if _cache["agents"] and (now - _cache["last_refresh"]) < CACHE_TTL:
        return _cache["agents"]

    try:
        w3 = Web3(Web3.HTTPProvider(RPC_URL))
        contract = w3.eth.contract(
            address=Web3.to_checksum_address(CONTRACT),
            abi=SOUL_ABI + SOUL_MINTED_EVENT_ABI,
        )

        total = contract.functions.totalSouls().call()
        if total == 0:
            logger.warning("No souls found on-chain")
            return _fallback()

        # Get SoulMinted events to map tokenId -> agent address
        # Use recent block range to avoid payload-too-large errors
        token_to_address = {}
        try:
            current_block = w3.eth.block_number
            # Scan in chunks of 50k blocks (RPC limit) from deploy block
            deploy_block = 43299420
            for start in range(deploy_block, current_block + 1, 50000):
                end = min(start + 49999, current_block)
                chunk = contract.events.SoulMinted.get_logs(from_block=start, to_block=end)
                for e in chunk:
                    token_to_address[e.args.tokenId] = e.args.agent
        except Exception as e:
            logger.warning(f"Event query failed ({e}), using creator as address fallback")

        agents = {}
        for token_id in range(1, total + 1):
            try:
                soul = contract.functions.souls(token_id).call()
                name, model, creator, birth_block, description, exists = soul

                if not exists or not name:
                    continue

                # Get agent address from events, fall back to creator
                address = token_to_address.get(token_id, creator)

                # Get action count for rate estimation
                try:
                    actions = contract.functions.actionCount(token_id).call()
                except Exception:
                    actions = 0

                # Small delay to avoid RPC rate limiting
                time.sleep(0.1)

                skills = _parse_skills(description)
                rate = _estimate_rate(actions, skills)

                agents[name] = {
                    "address": Web3.to_checksum_address(address),
                    "token_id": token_id,
                    "skills": skills,
                    "hourly_rate": rate,
                    "model": model,
                    "actions": actions,
                }
            except Exception as e:
                logger.warning(f"Failed to load soul #{token_id}: {e}")
                continue

        if agents:
            _cache["agents"] = agents
            _cache["last_refresh"] = now
            logger.info(f"Dynamic registry loaded: {len(agents)} agents from chain")
            return agents
        else:
            return _fallback()

    except Exception as e:
        logger.error(f"Chain query failed: {e}")
        return _fallback()


def _fallback() -> dict:
    """Fall back to hardcoded registry."""
    from network_registry import NETWORK_AGENTS
    logger.info("Using hardcoded fallback registry")
    return NETWORK_AGENTS


# === Public API (same interface as network_registry.py) ===

def get_agents() -> dict:
    """Get all agents (dynamic from chain, with fallback)."""
    return refresh_registry()


def get_agent_by_skill(skill: str) -> list:
    """Find agents by skill."""
    agents = get_agents()
    results = []
    for name, data in agents.items():
        if skill in data["skills"]:
            results.append({"name": name, **data})
    return results


find_by_skill = get_agent_by_skill


def find_by_address(addr: str) -> Optional[dict]:
    """Return first agent matching address."""
    agents = get_agents()
    for name, data in agents.items():
        if data["address"].lower() == addr.lower():
            return {"name": name, **data}
    return None


def find_all_by_address(addr: str) -> list:
    """Return all agents operated by this address."""
    agents = get_agents()
    return [{"name": n, **d} for n, d in agents.items() if d["address"].lower() == addr.lower()]


def find_by_token_id(token_id: int) -> Optional[dict]:
    """Return agent by token ID."""
    agents = get_agents()
    for name, data in agents.items():
        if data["token_id"] == token_id:
            return {"name": name, **data}
    return None


def all_skills() -> list:
    """Return all unique skills across all agents."""
    agents = get_agents()
    skills = set()
    for data in agents.values():
        skills.update(data["skills"])
    return sorted(skills)


# For backwards compatibility — acts like NETWORK_AGENTS dict
NETWORK_AGENTS = None  # lazy-loaded


def _get_network_agents():
    global NETWORK_AGENTS
    NETWORK_AGENTS = get_agents()
    return NETWORK_AGENTS


if __name__ == "__main__":
    agents = get_agents()
    print(f"\nALIAS Dynamic Registry: {len(agents)} agents from chain")
    for name, data in agents.items():
        print(f"  #{data['token_id']} {name}: {', '.join(data['skills'])} @ {data['hourly_rate']} ETH/hr")
    print(f"\nAll skills: {', '.join(all_skills())}")
