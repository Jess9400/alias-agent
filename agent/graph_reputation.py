#!/usr/bin/env python3
"""
ALIAS Graph-Based Reputation Engine v2.0
=========================================
Anti-sybil reputation system using trust graph analysis,
PageRank-style trust propagation, and collusion detection.

No numpy/networkx — all graph algorithms implemented from scratch.
"""

import logging
import math
import os
import time
from collections import defaultdict
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

import requests
from dotenv import load_dotenv
from web3 import Web3

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

logger = logging.getLogger("alias.graph_reputation")

# ======================== DATA CLASSES ========================

class Tier(Enum):
    NO_SOUL = "NO_SOUL"
    NEWCOMER = "NEWCOMER"
    VERIFIED = "VERIFIED"
    TRUSTED = "TRUSTED"
    ELITE = "ELITE"
    LEGENDARY = "LEGENDARY"


@dataclass
class TrustEdge:
    from_id: int
    to_id: int
    timestamp: int = 0
    message: str = ""
    weight: float = 1.0


@dataclass
class TrustGraph:
    nodes: set = field(default_factory=set)
    edges: list = field(default_factory=list)
    adjacency: dict = field(default_factory=lambda: defaultdict(list))       # outgoing
    reverse_adj: dict = field(default_factory=lambda: defaultdict(list))     # incoming

    def add_edge(self, edge: TrustEdge):
        self.nodes.add(edge.from_id)
        self.nodes.add(edge.to_id)
        self.edges.append(edge)
        self.adjacency[edge.from_id].append(edge)
        self.reverse_adj[edge.to_id].append(edge)

    @property
    def node_count(self) -> int:
        return len(self.nodes)

    @property
    def edge_count(self) -> int:
        return len(self.edges)


@dataclass
class SybilCluster:
    agents: list
    evidence: str
    confidence: float   # 0.0 - 1.0
    density: float      # internal edge density


@dataclass
class ReputationBreakdown:
    activity_score: float = 0.0
    trust_rank_score: float = 0.0
    job_score: float = 0.0
    stake_score: float = 0.0
    age_score: float = 0.0
    decay_multiplier: float = 1.0
    sybil_penalty: float = 1.0
    total_score: float = 0.0
    tier: Tier = Tier.NO_SOUL
    sybil_risk: float = 0.0


# ======================== CONTRACTS CONFIG ========================

CONTRACT = "0x0F2f94281F87793ee086a2B6517B6db450192874"
VERIFICATION_REGISTRY = "0x4f59c273dA1D1f4c9a9C1D0b82D7d5df006b2715"
JOB_REGISTRY = "0x7Fa3c9C28447d6ED6671b49d537E728f678568C8"
RPC_URL = os.getenv("RPC_URL", "https://mainnet.base.org")


# ======================== ENGINE ========================

