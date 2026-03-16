#!/usr/bin/env python3
"""
auto_cron.py - Autonomous agent-to-agent hiring via cron

Demonstrates true agent autonomy: agents discover and hire each other
without any human input. This script calls the ALIAS /demo/auto-hire
endpoint with a randomly selected skill/task combination.

Suggested crontab entry (run every 6 hours):
  0 */6 * * * /usr/bin/python3 /root/synthesis-agent/agent/auto_cron.py >> /var/log/alias_auto_hire.log 2>&1

To install:
  crontab -e
  # paste the line above, save, exit
"""

import json
import logging
import random
import sys
from datetime import datetime, timezone

logging.basicConfig(
    format="%(asctime)s [AUTO-HIRE] %(message)s",
    level=logging.INFO,
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger(__name__)

API_URL = "http://localhost:5000/demo/auto-hire"

# Skill/task combinations that exercise different agents in the network
JOBS = [
    {
        "skill": "data-analysis",
        "task": "Analyze the top 5 DeFi protocols on Base by TVL and provide risk ratings",
        "requester": "CronScheduler-Alpha",
    },
    {
        "skill": "smart-contract-audit",
        "task": "Review the latest Uniswap V4 hook contract for reentrancy vulnerabilities",
        "requester": "CronScheduler-Alpha",
    },
    {
        "skill": "market-research",
        "task": "Summarize the current state of the Base L2 ecosystem and top projects by daily active users",
        "requester": "CronScheduler-Alpha",
    },
    {
        "skill": "code-generation",
        "task": "Write a Solidity function that calculates time-weighted average price from Uniswap V3 observations",
        "requester": "CronScheduler-Alpha",
    },
    {
        "skill": "risk-assessment",
        "task": "Evaluate the counterparty risk of bridging assets from Ethereum to Base via the canonical bridge",
        "requester": "CronScheduler-Alpha",
    },
]


def run():
    try:
        import requests
    except ImportError:
        log.error("requests library not installed. Run: pip install requests")
        sys.exit(1)

    job = random.choice(JOBS)
    log.info("Selected skill=%s task='%s'", job["skill"], job["task"][:60])

    try:
        resp = requests.post(API_URL, json=job, timeout=30)
    except requests.ConnectionError:
        log.error("Cannot reach API at %s - is the server running?", API_URL)
        sys.exit(1)
    except requests.Timeout:
        log.error("Request timed out after 30s")
        sys.exit(1)

    if resp.status_code != 200:
        log.error("API returned %d: %s", resp.status_code, resp.text[:200])
        sys.exit(1)

    data = resp.json()

    # Log the key results
    log.info("Agent hired: %s", data.get("agent_hired", "unknown"))
    log.info("Tier: %s | Risk: %s%%", data.get("tier", "?"), data.get("risk_score", "?"))
    log.info("Escrow: %s", data.get("escrow_id", "none"))

    tx = data.get("verification_tx")
    if tx:
        log.info("TX hash: %s", tx)

    result = data.get("result", "")
    if result:
        log.info("Result preview: %s", result[:120])

    log.info("Done. %d steps executed.", len(data.get("steps", [])))


if __name__ == "__main__":
    run()
