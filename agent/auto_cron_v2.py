#!/usr/bin/env python3
"""
ALIAS Auto-Cron V2 — Multi-Agent Orchestrator
================================================
Production orchestrator that manages multiple autonomous agents,
scheduled tasks, event processing, and fleet monitoring.
"""

import asyncio
import json
import logging
import os
import signal
import sys
import time
from dataclasses import dataclass, field, asdict
from datetime import datetime
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")
logger = logging.getLogger("alias.orchestrator")


# ======================== CONFIG ========================

@dataclass
class AgentConfig:
    name: str
    token_id: int
    skills: list
    risk_profile: str = "moderate"
    hourly_rate: float = 0.0003


@dataclass
class OrchestratorConfig:
    agents: list = field(default_factory=list)
    scan_interval: int = 120        # seconds
    reputation_refresh: int = 300
    sybil_check: int = 900
    health_check: int = 60
    event_index: int = 30
    decay_application: int = 3600
    max_concurrent_jobs: int = 10
    log_level: str = "INFO"
    state_file: str = "data/orchestrator_state.json"


# ======================== AGENT INSTANCE ========================

@dataclass
class AgentInstance:
    config: AgentConfig
    status: str = "idle"           # idle, scanning, executing, error
    last_heartbeat: float = 0.0
    jobs_completed: int = 0
    jobs_failed: int = 0
    total_earned: float = 0.0
    task: Optional[asyncio.Task] = None

    def to_dict(self) -> dict:
        return {
            "name": self.config.name, "token_id": self.config.token_id,
            "skills": self.config.skills, "status": self.status,
            "last_heartbeat": self.last_heartbeat,
            "jobs_completed": self.jobs_completed, "jobs_failed": self.jobs_failed,
            "uptime_healthy": time.time() - self.last_heartbeat < 120 if self.last_heartbeat else False,
        }


# ======================== EVENT QUEUE ========================

@dataclass
class Event:
    type: str          # escrow_created, verification, job_completed
    priority: int      # 1=highest, 5=lowest
    data: dict = field(default_factory=dict)
    timestamp: float = field(default_factory=time.time)
    retries: int = 0


class EventQueue:
    """Priority event queue with dead letter support."""

    def __init__(self, max_retries: int = 3):
        self._queue: list[Event] = []
        self._dead_letters: list[Event] = []
        self.max_retries = max_retries
        self.processed = 0

    def push(self, event: Event):
        self._queue.append(event)
        self._queue.sort(key=lambda e: e.priority)

    def pop(self) -> Optional[Event]:
        return self._queue.pop(0) if self._queue else None

    def retry(self, event: Event):
        event.retries += 1
        if event.retries >= self.max_retries:
            self._dead_letters.append(event)
            logger.warning(f"Event moved to dead letter: {event.type}")
        else:
            self.push(event)

    @property
    def size(self) -> int:
        return len(self._queue)

    @property
    def dead_letter_count(self) -> int:
        return len(self._dead_letters)


# ======================== FLEET MANAGER ========================

class AgentFleet:
    """Manage multiple autonomous agent instances."""

    def __init__(self, configs: list[AgentConfig]):
        self.agents: dict[int, AgentInstance] = {}
        for cfg in configs:
            self.agents[cfg.token_id] = AgentInstance(config=cfg)

    async def start_all(self):
        """Start all agents."""
        for agent in self.agents.values():
            agent.status = "idle"
            agent.last_heartbeat = time.time()
            logger.info(f"Agent started: {agent.config.name} (Token #{agent.config.token_id})")

    async def stop_all(self):
        """Gracefully stop all agents."""
        for agent in self.agents.values():
            if agent.task and not agent.task.done():
                agent.task.cancel()
            agent.status = "stopped"
            logger.info(f"Agent stopped: {agent.config.name}")

    def get_agent(self, token_id: int) -> Optional[AgentInstance]:
        return self.agents.get(token_id)

    def get_fleet_status(self) -> dict:
        return {
            "total_agents": len(self.agents),
            "active": sum(1 for a in self.agents.values() if a.status in ("idle", "scanning", "executing")),
            "total_jobs": sum(a.jobs_completed for a in self.agents.values()),
            "total_failed": sum(a.jobs_failed for a in self.agents.values()),
            "agents": [a.to_dict() for a in self.agents.values()],
        }

    async def assign_job(self, skill: str) -> Optional[AgentInstance]:
        """Find best available agent for a skill."""
        candidates = [
            a for a in self.agents.values()
            if skill in a.config.skills and a.status == "idle"
        ]
        if not candidates:
            return None
        # Prefer agent with more completions (proven track record)
        return max(candidates, key=lambda a: a.jobs_completed)


# ======================== ORCHESTRATOR ========================