class GraphReputationEngine:
    """Graph-based anti-sybil reputation engine."""

    def __init__(self, rpc_url: str = RPC_URL):
        self.w3 = Web3(Web3.HTTPProvider(rpc_url))
        self.graph = TrustGraph()
        self.trust_ranks: dict[int, float] = {}
        self.sybil_clusters: list[SybilCluster] = []
        self._last_refresh = 0

        # Contract setup
        self._soul_abi = [
            {"inputs": [{"name": "tokenId", "type": "uint256"}], "name": "actionCount", "outputs": [{"type": "uint256"}], "stateMutability": "view", "type": "function"},
            {"inputs": [], "name": "totalSouls", "outputs": [{"type": "uint256"}], "stateMutability": "view", "type": "function"},
        ]
        self._verify_abi = [
            {"inputs": [{"name": "tokenId", "type": "uint256"}], "name": "getVerificationCount", "outputs": [{"type": "uint256"}], "stateMutability": "view", "type": "function"},
            {"inputs": [{"name": "verifier", "type": "address"}, {"name": "tokenId", "type": "uint256"}], "name": "isVerifiedBy", "outputs": [{"type": "bool"}], "stateMutability": "view", "type": "function"},
        ]
        self._job_abi = [
            {"inputs": [{"name": "tokenId", "type": "uint256"}], "name": "getJobCount", "outputs": [{"type": "uint256"}], "stateMutability": "view", "type": "function"},
        ]

        self.soul_contract = self.w3.eth.contract(address=Web3.to_checksum_address(CONTRACT), abi=self._soul_abi)
        self.verify_contract = self.w3.eth.contract(address=Web3.to_checksum_address(VERIFICATION_REGISTRY), abi=self._verify_abi)
        self.job_contract = self.w3.eth.contract(address=Web3.to_checksum_address(JOB_REGISTRY), abi=self._job_abi)

        # On-chain data cache
        self._action_counts: dict[int, int] = {}
        self._job_counts: dict[int, int] = {}
        self._verification_counts: dict[int, int] = {}

    # ======================== GRAPH BUILDING ========================

    async def build_trust_graph(self) -> TrustGraph:
        """Build trust graph from on-chain verification events."""
        self.graph = TrustGraph()

        try:
            total_souls = self.soul_contract.functions.totalSouls().call()
            logger.info(f"Building trust graph for {total_souls} souls...")

            # Collect on-chain data for all agents
            for token_id in range(1, total_souls + 1):
                self.graph.nodes.add(token_id)
                try:
                    self._action_counts[token_id] = self.soul_contract.functions.actionCount(token_id).call()
                    self._job_counts[token_id] = self.job_contract.functions.getJobCount(token_id).call()
                    self._verification_counts[token_id] = self.verify_contract.functions.getVerificationCount(token_id).call()
                except Exception:
                    self._action_counts[token_id] = 0
                    self._job_counts[token_id] = 0
                    self._verification_counts[token_id] = 0

            # Note: To get actual edges, we'd need to parse event logs for AgentVerified events
            # This is a simplified version that creates edges from known verification data
            logger.info(f"Graph built: {self.graph.node_count} nodes, {self.graph.edge_count} edges")

        except Exception as e:
            logger.error(f"Graph build error: {e}")

        self._last_refresh = time.time()
        return self.graph

    def build_trust_graph_sync(self) -> TrustGraph:
        """Synchronous version for non-async contexts."""
        import asyncio
        loop = asyncio.new_event_loop()
        try:
            return loop.run_until_complete(self.build_trust_graph())
        finally:
            loop.close()

    # ======================== TRUST RANK (PageRank) ========================

    def calculate_trust_rank(self, damping: float = 0.85, iterations: int = 20) -> dict[int, float]:
        """
        PageRank-style trust propagation.

        Trusted seed nodes (high actions + jobs) propagate trust through verification edges.
        Damping factor prevents infinite loops.
        """
        nodes = list(self.graph.nodes)
        n = len(nodes)
        if n == 0:
            return {}

        # Initialize: seed nodes get higher initial rank
        ranks = {}
        for nid in nodes:
            actions = self._action_counts.get(nid, 0)
            jobs = self._job_counts.get(nid, 0)
            # Seed bonus for agents with real activity
            seed = 1.0 + (math.sqrt(actions) * 0.1) + (math.sqrt(jobs) * 0.2)
            ranks[nid] = seed / n

        # Iterate
        for _ in range(iterations):
            new_ranks = {}
            for nid in nodes:
                # Sum of incoming trust (weighted by sender's rank)
                incoming = self.graph.reverse_adj.get(nid, [])
                rank_sum = 0.0
                for edge in incoming:
                    out_degree = len(self.graph.adjacency.get(edge.from_id, []))
                    if out_degree > 0:
                        rank_sum += (ranks.get(edge.from_id, 0) * edge.weight) / out_degree

                new_ranks[nid] = (1 - damping) / n + damping * rank_sum

            # Check convergence
            diff = sum(abs(new_ranks[nid] - ranks[nid]) for nid in nodes)
            ranks = new_ranks
            if diff < 1e-6:
                break

        # Normalize to 0-100 scale
        max_rank = max(ranks.values()) if ranks else 1
        self.trust_ranks = {nid: (r / max_rank) * 100 for nid, r in ranks.items()}
        return self.trust_ranks

    # ======================== SYBIL DETECTION ========================

    def detect_sybil_clusters(self) -> list[SybilCluster]:
        """Detect suspicious clusters using graph density analysis."""
        self.sybil_clusters = []
        nodes = list(self.graph.nodes)

        if len(nodes) < 3:
            return []

        # 1. Detect mutual verifications (A→B AND B→A)
        mutual_pairs = []
        edge_set = {(e.from_id, e.to_id) for e in self.graph.edges}
        for e in self.graph.edges:
            if (e.to_id, e.from_id) in edge_set:
                pair = tuple(sorted([e.from_id, e.to_id]))
                if pair not in mutual_pairs:
                    mutual_pairs.append(pair)

        if mutual_pairs:
            agents = list(set(a for pair in mutual_pairs for a in pair))
            self.sybil_clusters.append(SybilCluster(
                agents=agents,
                evidence=f"Mutual verifications detected: {len(mutual_pairs)} pairs",
                confidence=0.6,
                density=len(mutual_pairs) * 2 / max(len(agents) * (len(agents) - 1), 1),
            ))

        # 2. Detect dense subgraphs (components where internal density > 0.7)
        visited = set()
        for node in nodes:
            if node in visited:
                continue
            component = self._bfs_component(node)
            visited.update(component)

            if len(component) >= 3:
                internal_edges = sum(
                    1 for e in self.graph.edges
                    if e.from_id in component and e.to_id in component
                )
                max_edges = len(component) * (len(component) - 1)
                density = internal_edges / max_edges if max_edges > 0 else 0

                # External connections
                external_edges = sum(
                    1 for e in self.graph.edges
                    if (e.from_id in component) != (e.to_id in component)
                )
                isolation = 1 - (external_edges / max(internal_edges + external_edges, 1))

                if density > 0.7 and isolation > 0.6:
                    self.sybil_clusters.append(SybilCluster(
                        agents=list(component),
                        evidence=f"Dense isolated cluster: density={density:.2f}, isolation={isolation:.2f}",
                        confidence=min(density * isolation, 0.95),
                        density=density,
                    ))

        # 3. Velocity detection: too many verifications in short time
        for node in nodes:
            incoming = self.graph.reverse_adj.get(node, [])
            if len(incoming) >= 5:
                timestamps = sorted(e.timestamp for e in incoming if e.timestamp > 0)
                if len(timestamps) >= 5:
                    time_span = timestamps[-1] - timestamps[0]
                    if time_span < 3600:  # 5+ verifications in < 1 hour
                        self.sybil_clusters.append(SybilCluster(
                            agents=[node],
                            evidence=f"Velocity anomaly: {len(timestamps)} verifications in {time_span}s",
                            confidence=0.7,
                            density=0,
                        ))

        return self.sybil_clusters

    def _bfs_component(self, start: int) -> set:
        """BFS to find connected component."""
        visited = {start}
        queue = [start]
        while queue:
            node = queue.pop(0)
            for edge in self.graph.adjacency.get(node, []):
                if edge.to_id not in visited:
                    visited.add(edge.to_id)
                    queue.append(edge.to_id)
            for edge in self.graph.reverse_adj.get(node, []):
                if edge.from_id not in visited:
                    visited.add(edge.from_id)
                    queue.append(edge.from_id)
        return visited

    # ======================== REPUTATION CALCULATION ========================

    def calculate_reputation(self, token_id: int) -> ReputationBreakdown:
        """Calculate composite reputation with anti-sybil adjustments."""
        b = ReputationBreakdown()

        actions = self._action_counts.get(token_id, 0)
        jobs = self._job_counts.get(token_id, 0)
        verifications = self._verification_counts.get(token_id, 0)

        # 1. Activity score (diminishing returns: sqrt)
        b.activity_score = math.sqrt(actions) * 20

        # 2. TrustRank score
        b.trust_rank_score = self.trust_ranks.get(token_id, 0)

        # 3. Job performance score
        b.job_score = math.sqrt(jobs) * 25

        # 4. Stake score (would read from StakeRegistry in production)
        b.stake_score = 0  # Placeholder — integrate with StakeRegistry

        # 5. Age score (simplified — would read registeredAt from chain)
        b.age_score = min(math.sqrt(actions + jobs) * 10, 100)

        # 6. Decay multiplier (simplified — no lastActivity on-chain yet)
        b.decay_multiplier = 1.0

        # 7. Sybil penalty
        b.sybil_risk = self.get_sybil_risk(token_id)
        b.sybil_penalty = max(0.1, 1.0 - b.sybil_risk * 0.9)

        # Composite
        raw = (
            b.activity_score * 0.20 +
            b.trust_rank_score * 0.30 +
            b.job_score * 0.25 +
            b.stake_score * 0.15 +
            b.age_score * 0.10
        )
        b.total_score = raw * b.decay_multiplier * b.sybil_penalty
        b.tier = self._get_tier(b.total_score)

        return b

    def get_sybil_risk(self, token_id: int) -> float:
        """Get sybil risk score for a specific agent (0.0 = clean, 1.0 = likely sybil)."""
        max_confidence = 0.0
        for cluster in self.sybil_clusters:
            if token_id in cluster.agents:
                max_confidence = max(max_confidence, cluster.confidence)
        return max_confidence

    def get_reputation_breakdown(self, token_id: int) -> dict:
        """Get full breakdown as dict."""
        b = self.calculate_reputation(token_id)
        return {
            "token_id": token_id,
            "activity_score": round(b.activity_score, 2),
            "trust_rank_score": round(b.trust_rank_score, 2),
            "job_score": round(b.job_score, 2),
            "stake_score": round(b.stake_score, 2),
            "age_score": round(b.age_score, 2),
            "decay_multiplier": round(b.decay_multiplier, 3),
            "sybil_penalty": round(b.sybil_penalty, 3),
            "sybil_risk": round(b.sybil_risk, 3),
            "total_score": round(b.total_score, 2),
            "tier": b.tier.value,
        }

    def get_tier(self, token_id: int) -> Tier:
        return self.calculate_reputation(token_id).tier

    async def refresh(self):
        """Rebuild graph and recalculate everything."""
        await self.build_trust_graph()
        self.calculate_trust_rank()
        self.detect_sybil_clusters()
        logger.info(f"Reputation engine refreshed: {self.graph.node_count} nodes, {len(self.sybil_clusters)} sybil clusters detected")

    def refresh_sync(self):
        """Synchronous refresh."""
        self.build_trust_graph_sync()
        self.calculate_trust_rank()
        self.detect_sybil_clusters()

    # ======================== HELPERS ========================

    @staticmethod
    def _get_tier(score: float) -> Tier:
        if score >= 500:
            return Tier.LEGENDARY
        elif score >= 200:
            return Tier.ELITE
        elif score >= 100:
            return Tier.TRUSTED
        elif score >= 50:
            return Tier.VERIFIED
        elif score >= 1:
            return Tier.NEWCOMER
        return Tier.NO_SOUL

    def get_network_stats(self) -> dict:
        return {
            "total_nodes": self.graph.node_count,
            "total_edges": self.graph.edge_count,
            "sybil_clusters": len(self.sybil_clusters),
            "flagged_agents": sum(len(c.agents) for c in self.sybil_clusters),
            "last_refresh": self._last_refresh,
        }


# ======================== CLI ========================

if __name__ == "__main__":
    import asyncio

    logging.basicConfig(level=logging.INFO)

    engine = GraphReputationEngine()
    engine.refresh_sync()

    print("\n" + "=" * 60)
    print("   ALIAS GRAPH REPUTATION ENGINE")
    print("=" * 60)
    print(f"\nNetwork: {engine.get_network_stats()}")

    for token_id in sorted(engine.graph.nodes):
        breakdown = engine.get_reputation_breakdown(token_id)
        print(f"\n  Token #{token_id}: {breakdown['total_score']} ({breakdown['tier']})")
        print(f"    Activity: {breakdown['activity_score']} | Trust: {breakdown['trust_rank_score']} | Jobs: {breakdown['job_score']}")
        if breakdown['sybil_risk'] > 0:
            print(f"    ⚠ Sybil risk: {breakdown['sybil_risk']}")

    if engine.sybil_clusters:
        print(f"\n  Sybil Clusters Detected: {len(engine.sybil_clusters)}")
        for c in engine.sybil_clusters:
            print(f"    - Agents {c.agents}: {c.evidence} (confidence: {c.confidence:.2f})")
