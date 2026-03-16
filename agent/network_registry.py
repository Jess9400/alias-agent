"""ALIAS Network Registry - All registered agents with skills"""

NETWORK_AGENTS = {
    "ALIAS-Prime": {
        "address": "0x6FFa1e00509d8B625c2F061D7dB07893B37199BC",
        "token_id": 1,
        "skills": ["general", "coordination"],
        "hourly_rate": 0.0001
    },
    "ALIAS-Alpha": {
        "address": "0x07a0afcb49a764007439671Ec5148947EfC62E39",
        "token_id": 2,
        "skills": ["autonomous", "verification", "risk-assessment", "collaboration"],
        "hourly_rate": 0.0005
    },
    "DataMind": {
        "address": "0x9a60871B684e23D1C05ba9127AA7E72eA0a38DFb",
        "token_id": 3,
        "skills": ["data-analysis", "forecasting", "reporting"],
        "hourly_rate": 0.0003
    },
    "SecureBot": {
        "address": "0xB44618a6E386FE847B5dfcbA111A6C8aD2B97f23",
        "token_id": 4,
        "skills": ["code-audit", "vulnerability-detection", "security-review"],
        "hourly_rate": 0.0008
    },
    "CreativeAI": {
        "address": "0x9C8d1e413e71a02C2Ad0970AAcAe0Ae786e0F883",
        "token_id": 5,
        "skills": ["writing", "marketing", "documentation"],
        "hourly_rate": 0.0002
    },
    "DeFiSage": {
        "address": "0x5870d20af5d0d8F3010A3804819e9036a6032301",
        "token_id": 6,
        "skills": ["defi-analysis", "yield-farming", "protocol-review"],
        "hourly_rate": 0.0006
    },
    "ResearchPrime": {
        "address": "0x9a60871B684e23D1C05ba9127AA7E72eA0a38DFb",
        "token_id": 7,
        "skills": ["research", "due-diligence", "report-writing"],
        "hourly_rate": 0.0004
    }
}

def get_agent_by_skill(skill):
    return [{"name": n, **d} for n, d in NETWORK_AGENTS.items() if skill in d["skills"]]

find_by_skill = get_agent_by_skill

def find_by_address(addr):
    for n, d in NETWORK_AGENTS.items():
        if d["address"].lower() == addr.lower():
            return {"name": n, **d}
    return None

def all_skills():
    skills = set()
    for d in NETWORK_AGENTS.values():
        skills.update(d["skills"])
    return sorted(skills)

if __name__ == "__main__":
    print(f"\nALIAS Network: {len(NETWORK_AGENTS)} agents")
    print(f"Skills: {', '.join(all_skills())}")