class Orchestrator:
    """Production multi-agent orchestrator."""

    def __init__(self, config: OrchestratorConfig):
        self.config = config
        self.fleet = AgentFleet([AgentConfig(**a) if isinstance(a, dict) else a for a in config.agents])
        self.event_queue = EventQueue()
        self._shutdown = False
        self._start_time = time.time()
        self._state_path = Path(config.state_file)
        self._state_path.parent.mkdir(parents=True, exist_ok=True)

        # Task references
        self._tasks: list[asyncio.Task] = []

    # ======================== LIFECYCLE ========================

    async def start(self):
        """Start orchestrator and all scheduled tasks."""
        logger.info("=" * 60)
        logger.info("   ALIAS ORCHESTRATOR V2 STARTING")
        logger.info(f"   Agents: {len(self.config.agents)}")
        logger.info(f"   Scan interval: {self.config.scan_interval}s")
        logger.info("=" * 60)

        # Signal handlers
        loop = asyncio.get_event_loop()
        for sig in (signal.SIGTERM, signal.SIGINT):
            loop.add_signal_handler(sig, self._handle_shutdown)

        # Load state
        self._load_state()

        # Start fleet
        await self.fleet.start_all()

        # Launch scheduled tasks
        self._tasks = [
            asyncio.create_task(self._schedule(self._health_check, self.config.health_check, "health")),
            asyncio.create_task(self._schedule(self._scan_opportunities, self.config.scan_interval, "scan")),
            asyncio.create_task(self._schedule(self._refresh_reputation, self.config.reputation_refresh, "reputation")),
            asyncio.create_task(self._schedule(self._sybil_watchdog, self.config.sybil_check, "sybil")),
            asyncio.create_task(self._schedule(self._index_events, self.config.event_index, "events")),
            asyncio.create_task(self._process_events()),
        ]

        try:
            await asyncio.gather(*self._tasks)
        except asyncio.CancelledError:
            pass

        await self._graceful_shutdown()

    def _handle_shutdown(self):
        logger.info("Shutdown signal received")
        self._shutdown = True
        for task in self._tasks:
            task.cancel()

    async def _graceful_shutdown(self):
        """Save state and stop agents."""
        logger.info("Graceful shutdown...")
        self._save_state()
        await self.fleet.stop_all()
        logger.info("Orchestrator stopped")

    # ======================== SCHEDULED TASKS ========================

    async def _schedule(self, func, interval: int, name: str):
        """Run a function on a schedule."""
        while not self._shutdown:
            try:
                await func()
            except Exception as e:
                logger.error(f"[{name}] Error: {e}")
            await asyncio.sleep(interval)

    async def _health_check(self):
        """Check all agents are responsive."""
        now = time.time()
        for agent in self.fleet.agents.values():
            if agent.status == "stopped":
                continue
            age = now - agent.last_heartbeat if agent.last_heartbeat else float('inf')
            if age > 300:
                logger.warning(f"Agent {agent.config.name} unresponsive ({age:.0f}s since heartbeat)")
                agent.status = "error"
            else:
                agent.last_heartbeat = now

    async def _scan_opportunities(self):
        """Scan blockchain for new opportunities."""
        from web3 import Web3
        try:
            w3 = Web3(Web3.HTTPProvider(os.getenv("RPC_URL", "https://mainnet.base.org")))
            block = w3.eth.block_number
            logger.info(f"[scan] Block {block}, queue size: {self.event_queue.size}")

            # In production, would filter EscrowCreated events from escrow contract
            # For now, log the scan
            for agent in self.fleet.agents.values():
                if agent.status == "idle":
                    agent.status = "scanning"
                    await asyncio.sleep(0.1)
                    agent.status = "idle"

        except Exception as e:
            logger.error(f"[scan] Error: {e}")

    async def _refresh_reputation(self):
        """Refresh all agent reputations from chain."""
        logger.info("[reputation] Refreshing...")
        try:
            from web3 import Web3
            w3 = Web3(Web3.HTTPProvider(os.getenv("RPC_URL", "https://mainnet.base.org")))
            soul_abi = [{"inputs": [{"name": "tokenId", "type": "uint256"}], "name": "actionCount", "outputs": [{"type": "uint256"}], "stateMutability": "view", "type": "function"}]
            soul = w3.eth.contract(address=Web3.to_checksum_address("0x0F2f94281F87793ee086a2B6517B6db450192874"), abi=soul_abi)

            for agent in self.fleet.agents.values():
                try:
                    actions = soul.functions.actionCount(agent.config.token_id).call()
                    logger.debug(f"  {agent.config.name}: {actions} actions")
                except Exception:
                    pass
        except Exception as e:
            logger.error(f"[reputation] Error: {e}")

    async def _sybil_watchdog(self):
        """Run sybil detection."""
        logger.info("[sybil] Running watchdog...")
        try:
            from graph_reputation import GraphReputationEngine
            engine = GraphReputationEngine()
            engine.refresh_sync()
            clusters = engine.sybil_clusters
            if clusters:
                logger.warning(f"[sybil] {len(clusters)} suspicious clusters detected")
                for c in clusters:
                    logger.warning(f"  Agents {c.agents}: {c.evidence}")
        except ImportError:
            logger.debug("[sybil] graph_reputation not available")
        except Exception as e:
            logger.error(f"[sybil] Error: {e}")

    async def _index_events(self):
        """Index new on-chain events."""
        # In production, would pull events from all contracts
        pass

    # ======================== EVENT PROCESSING ========================

    async def _process_events(self):
        """Process events from the queue."""
        while not self._shutdown:
            event = self.event_queue.pop()
            if event:
                try:
                    await self._handle_event(event)
                    self.event_queue.processed += 1
                except Exception as e:
                    logger.error(f"Event processing failed: {e}")
                    self.event_queue.retry(event)
            else:
                await asyncio.sleep(1)

    async def _handle_event(self, event: Event):
        """Route events to appropriate handlers."""
        if event.type == "escrow_created":
            skill = event.data.get("skill", "general")
            agent = await self.fleet.assign_job(skill)
            if agent:
                logger.info(f"Assigned escrow to {agent.config.name}")
                agent.status = "executing"
                await asyncio.sleep(1)  # Placeholder for actual execution
                agent.jobs_completed += 1
                agent.status = "idle"

        elif event.type == "verification":
            logger.info(f"Verification event: {event.data}")

        elif event.type == "job_completed":
            logger.info(f"Job completion event: {event.data}")

    # ======================== STATE PERSISTENCE ========================

    def _save_state(self):
        """Save orchestrator state to disk."""
        state = {
            "timestamp": time.time(),
            "uptime": time.time() - self._start_time,
            "fleet": self.fleet.get_fleet_status(),
            "queue": {"size": self.event_queue.size, "processed": self.event_queue.processed, "dead_letters": self.event_queue.dead_letter_count},
        }
        try:
            self._state_path.write_text(json.dumps(state, indent=2))
            logger.info(f"State saved to {self._state_path}")
        except Exception as e:
            logger.error(f"State save failed: {e}")

    def _load_state(self):
        """Load state from disk if available."""
        if self._state_path.exists():
            try:
                state = json.loads(self._state_path.read_text())
                logger.info(f"Loaded state from {self._state_path} (last saved {state.get('timestamp', 'unknown')})")
            except Exception:
                pass

    # ======================== STATUS ========================

    def get_status(self) -> dict:
        return {
            "uptime": time.time() - self._start_time,
            "fleet": self.fleet.get_fleet_status(),
            "queue": {"size": self.event_queue.size, "processed": self.event_queue.processed},
            "shutdown_requested": self._shutdown,
        }


