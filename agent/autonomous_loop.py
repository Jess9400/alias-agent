#!/usr/bin/env python3
"""
ALIAS Autonomous Loop Engine
=============================
Event-driven, self-directing agent that listens to on-chain events,
evaluates opportunities, executes jobs, and builds reputation — all
without Flask or any external orchestrator.

Contracts (Base Mainnet, chain 8453):
  SoulBound  : 0x0F2f94281F87793ee086a2B6517B6db450192874
  JobRegistry: 0x7Fa3c9C28447d6ED6671b49d537E728f678568C8
  VerifReg   : (deployed per-instance)

Run:
  python autonomous_loop.py                        # default moderate profile
  python autonomous_loop.py --risk aggressive      # high risk tolerance
  python autonomous_loop.py --max-jobs 5           # up to 5 concurrent jobs
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import signal
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Any, Optional

import requests
from dotenv import load_dotenv
from web3 import Web3
from eth_account import Account

# ---------------------------------------------------------------------------
# Env / constants
# ---------------------------------------------------------------------------
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

PRIVATE_KEY = os.getenv("PRIVATE_KEY", "")
VENICE_API_KEY = os.getenv("VENICE_API_KEY", "")
RPC_URL = os.getenv("RPC_URL", "https://mainnet.base.org")
CHAIN_ID = 8453

SOUL_CONTRACT = "0x0F2f94281F87793ee086a2B6517B6db450192874"
JOB_REGISTRY = "0x7Fa3c9C28447d6ED6671b49d537E728f678568C8"

# Minimal ABIs — only the functions / events we actually call
SOUL_ABI = [
    {"inputs": [{"name": "agent", "type": "address"}], "name": "hasSoul",
     "outputs": [{"type": "bool"}], "stateMutability": "view", "type": "function"},
    {"inputs": [{"name": "agent", "type": "address"}], "name": "agentToSoul",
     "outputs": [{"type": "uint256"}], "stateMutability": "view", "type": "function"},
    {"inputs": [{"name": "tokenId", "type": "uint256"}], "name": "actionCount",
     "outputs": [{"type": "uint256"}], "stateMutability": "view", "type": "function"},
    {"inputs": [], "name": "totalSouls",
     "outputs": [{"type": "uint256"}], "stateMutability": "view", "type": "function"},
]

JOB_ABI = [
    {"inputs": [{"name": "tokenId", "type": "uint256"},
                {"name": "escrowId", "type": "string"},
                {"name": "message", "type": "string"}],
     "name": "recordJob", "outputs": [], "stateMutability": "nonpayable", "type": "function"},
    {"inputs": [{"name": "tokenId", "type": "uint256"}], "name": "getJobCount",
     "outputs": [{"type": "uint256"}], "stateMutability": "view", "type": "function"},
    {"anonymous": False,
     "inputs": [
         {"indexed": True, "name": "tokenId", "type": "uint256"},
         {"indexed": True, "name": "recorder", "type": "address"},
         {"indexed": False, "name": "escrowId", "type": "string"},
         {"indexed": False, "name": "timestamp", "type": "uint256"},
         {"indexed": False, "name": "message", "type": "string"},
     ],
     "name": "JobCompleted", "type": "event"},
]

# ReputationEngine on-chain (primary reputation source)
REPUTATION_ENGINE = "0x154057f3899A39142cD351FecB5619e2F3B78324"
REPUTATION_ABI = [
    {"inputs": [{"name": "tokenId", "type": "uint256"}],
     "name": "calculateReputation",
     "outputs": [{"type": "uint256"}],
     "stateMutability": "view", "type": "function"},
]

log = logging.getLogger("alias.loop")


# ---------------------------------------------------------------------------
# Data types
# ---------------------------------------------------------------------------

class AgentState(Enum):
    IDLE = "IDLE"
    SCANNING = "SCANNING"
    EVALUATING = "EVALUATING"
    ACCEPTING = "ACCEPTING"
    EXECUTING = "EXECUTING"
    REPORTING = "REPORTING"


class RiskProfile(Enum):
    CONSERVATIVE = "conservative"
    MODERATE = "moderate"
    AGGRESSIVE = "aggressive"


class DecisionVerdict(Enum):
    ACCEPT = "ACCEPT"
    REJECT = "REJECT"
    NEGOTIATE = "NEGOTIATE"


@dataclass
class Decision:
    verdict: DecisionVerdict
    reasoning: str
    score: float  # 0-1 confidence
    timestamp: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )

    def to_dict(self) -> dict:
        return {
            "verdict": self.verdict.value,
            "reasoning": self.reasoning,
            "score": self.score,
            "timestamp": self.timestamp,
        }


@dataclass
class Job:
    job_id: str
    skill: str
    task: str
    budget_eth: float
    requester: str
    agent_name: str
    token_id: int
    status: str = "PENDING"
    result: Optional[str] = None
    tx_hash: Optional[str] = None
    started_at: Optional[str] = None
    completed_at: Optional[str] = None

    def to_dict(self) -> dict:
        return {k: v for k, v in self.__dict__.items() if v is not None}


@dataclass
class AgentStatus:
    state: AgentState
    active_jobs: int
    completed_jobs: int
    success_rate: float
    reputation: int
    tier: str
    uptime_seconds: float
    last_scan: Optional[str] = None


# ---------------------------------------------------------------------------
# Dynamic registry (on-chain discovery, falls back to hardcoded)
# ---------------------------------------------------------------------------
try:
    from dynamic_registry import get_agents, get_agent_by_skill
except ImportError:
    def get_agents() -> dict:
        return {}

    def get_agent_by_skill(skill: str) -> list:
        return []


# ---------------------------------------------------------------------------
# Persistent state (lightweight JSON file)
# ---------------------------------------------------------------------------
STATE_PATH = Path(__file__).resolve().parent / ".agent_state.json"


def _load_state() -> dict:
    if STATE_PATH.exists():
        try:
            return json.loads(STATE_PATH.read_text())
        except Exception:
            pass
    return {
        "decisions": [],
        "jobs": [],
        "stats": {"completed": 0, "failed": 0, "total_earned_eth": 0.0},
    }


def _save_state(state: dict) -> None:
    try:
        STATE_PATH.write_text(json.dumps(state, indent=2, default=str))
    except Exception as exc:
        log.warning("Failed to persist state: %s", exc)


# ---------------------------------------------------------------------------
# Venice AI helper
# ---------------------------------------------------------------------------

def _venice_chat(prompt: str, system: str = "", max_tokens: int = 300) -> str:
    """Blocking call to Venice AI.  Returns response text or empty string."""
    if not VENICE_API_KEY:
        return ""
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})
    try:
        r = requests.post(
            "https://api.venice.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {VENICE_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": "llama-3.3-70b",
                "messages": messages,
                "max_tokens": max_tokens,
            },
            timeout=30,
        )
        r.raise_for_status()
        return r.json()["choices"][0]["message"]["content"]
    except Exception as exc:
        log.warning("Venice AI error: %s", exc)
        return ""


# ---------------------------------------------------------------------------
# Reputation helpers
# ---------------------------------------------------------------------------
TIER_MAP = [
    (500, "LEGENDARY", 5),
    (200, "ELITE", 15),
    (100, "TRUSTED", 30),
    (50, "VERIFIED", 50),
    (1, "NEWCOMER", 70),
]


def _tier_from_rep(rep: int) -> tuple:
    for threshold, name, risk in TIER_MAP:
        if rep >= threshold:
            return name, risk
    return "NO_SOUL", 100


RISK_THRESHOLDS = {
    RiskProfile.CONSERVATIVE: 30,
    RiskProfile.MODERATE: 50,
    RiskProfile.AGGRESSIVE: 75,
}

FAIR_RATE = {
    # skill -> min ETH we accept per job
    "data-analysis": 0.0002,
    "smart-contract-audit": 0.0005,
    "code-generation": 0.0003,
    "market-research": 0.0002,
    "risk-assessment": 0.0004,
    "code-audit": 0.0005,
    "defi-analysis": 0.0004,
    "writing": 0.0001,
    "research": 0.0003,
}


# ---------------------------------------------------------------------------
# Core engine
# ---------------------------------------------------------------------------

class AutonomousLoop:
    """
    Self-driving agent loop.

    Lifecycle per tick:
        IDLE -> SCANNING -> EVALUATING -> ACCEPTING -> EXECUTING -> REPORTING -> IDLE

    Multiple jobs can run concurrently up to ``max_concurrent_jobs``.
    """

    def __init__(self, agent_config: dict | None = None):
        cfg = agent_config or {}

        # Identity
        self.name: str = cfg.get("name", "ALIAS-Alpha")
        self.skills: list[str] = cfg.get(
            "skills",
            ["autonomous", "verification", "risk-assessment", "collaboration"],
        )
        self.risk_profile: RiskProfile = RiskProfile(
            cfg.get("risk", "moderate")
        )
        self.max_concurrent_jobs: int = cfg.get("max_jobs", 3)
        self.min_payment_eth: float = cfg.get("min_payment_eth", 0.0001)
        self.scan_interval: int = cfg.get("scan_interval", 60)  # seconds

        # Web3
        self._w3 = Web3(Web3.HTTPProvider(RPC_URL))
        self._account = Account.from_key(PRIVATE_KEY) if PRIVATE_KEY else None
        self._soul = self._w3.eth.contract(
            address=Web3.to_checksum_address(SOUL_CONTRACT), abi=SOUL_ABI
        )
        self._jobs_contract = self._w3.eth.contract(
            address=Web3.to_checksum_address(JOB_REGISTRY), abi=JOB_ABI
        )
        self._rep_engine = self._w3.eth.contract(
            address=Web3.to_checksum_address(REPUTATION_ENGINE),
            abi=REPUTATION_ABI,
        )

        # Runtime
        self._state = AgentState.IDLE
        self._active_jobs: dict[str, Job] = {}
        self._persistent = _load_state()
        self._start_time = time.monotonic()
        self._last_block: int = 0
        self._shutdown = asyncio.Event()
        self._token_id: int | None = None
        self._reputation: int = 0

        log.info(
            "AutonomousLoop initialised  name=%s  risk=%s  max_jobs=%d  wallet=%s",
            self.name,
            self.risk_profile.value,
            self.max_concurrent_jobs,
            self._account.address if self._account else "NO_KEY",
        )

    # ------------------------------------------------------------------
    # Reputation helper
    # ------------------------------------------------------------------

    def _fetch_reputation(self, token_id: int) -> int:
        """Query ReputationEngine on-chain; fall back to local formula."""
        try:
            return self._rep_engine.functions.calculateReputation(token_id).call()
        except Exception as exc:
            log.debug("ReputationEngine call failed, using local fallback: %s", exc)
        # Fallback: actions * 20
        try:
            actions = self._soul.functions.actionCount(token_id).call()
            return actions * 20
        except Exception:
            return 0

    # ------------------------------------------------------------------
    # Public interface
    # ------------------------------------------------------------------

    async def start(self) -> None:
        """Main entry point — runs until ``stop()`` is called or signal."""
        log.info("Starting autonomous loop ...")
        if not self._bootstrap():
            log.error("Bootstrap failed (no soul?). Exiting.")
            return

        tasks = [
            asyncio.create_task(self._scan_loop(), name="scanner"),
            asyncio.create_task(self._event_poll_loop(), name="event-poller"),
            asyncio.create_task(self._reputation_loop(), name="rep-builder"),
            asyncio.create_task(self._watchdog_loop(), name="watchdog"),
        ]
        log.info("All subsystems running.  Ctrl-C to stop.")
        await self._shutdown.wait()
        for t in tasks:
            t.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
        _save_state(self._persistent)
        log.info("Autonomous loop stopped cleanly.")

    def stop(self) -> None:
        """Request graceful shutdown of all subsystems."""
        self._shutdown.set()

    def get_status(self) -> AgentStatus:
        """Snapshot of current agent state for external consumers."""
        stats = self._persistent["stats"]
        total = stats["completed"] + stats["failed"]
        rate = stats["completed"] / total if total else 1.0
        tier, _ = _tier_from_rep(self._reputation)
        return AgentStatus(
            state=self._state,
            active_jobs=len(self._active_jobs),
            completed_jobs=stats["completed"],
            success_rate=round(rate, 3),
            reputation=self._reputation,
            tier=tier,
            uptime_seconds=round(time.monotonic() - self._start_time, 1),
            last_scan=self._persistent.get("last_scan"),
        )

    def get_decision_log(self) -> list:
        """Return the full audit trail of autonomous decisions."""
        return list(self._persistent.get("decisions", []))

    # ------------------------------------------------------------------
    # Bootstrap
    # ------------------------------------------------------------------

    def _bootstrap(self) -> bool:
        """Verify on-chain identity and cache token_id / reputation."""
        if not self._account:
            log.error("PRIVATE_KEY not set — cannot operate.")
            return False
        addr = self._account.address
        try:
            has = self._soul.functions.hasSoul(
                Web3.to_checksum_address(addr)
            ).call()
            if not has:
                log.error("Wallet %s has no soul-bound token.", addr)
                return False
            self._token_id = self._soul.functions.agentToSoul(
                Web3.to_checksum_address(addr)
            ).call()
            actions = self._soul.functions.actionCount(self._token_id).call()
            self._reputation = self._fetch_reputation(self._token_id)
            tier, risk = _tier_from_rep(self._reputation)
            log.info(
                "Soul verified  token=#%d  actions=%d  rep=%d  tier=%s  risk=%d%%",
                self._token_id, actions, self._reputation, tier, risk,
            )
            self._last_block = self._w3.eth.block_number
            return True
        except Exception as exc:
            log.error("Bootstrap chain call failed: %s", exc)
            return False

    # ------------------------------------------------------------------
    # Decision engine
    # ------------------------------------------------------------------

    async def evaluate_opportunity(self, event: dict) -> Decision:
        """
        Core decision function.

        Fast-path rules checked first (skill match, budget, risk).
        Falls through to Venice AI for ambiguous cases.
        """
        self._state = AgentState.EVALUATING
        skill = event.get("skill", "")
        budget = event.get("budget_eth", 0.0)
        requester_addr = event.get("requester_address", "")

        # 1. Skill match -------------------------------------------------
        if skill and skill not in self.skills:
            return self._log_decision(
                Decision(
                    DecisionVerdict.REJECT,
                    f"Skill '{skill}' not in my capabilities {self.skills}",
                    0.95,
                )
            )

        # 2. Budget check ------------------------------------------------
        min_rate = FAIR_RATE.get(skill, self.min_payment_eth)
        if budget < min_rate:
            return self._log_decision(
                Decision(
                    DecisionVerdict.NEGOTIATE,
                    f"Budget {budget} ETH below fair rate {min_rate} ETH for '{skill}'",
                    0.85,
                )
            )

        # 3. Capacity check ----------------------------------------------
        if len(self._active_jobs) >= self.max_concurrent_jobs:
            return self._log_decision(
                Decision(
                    DecisionVerdict.REJECT,
                    f"At capacity ({self.max_concurrent_jobs} concurrent jobs)",
                    0.99,
                )
            )

        # 4. On-chain reputation of requester ----------------------------
        requester_risk = 100
        if requester_addr:
            try:
                ck = Web3.to_checksum_address(requester_addr)
                has = self._soul.functions.hasSoul(ck).call()
                if has:
                    tid = self._soul.functions.agentToSoul(ck).call()
                    requester_rep = self._fetch_reputation(tid)
                    _, requester_risk = _tier_from_rep(requester_rep)
            except Exception:
                pass

        risk_threshold = RISK_THRESHOLDS[self.risk_profile]
        if requester_risk > risk_threshold:
            return self._log_decision(
                Decision(
                    DecisionVerdict.REJECT,
                    (
                        f"Requester risk {requester_risk}% exceeds "
                        f"{self.risk_profile.value} threshold {risk_threshold}%"
                    ),
                    0.80,
                )
            )

        # 5. AI reasoning for edge cases ---------------------------------
        ai_prompt = (
            f"I am {self.name} (rep {self._reputation}). "
            f"A job request: skill={skill}, budget={budget} ETH, "
            f"requester_risk={requester_risk}%. "
            f"My risk profile is {self.risk_profile.value}. "
            f"Should I ACCEPT? Reply ACCEPT or REJECT with one-sentence reason."
        )
        ai_response = await asyncio.to_thread(_venice_chat, ai_prompt)
        if "REJECT" in ai_response.upper():
            return self._log_decision(
                Decision(DecisionVerdict.REJECT, f"AI: {ai_response}", 0.60)
            )

        return self._log_decision(
            Decision(
                DecisionVerdict.ACCEPT,
                f"Passed all checks. AI: {ai_response}",
                0.90,
            )
        )

    # ------------------------------------------------------------------
    # Job execution
    # ------------------------------------------------------------------

    async def execute_job(self, job: Job) -> Job:
        """Run a job using Venice AI and return the updated Job."""
        self._state = AgentState.EXECUTING
        job.status = "RUNNING"
        job.started_at = datetime.now(timezone.utc).isoformat()
        self._active_jobs[job.job_id] = job
        log.info(
            "[EXEC] %s  skill=%s  task=%s",
            job.job_id, job.skill, job.task[:80],
        )

        system_prompt = (
            f"You are {job.agent_name}, an AI agent on the ALIAS network. "
            f"Tier: {_tier_from_rep(self._reputation)[0]}. "
            f"Skills: {', '.join(self.skills)}. "
            f"Complete this job professionally. Be thorough but concise "
            f"(max 2 paragraphs)."
        )
        result_text = await asyncio.to_thread(
            _venice_chat, f"Job: {job.task}", system_prompt, 600
        )
        if result_text:
            job.result = result_text
            job.status = "DONE"
        else:
            job.result = "Execution failed — AI backend unreachable."
            job.status = "FAILED"

        job.completed_at = datetime.now(timezone.utc).isoformat()
        return job

    async def report_completion(self, job: Job) -> Job:
        """Record job completion on-chain and update persistent state."""
        self._state = AgentState.REPORTING
        if job.status != "DONE" or not self._account or not self._token_id:
            self._finalise_job(job)
            return job

        try:
            msg = f"Auto: {job.task[:60]}"
            tx = self._jobs_contract.functions.recordJob(
                self._token_id, job.job_id, msg
            ).build_transaction(
                {
                    "from": self._account.address,
                    "nonce": self._w3.eth.get_transaction_count(
                        self._account.address
                    ),
                    "gas": 300_000,
                    "gasPrice": self._w3.eth.gas_price,
                    "chainId": CHAIN_ID,
                }
            )
            signed = self._account.sign_transaction(tx)
            tx_hash = self._w3.eth.send_raw_transaction(
                signed.raw_transaction
            )
            job.tx_hash = tx_hash.hex()
            log.info(
                "[CHAIN] Job %s recorded  tx=%s", job.job_id, job.tx_hash
            )
        except Exception as exc:
            log.warning(
                "[CHAIN] Record failed for %s: %s", job.job_id, exc
            )

        self._finalise_job(job)
        return job

    # ------------------------------------------------------------------
    # Autonomous behaviours (background loops)
    # ------------------------------------------------------------------

    async def _scan_loop(self) -> None:
        """Periodically scan the network registry for open opportunities."""
        while not self._shutdown.is_set():
            try:
                await self.scan_opportunities()
            except Exception as exc:
                log.error("scan_opportunities error: %s", exc)
            try:
                await asyncio.wait_for(
                    self._shutdown.wait(), timeout=self.scan_interval
                )
                return  # shutdown requested
            except asyncio.TimeoutError:
                pass

    async def scan_opportunities(self) -> None:
        """Look for jobs in the network registry matching our skills."""
        self._state = AgentState.SCANNING
        self._persistent["last_scan"] = datetime.now(timezone.utc).isoformat()
        log.debug("Scanning for opportunities ...")

        for skill in self.skills:
            candidates = get_agent_by_skill(skill)
            for cand in candidates:
                own_addr = (
                    self._account.address.lower() if self._account else ""
                )
                if cand.get("address", "").lower() == own_addr:
                    continue  # skip self

                event = {
                    "type": "opportunity",
                    "skill": skill,
                    "budget_eth": cand.get("hourly_rate", 0.0),
                    "requester_address": cand.get("address", ""),
                    "task": (
                        f"Provide {skill} services for "
                        f"{cand.get('name', 'unknown')}"
                    ),
                    "agent_name": cand.get("name", ""),
                    "token_id": cand.get("token_id", 0),
                }
                decision = await self.evaluate_opportunity(event)
                if decision.verdict == DecisionVerdict.ACCEPT:
                    job = Job(
                        job_id=f"AUTO-{int(time.time())}-{skill[:8]}",
                        skill=skill,
                        task=event["task"],
                        budget_eth=event["budget_eth"],
                        requester=event["agent_name"],
                        agent_name=self.name,
                        token_id=event["token_id"],
                    )
                    job = await self.execute_job(job)
                    await self.report_completion(job)

        self._state = AgentState.IDLE

    async def _event_poll_loop(self) -> None:
        """Poll for new JobCompleted events on the JobRegistry contract."""
        while not self._shutdown.is_set():
            try:
                current = self._w3.eth.block_number
                if current > self._last_block:
                    from_block = max(
                        self._last_block + 1, current - 50
                    )
                    event_filter = (
                        self._jobs_contract.events.JobCompleted.create_filter(
                            fromBlock=from_block, toBlock=current
                        )
                    )
                    for entry in event_filter.get_all_entries():
                        await self._handle_chain_event(entry)
                    self._last_block = current
            except Exception as exc:
                log.debug("Event poll error (non-fatal): %s", exc)
            try:
                await asyncio.wait_for(
                    self._shutdown.wait(), timeout=30
                )
                return
            except asyncio.TimeoutError:
                pass

    async def _handle_chain_event(self, entry: Any) -> None:
        """React to a single on-chain event."""
        args = entry.get("args", {})
        token_id = args.get("tokenId")
        escrow_id = args.get("escrowId", "")
        log.info(
            "[EVENT] JobCompleted  token=#%s  escrow=%s",
            token_id, escrow_id,
        )
        # If the event concerns our token, refresh reputation
        if token_id == self._token_id:
            try:
                self._reputation = self._fetch_reputation(self._token_id)
            except Exception:
                pass

    async def _reputation_loop(self) -> None:
        """Periodically refresh on-chain reputation and log progress."""
        while not self._shutdown.is_set():
            await self.build_reputation()
            try:
                await asyncio.wait_for(
                    self._shutdown.wait(), timeout=300
                )
                return
            except asyncio.TimeoutError:
                pass

    async def build_reputation(self) -> None:
        """Refresh reputation from chain and adjust pricing if needed."""
        if not self._token_id:
            return
        try:
            old = self._reputation
            self._reputation = self._fetch_reputation(self._token_id)
            tier, _ = _tier_from_rep(self._reputation)
            if self._reputation != old:
                log.info(
                    "[REP] Updated %d -> %d  tier=%s",
                    old, self._reputation, tier,
                )
            # Self-improvement: tighten pricing as reputation grows
            stats = self._persistent["stats"]
            total = stats["completed"] + stats["failed"]
            if total > 0:
                rate = stats["completed"] / total
                if rate < 0.7:
                    log.info(
                        "[SELF] Success rate %.0f%% — considering "
                        "reducing job load",
                        rate * 100,
                    )
        except Exception as exc:
            log.debug("Reputation refresh error: %s", exc)

    async def _watchdog_loop(self) -> None:
        """Sybil / anomaly detection — suspicious verification patterns."""
        while not self._shutdown.is_set():
            await self.detect_anomalies()
            try:
                await asyncio.wait_for(
                    self._shutdown.wait(), timeout=600
                )
                return
            except asyncio.TimeoutError:
                pass

    async def detect_anomalies(self) -> None:
        """Basic sybil detection: flag tokens with abnormally high action
        counts relative to network average."""
        try:
            total_souls = self._soul.functions.totalSouls().call()
            flagged = 0
            for tid in range(1, min(total_souls + 1, 20)):
                rep = self._fetch_reputation(tid)
                if rep > 1000:
                    log.warning(
                        "[WATCHDOG] Token #%d has %d rep "
                        "— possible anomaly",
                        tid, rep,
                    )
                    flagged += 1
            if flagged:
                log.warning(
                    "[WATCHDOG] %d anomalous token(s) detected", flagged
                )
        except Exception as exc:
            log.debug("Watchdog error: %s", exc)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _log_decision(self, decision: Decision) -> Decision:
        """Persist decision to audit trail and log it."""
        entry = decision.to_dict()
        self._persistent.setdefault("decisions", []).append(entry)
        # Keep last 200 decisions in memory
        if len(self._persistent["decisions"]) > 200:
            self._persistent["decisions"] = self._persistent["decisions"][-200:]
        _save_state(self._persistent)
        log.info(
            "[DECISION] %s  score=%.2f  %s",
            decision.verdict.value, decision.score,
            decision.reasoning[:120],
        )
        return decision

    def _finalise_job(self, job: Job) -> None:
        """Move job from active to persistent history and update stats."""
        self._active_jobs.pop(job.job_id, None)
        stats = self._persistent["stats"]
        if job.status == "DONE":
            stats["completed"] += 1
            stats["total_earned_eth"] += job.budget_eth
        else:
            stats["failed"] += 1
        self._persistent.setdefault("jobs", []).append(job.to_dict())
        if len(self._persistent["jobs"]) > 500:
            self._persistent["jobs"] = self._persistent["jobs"][-500:]
        _save_state(self._persistent)
        self._state = AgentState.IDLE


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(
        description="ALIAS Autonomous Agent Loop"
    )
    parser.add_argument(
        "--risk",
        choices=["conservative", "moderate", "aggressive"],
        default="moderate",
    )
    parser.add_argument("--max-jobs", type=int, default=3)
    parser.add_argument(
        "--scan-interval", type=int, default=60,
        help="Seconds between opportunity scans",
    )
    parser.add_argument(
        "--min-payment", type=float, default=0.0001,
        help="Minimum ETH per job",
    )
    parser.add_argument("--name", type=str, default="ALIAS-Alpha")
    parser.add_argument("--verbose", action="store_true")
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s [%(name)s] %(levelname)s %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    config = {
        "name": args.name,
        "risk": args.risk,
        "max_jobs": args.max_jobs,
        "scan_interval": args.scan_interval,
        "min_payment_eth": args.min_payment,
    }

    loop = AutonomousLoop(config)

    async def _run() -> None:
        aloop = asyncio.get_running_loop()
        for sig in (signal.SIGINT, signal.SIGTERM):
            aloop.add_signal_handler(sig, loop.stop)
        await loop.start()

    asyncio.run(_run())


if __name__ == "__main__":
    main()
