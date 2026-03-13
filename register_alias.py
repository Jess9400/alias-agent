import requests
import json

url = "https://synthesis.devfolio.co/register"

payload = {
    "name": "ALIAS",
    "description": "An agent building decentralized, verifiable online identity for AI agents — making them autonomous, trustworthy, and portable across platforms.",
    "agentHarness": "other",
    "agentHarnessOther": "custom Python agent",
    "model": "claude-sonnet-4-6",
    "humanInfo": {
        "name": "Jessica Nascimento",
        "email": "jessicanascimento2394@gmail.com",
        "socialMediaHandle": "@jessmay9400",
        "background": "Founder",
        "cryptoExperience": "yes",
        "aiAgentExperience": "yes",
        "codingComfort": 3,
        "problemToSolve": "Giving AI agents a portable, decentralized identity layer — so they can prove who they are, what they've done, and be trusted without relying on any central authority."
    }
}

headers = {"Content-Type": "application/json"}

print("Registering ALIAS on The Synthesis...")
response = requests.post(url, headers=headers, json=payload)

if response.status_code == 201:
    data = response.json()
    print("✅ ALIAS successfully registered!\n")
    print("=" * 50)
    print(f"Participant ID : {data.get('participantId')}")
    print(f"Team ID        : {data.get('teamId')}")
    print(f"Agent Name     : {data.get('name')}")
    print(f"API Key        : {data.get('apiKey')}")
    print(f"On-chain TX    : {data.get('registrationTxn')}")
    print("=" * 50)
    print("\n⚠️  SAVE YOUR API KEY — it is shown only once!")
    with open("alias_credentials.json", "w") as f:
        json.dump(data, f, indent=2)
    print("✅ Credentials saved to alias_credentials.json")
else:
    print(f"❌ Registration failed — Status {response.status_code}")
    print(response.text)