# ======================== DEFAULT AGENTS ========================

_FALLBACK_AGENTS = [
    AgentConfig("ALIAS-Prime", 1, ["general", "coordination"], "moderate", 0.0001),
    AgentConfig("ALIAS-Alpha", 2, ["autonomous", "verification", "risk-assessment", "collaboration"], "moderate", 0.0005),
    AgentConfig("DataMind", 3, ["data-analysis", "forecasting", "reporting"], "conservative", 0.0003),
    AgentConfig("SecureBot", 4, ["code-audit", "vulnerability-detection", "security-review"], "conservative", 0.0008),
    AgentConfig("CreativeAI", 5, ["writing", "marketing", "documentation"], "aggressive", 0.0002),
    AgentConfig("DeFiSage", 6, ["defi-analysis", "yield-farming", "protocol-review"], "moderate", 0.0006),
]


def _load_agents_from_registry() -> list:
    """Load agents dynamically from on-chain registry; fall back to hardcoded list."""
    try:
        from dynamic_registry import get_agents
        chain_agents = get_agents()
        if not chain_agents:
            logger.info("Dynamic registry returned empty, using fallback agents")
            return list(_FALLBACK_AGENTS)
        configs = []
        for name, data in chain_agents.items():
            configs.append(AgentConfig(
                name=name,
                token_id=data["token_id"],
                skills=data["skills"],
                risk_profile="moderate",
                hourly_rate=data.get("hourly_rate", 0.0003),
            ))
        logger.info(f"Loaded {len(configs)} agents from dynamic registry")
        return configs
    except Exception as e:
        logger.warning(f"Dynamic registry unavailable ({e}), using fallback agents")
        return list(_FALLBACK_AGENTS)


DEFAULT_AGENTS = _load_agents_from_registry()


# ======================== CLI ========================

def main():
    import argparse
    parser = argparse.ArgumentParser(description="ALIAS Orchestrator V2")
    parser.add_argument("command", choices=["start", "status", "stop"], nargs="?", default="start")
    args = parser.parse_args()

    if args.command == "status":
        state_path = Path("data/orchestrator_state.json")
        if state_path.exists():
            state = json.loads(state_path.read_text())
            print(json.dumps(state, indent=2))
        else:
            print("No state file found. Is the orchestrator running?")
        return

    if args.command == "stop":
        # In production, send SIGTERM to the process
        print("Send SIGTERM to the orchestrator process to stop it.")
        return

    config = OrchestratorConfig(agents=DEFAULT_AGENTS)
    orchestrator = Orchestrator(config)
    asyncio.run(orchestrator.start())


if __name__ == "__main__":
    main()
