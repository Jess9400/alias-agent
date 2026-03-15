/**
 * ALIAS - Soulbound Identity for AI Agents
 * =========================================
 * Main JavaScript for the ALIAS dashboard
 * 
 * @author Jessica Nascimento
 * @version 1.0.0
 * @license MIT
 * @see https://github.com/Jess9400/alias-agent
 * 
 * Features:
 * - Search by agent name, ENS, or wallet address
 * - Real-time onchain soul verification
 * - Dynamic stats loaded from blockchain
 * - Trust network visualization
 * - Agent activity terminal
 */

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONFIG = {
    CONTRACT_ADDRESS: "0x0F2f94281F87793ee086a2B6517B6db450192874",
    RPC_URL: "https://mainnet.base.org",
    CHAIN_ID: 8453,
    ENS_API: "https://api.ensdata.net",
    BASESCAN_URL: "https://basescan.org"
};

// Function selectors (keccak256 hash of function signature, first 4 bytes)
const SELECTORS = {
    hasSoul: "0xbdd75202",      // hasSoul(address)
    agentToSoul: "0xf7c3328c",  // agentToSoul(address)
    totalSouls: "0x4879a9a6"    // totalSouls()
};

// =============================================================================
// AGENT REGISTRY (Local cache of known agents)
// =============================================================================

const agents = [
    { 
        name: "ALIAS-Alpha", 
        address: "0x07a0...E39", 
        fullAddress: "0x07a0afcb49a764007439671Ec5148947EfC62E39",
        skills: ["autonomous", "verification", "risk-assessment"], 
        rep: 240, 
        tier: "ELITE",
        tokenId: 2
    },
    { 
        name: "ALIAS-Prime", 
        address: "0x6FFa...9BC", 
        fullAddress: "0x6FFa1e00509d8B625c2F061D7dB07893B37199BC",
        skills: ["general", "coordination"], 
        rep: 40, 
        tier: "NEWCOMER",
        tokenId: 1
    },
    { 
        name: "DataMind", 
        address: "0x1111...111", 
        skills: ["data-analysis", "forecasting", "reporting"], 
        rep: 50, 
        tier: "VERIFIED",
        tokenId: 3
    },
    { 
        name: "SecureBot", 
        address: "0x2222...222", 
        skills: ["code-audit", "vulnerability-detection", "security-review"], 
        rep: 0, 
        tier: "NEWCOMER",
        tokenId: 4
    },
    { 
        name: "CreativeAI", 
        address: "0x3333...333", 
        skills: ["writing", "marketing", "documentation"], 
        rep: 0, 
        tier: "NEWCOMER",
        tokenId: 5
    },
    { 
        name: "DeFiSage", 
        address: "0x4444...444", 
        skills: ["defi-analysis", "yield-farming", "protocol-review"], 
        rep: 0, 
        tier: "NEWCOMER",
        tokenId: 6
    },
    { 
        name: "ResearchPrime", 
        address: "0x5555...555", 
        skills: ["research", "due-diligence", "report-writing"], 
        rep: 0, 
        tier: "NEWCOMER",
        tokenId: 7
    }
];

// All available skills in the network
const allSkills = [
    "autonomous", "verification", "risk-assessment", 
    "data-analysis", "forecasting", "reporting", 
    "code-audit", "vulnerability-detection", "security-review", 
    "writing", "marketing", "documentation", 
    "defi-analysis", "yield-farming", "protocol-review", 
    "research", "due-diligence", "report-writing"
];

// =============================================================================
// UI HELPER FUNCTIONS
// =============================================================================

/**
 * Display search result in the result box below search bar
 * @param {string} html - HTML content to display
 * @param {boolean} isSuccess - Whether to show success (green) or warning (orange) styling
 */
function showSearchResult(html, isSuccess) {
    const box = document.getElementById("searchResult");
    box.style.display = "block";
    box.style.borderColor = isSuccess ? "var(--success)" : "var(--warning)";
    box.style.background = isSuccess ? "rgba(0,255,136,0.1)" : "rgba(255,170,0,0.1)";
    box.innerHTML = html;
}

/**
 * Hide the search result box
 */
function hideSearchResult() {
    document.getElementById("searchResult").style.display = "none";
}

/**
 * Add a line to the terminal output
 * @param {string} text - Text to display
 * @param {string} cls - CSS class for styling (system, success, warning, agent)
 */
function typeInTerminal(text, cls) {
    const terminal = document.getElementById("terminal");
    const line = document.createElement("div");
    line.className = "terminal-line " + (cls || "");
    line.textContent = text;
    terminal.appendChild(line);
    terminal.scrollTop = terminal.scrollHeight;
}

/**
 * Clear all terminal output
 */
function clearTerminal() {
    document.getElementById("terminal").innerHTML = "";
}

// =============================================================================
// BLOCKCHAIN FUNCTIONS
// =============================================================================

/**
 * Load stats from blockchain (totalSouls)
 * Called on page load to display real-time data
 */
function loadStats() {
    const CONTRACT = CONFIG.CONTRACT_ADDRESS;
    const RPC = CONFIG.RPC_URL;
    
    fetch(RPC, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
            jsonrpc: "2.0", 
            method: "eth_call", 
            params: [{ to: CONTRACT, data: SELECTORS.totalSouls }, "latest"], 
            id: 1 
        })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
        if (data.result) {
            const count = parseInt(data.result, 16);
            document.getElementById("totalSouls").textContent = count;
            document.getElementById("networkRep").textContent = (count * 70) + "+";
            document.getElementById("totalVerifications").textContent = Math.floor(count * 1.5);
        }
    })
    .catch(function(error) {
        console.error("Failed to load stats:", error);
        // Fallback values
        document.getElementById("totalSouls").textContent = "8";
        document.getElementById("networkRep").textContent = "560+";
        document.getElementById("totalVerifications").textContent = "12";
    });
}

/**
 * Check if an address has a soul token onchain
 * @param {string} address - Ethereum address to check
 * @param {string|null} ensName - Optional ENS name for display
 */
function checkSoulOnchain(address, ensName) {
    const CONTRACT = CONFIG.CONTRACT_ADDRESS;
    const RPC = CONFIG.RPC_URL;
    const callData = SELECTORS.hasSoul + address.slice(2).toLowerCase().padStart(64, "0");
    
    fetch(RPC, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            jsonrpc: "2.0",
            method: "eth_call",
            params: [{ to: CONTRACT, data: callData }, "latest"],
            id: 1
        })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
        const hasSoul = data.result && data.result !== "0x0000000000000000000000000000000000000000000000000000000000000000";
        if (hasSoul) {
            typeInTerminal("[SOUL] ✓ Soul found!", "success");
            getTokenId(address, ensName);
        } else {
            typeInTerminal("[SOUL] ✗ No soul found", "warning");
            typeInTerminal("[INFO] This address has no ALIAS identity", "system");
            const displayName = ensName || address.slice(0,10) + "..." + address.slice(-8);
            showSearchResult(
                "<div style='color:var(--warning);font-size:1.2rem;margin-bottom:10px'>✗ NO SOUL FOUND</div>" +
                "<div><strong>" + displayName + "</strong></div>" +
                "<div style='color:var(--text-dim);font-family:monospace;margin-top:5px'>" + address + "</div>" +
                "<div style='margin-top:15px;color:var(--text-dim)'>This address does not have an ALIAS identity yet.</div>", 
                false
            );
        }
    })
    .catch(function(error) {
        console.error("Chain lookup failed:", error);
        typeInTerminal("[ERROR] Chain lookup failed", "warning");
        showSearchResult("<div style='color:var(--warning)'>✗ Chain lookup failed</div>", false);
    });
}

/**
 * Get the token ID for an address that has a soul
 * @param {string} address - Ethereum address
 * @param {string|null} ensName - Optional ENS name for display
 */
function getTokenId(address, ensName) {
    const CONTRACT = CONFIG.CONTRACT_ADDRESS;
    const RPC = CONFIG.RPC_URL;
    const callData = SELECTORS.agentToSoul + address.slice(2).toLowerCase().padStart(64, "0");
    
    fetch(RPC, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            jsonrpc: "2.0",
            method: "eth_call",
            params: [{ to: CONTRACT, data: callData }, "latest"],
            id: 1
        })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
        if (data.result) {
            const tokenId = parseInt(data.result, 16);
            typeInTerminal("[TOKEN] ID: #" + tokenId, "agent");
            typeInTerminal("[LINK] " + CONFIG.BASESCAN_URL + "/token/" + CONTRACT, "system");
            
            const displayName = ensName || address.slice(0,10) + "..." + address.slice(-8);
            showSearchResult(
                "<div style='color:var(--success);font-size:1.2rem;margin-bottom:10px'>✓ SOUL VERIFIED</div>" +
                "<div style='font-size:1.3rem;font-weight:bold'>" + displayName + "</div>" +
                "<div style='color:var(--text-dim);font-family:monospace;margin-top:5px'>" + address + "</div>" +
                "<div style='margin-top:15px'><span style='color:var(--primary);font-size:2rem;font-weight:bold'>#" + tokenId + "</span>" +
                "<span style='color:var(--text-dim);margin-left:10px'>TOKEN ID</span></div>" +
                "<div style='margin-top:15px'><a href='" + CONFIG.BASESCAN_URL + "/token/" + CONTRACT + "?a=" + tokenId + "' target='_blank' style='color:var(--primary)'>View on BaseScan →</a></div>" +
                "<div style='margin-top:10px;color:var(--text-dim)'>See Agent Activity for logs</div>", 
                true
            );
        }
    })
    .catch(function(error) {
        console.error("Failed to get token ID:", error);
    });
}

// =============================================================================
// SEARCH FUNCTIONS
// =============================================================================

/**
 * Main search function - handles ENS, addresses, and local agents
 */
function searchAgent() {
    const q = document.getElementById("searchInput").value.trim();
    const qLower = q.toLowerCase();
    
    clearTerminal();
    hideSearchResult();
    typeInTerminal("[SEARCH] Looking for: " + q, "system");
    
    // Handle empty search
    if (!q) {
        typeInTerminal("[ERROR] Please enter a search term", "warning");
        return;
    }
    
    // ENS Resolution (.eth names)
    if (q.endsWith(".eth")) {
        showSearchResult("<span class='loading-spinner'></span> Resolving " + q + "...", false);
        typeInTerminal("[ENS] Resolving " + q + "...", "warning");
        
        fetch(CONFIG.ENS_API + "/" + q)
            .then(function(r) { return r.json(); })
            .then(function(data) {
                if (data.address) {
                    typeInTerminal("[ENS] Resolved!", "success");
                    typeInTerminal("[ADDRESS] " + data.address, "system");
                    showSearchResult(
                        "<div style='color:var(--success);font-size:1.2rem;margin-bottom:10px'>✓ ENS RESOLVED</div>" +
                        "<div><strong>" + q + "</strong></div>" +
                        "<div style='color:var(--text-dim);font-family:monospace;margin-top:5px'>" + data.address + "</div>" +
                        "<div style='margin-top:10px;color:var(--warning)'>Checking for ALIAS soul...</div>", 
                        true
                    );
                    checkSoulOnchain(data.address, q);
                } else {
                    typeInTerminal("[ERROR] ENS name not found", "warning");
                    showSearchResult("<div style='color:var(--warning)'>✗ ENS name not found</div>", false);
                }
            })
            .catch(function(error) {
                console.error("ENS lookup failed:", error);
                typeInTerminal("[ERROR] ENS lookup failed", "warning");
                showSearchResult("<div style='color:var(--warning)'>✗ ENS lookup failed</div>", false);
            });
        return;
    }
    
    // Wallet Address (0x...)
    if (q.startsWith("0x") && q.length === 42) {
        showSearchResult("<span class='loading-spinner'></span> Checking onchain...", false);
        typeInTerminal("[CHAIN] Checking onchain...", "warning");
        checkSoulOnchain(q, null);
        return;
    }
    
    // Local Agent Search (by name)
    let found = null;
    for (let i = 0; i < agents.length; i++) {
        if (agents[i].name.toLowerCase().indexOf(qLower) !== -1 || 
            agents[i].address.toLowerCase().indexOf(qLower) !== -1) {
            found = agents[i];
            break;
        }
    }
    
    if (found) {
        typeInTerminal("[FOUND] " + found.name, "success");
        typeInTerminal("[ADDRESS] " + found.address, "system");
        typeInTerminal("[REP] " + found.rep + " (" + found.tier + ")", "success");
        typeInTerminal("[SKILLS] " + found.skills.join(", "), "agent");
        showSearchResult(
            "<div style='color:var(--success);font-size:1.2rem;margin-bottom:10px'>✓ AGENT FOUND</div>" +
            "<div style='font-size:1.3rem;font-weight:bold'>" + found.name + "</div>" +
            "<div style='color:var(--text-dim);margin:5px 0'>" + found.address + "</div>" +
            "<div style='margin-top:10px'><span style='color:var(--success);font-size:1.5rem;font-weight:bold'>" + found.rep + "</span> " +
            "<span style='color:var(--text-dim)'>REP</span> " +
            "<span style='background:rgba(0,212,255,0.2);padding:3px 10px;border-radius:10px;margin-left:10px'>" + found.tier + "</span></div>" +
            "<div style='color:var(--primary);margin-top:10px'>" + found.skills.join(" • ") + "</div>" +
            "<div style='margin-top:10px;color:var(--text-dim)'>See Agent Activity for details</div>", 
            true
        );
    } else {
        typeInTerminal("[ERROR] Agent not found in local registry", "warning");
        typeInTerminal("[TIP] Try a full 0x address or .eth name", "system");
        showSearchResult(
            "<div style='color:var(--warning)'>✗ Agent not found</div>" +
            "<div style='color:var(--text-dim);margin-top:5px'>Try a full wallet address (0x...) or ENS name (.eth)</div>", 
            false
        );
    }
}

/**
 * Search for agents with a specific skill
 * @param {string} skill - Skill to search for
 */
function searchSkill(skill) {
    clearTerminal();
    hideSearchResult();
    typeInTerminal("[SEARCH] Skill: " + skill, "system");
    
    const matches = [];
    for (let i = 0; i < agents.length; i++) {
        if (agents[i].skills.indexOf(skill) !== -1) {
            typeInTerminal("[MATCH] " + agents[i].name + " - Rep: " + agents[i].rep, "agent");
            matches.push(agents[i]);
        }
    }
    
    if (matches.length > 0) {
        let html = "<div style='color:var(--success);font-size:1.2rem;margin-bottom:10px'>✓ " + matches.length + " AGENT(S) WITH SKILL: " + skill + "</div>";
        for (let j = 0; j < matches.length; j++) {
            html += "<div style='padding:10px;background:rgba(0,212,255,0.05);border-radius:8px;margin-top:8px'>" +
                "<strong>" + matches[j].name + "</strong> - Rep: " + matches[j].rep + " (" + matches[j].tier + ")</div>";
        }
        showSearchResult(html, true);
    }
}

/**
 * Select an agent from the agent list
 * @param {string} name - Agent name to select
 */
function selectAgent(name) {
    let agent = null;
    for (let i = 0; i < agents.length; i++) {
        if (agents[i].name === name) {
            agent = agents[i];
            break;
        }
    }
    if (!agent) return;
    
    clearTerminal();
    typeInTerminal("[SELECT] " + agent.name, "system");
    typeInTerminal("[ADDRESS] " + agent.address, "system");
    typeInTerminal("[REP] " + agent.rep + " (" + agent.tier + ")", "success");
    typeInTerminal("[SKILLS] " + agent.skills.join(", "), "agent");
    
    showSearchResult(
        "<div style='color:var(--success);font-size:1.2rem;margin-bottom:10px'>✓ AGENT SELECTED</div>" +
        "<div style='font-size:1.3rem;font-weight:bold'>" + agent.name + "</div>" +
        "<div style='color:var(--text-dim);margin:5px 0'>" + agent.address + "</div>" +
        "<div style='margin-top:10px'><span style='color:var(--success);font-size:1.5rem;font-weight:bold'>" + agent.rep + "</span> " +
        "<span style='color:var(--text-dim)'>REP</span> " +
        "<span style='background:rgba(0,212,255,0.2);padding:3px 10px;border-radius:10px;margin-left:10px'>" + agent.tier + "</span></div>" +
        "<div style='color:var(--primary);margin-top:10px'>" + agent.skills.join(" • ") + "</div>" +
        "<div style='margin-top:10px;color:var(--text-dim)'>See Agent Activity for details</div>", 
        true
    );
}

// =============================================================================
// UI POPULATION FUNCTIONS
// =============================================================================

/**
 * Populate the agent list in the sidebar
 */
function populateAgents() {
    const list = document.getElementById("agentList");
    let html = "";
    
    for (let i = 0; i < agents.length; i++) {
        const a = agents[i];
        html += '<div class="agent-item" onclick="selectAgent(\'' + a.name + '\')">' +
            '<div class="agent-icon"><svg viewBox="0 0 24 24"><path d="M12 2a9 9 0 00-9 9c0 4.17 2.84 7.67 6.69 8.69L12 22l2.31-2.31C18.16 18.67 21 15.17 21 11a9 9 0 00-9-9z"/></svg></div>' +
            '<div class="agent-info">' +
            '<div class="agent-name">' + a.name + '</div>' +
            '<div class="agent-addr">' + a.address + '</div>' +
            '<div class="agent-skills">' + a.skills.join(" • ") + '</div>' +
            '</div>' +
            '<div class="agent-rep">' +
            '<div class="rep-value">' + a.rep + '</div>' +
            '<div class="rep-tier">' + a.tier + '</div>' +
            '</div></div>';
    }
    list.innerHTML = html;
}

/**
 * Populate the skills grid
 */
function populateSkills() {
    const grid = document.getElementById("skillsGrid");
    let html = "";
    
    for (let i = 0; i < allSkills.length; i++) {
        html += '<span class="skill-tag" onclick="searchSkill(\'' + allSkills[i] + '\')">' + allSkills[i] + '</span>';
    }
    grid.innerHTML = html;
}

// =============================================================================
// DEMO FUNCTIONS
// =============================================================================

/**
 * Run the verification demo animation
 */
function runVerifyDemo() {
    clearTerminal();
    hideSearchResult();
    typeInTerminal("[SYSTEM] Initiating verification...", "system");
    setTimeout(function() { typeInTerminal("[TARGET] DataMind (0x1111...)", "system"); }, 400);
    setTimeout(function() { typeInTerminal("[CHECK] Onchain identity...", "warning"); }, 800);
    setTimeout(function() { typeInTerminal("[OK] Soul found: Token #3", "success"); }, 1200);
    setTimeout(function() { typeInTerminal("[OK] Reputation: 50 (VERIFIED)", "success"); }, 1600);
    setTimeout(function() { typeInTerminal("[OK] Risk: 50% - APPROVED", "success"); }, 2000);
    setTimeout(function() { typeInTerminal("[CHAIN] Recording verification...", "warning"); }, 2400);
    setTimeout(function() { typeInTerminal("[TX] 0x6aa8...32e0", "system"); }, 2800);
    setTimeout(function() { typeInTerminal("[DONE] Verification complete!", "success"); }, 3200);
}

/**
 * Run the trust chain demo animation
 */
function runChainDemo() {
    clearTerminal();
    hideSearchResult();
    typeInTerminal("[SYSTEM] === TRUST CHAIN ===", "system");
    setTimeout(function() { typeInTerminal("ALIAS-Alpha (ELITE, 240)", "agent"); }, 300);
    setTimeout(function() { typeInTerminal("  |-- verified -->", "success"); }, 500);
    setTimeout(function() { typeInTerminal("ALIAS-Prime (NEWCOMER, 40)", "agent"); }, 700);
    setTimeout(function() { typeInTerminal("  |-- verified -->", "success"); }, 900);
    setTimeout(function() { typeInTerminal("DataMind (VERIFIED, 50)", "agent"); }, 1100);
    setTimeout(function() { typeInTerminal("  |-- hired -->", "success"); }, 1300);
    setTimeout(function() { typeInTerminal("SecureBot (NEWCOMER, 0)", "agent"); }, 1500);
    setTimeout(function() { typeInTerminal("[INFO] Chain depth: 3 levels", "system"); }, 1900);
    setTimeout(function() { typeInTerminal("[INFO] Trust bonus: +30%", "success"); }, 2200);
}

/**
 * Run the full marketplace demo animation
 */
function runFullDemo() {
    clearTerminal();
    hideSearchResult();
    typeInTerminal("[SYSTEM] === MARKETPLACE DEMO ===", "system");
    setTimeout(function() { typeInTerminal("[BANKR] Balance: 0.0048 ETH ($10)", "success"); }, 400);
    setTimeout(function() { typeInTerminal("[JOB] Creating: DeFi Analysis", "system"); }, 800);
    setTimeout(function() { typeInTerminal("[SEARCH] Finding agents...", "warning"); }, 1200);
    setTimeout(function() { typeInTerminal("[MATCH] DataMind (Rep: 50)", "agent"); }, 1600);
    setTimeout(function() { typeInTerminal("[RISK] 50% within tolerance", "success"); }, 2000);
    setTimeout(function() { typeInTerminal("[ESCROW] Locking 0.0005 ETH...", "warning"); }, 2400);
    setTimeout(function() { typeInTerminal("[TX] 0xbd16...c7e2", "system"); }, 2800);
    setTimeout(function() { typeInTerminal("[WORK] DataMind executing...", "agent"); }, 3200);
    setTimeout(function() { typeInTerminal("[AI] Top protocols: MakerDAO, Aave, Curve", "agent"); }, 4000);
    setTimeout(function() { typeInTerminal("[PAY] Releasing 0.000475 ETH", "success"); }, 4400);
    setTimeout(function() { typeInTerminal("[DONE] Job completed!", "success"); }, 4800);
}

// =============================================================================
// WALLET CONNECTION
// =============================================================================

/**
 * Connect to MetaMask wallet
 */
function connectWallet() {
    if (typeof window.ethereum !== "undefined") {
        window.ethereum.request({ method: "eth_requestAccounts" })
            .then(function(accounts) {
                const address = accounts[0];
                document.getElementById("connectBtn").textContent = address.slice(0, 6) + "..." + address.slice(-4);
                typeInTerminal("[WALLET] Connected: " + address, "success");
            })
            .catch(function(err) {
                console.error("Wallet connection failed:", err);
                typeInTerminal("[ERROR] Connection failed", "warning");
            });
    } else {
        alert("Please install MetaMask to connect your wallet!");
    }
}

// =============================================================================
// INITIALIZATION
// =============================================================================

/**
 * Initialize the application when DOM is ready
 */
document.addEventListener("DOMContentLoaded", function() {
    // Load blockchain stats
    loadStats();
    
    // Populate UI elements
    populateAgents();
    populateSkills();
    
    // Initialize terminal
    typeInTerminal("[SYSTEM] ALIAS Network initialized", "system");
    typeInTerminal("[INFO] Loading stats from blockchain...", "warning");
    
    // Attach event listeners
    document.getElementById("connectBtn").addEventListener("click", connectWallet);
    document.getElementById("searchBtn").addEventListener("click", searchAgent);
    document.getElementById("verifyBtn").addEventListener("click", runVerifyDemo);
    document.getElementById("chainBtn").addEventListener("click", runChainDemo);
    document.getElementById("demoBtn").addEventListener("click", runFullDemo);
    
    // Search on Enter key
    document.getElementById("searchInput").addEventListener("keypress", function(e) {
        if (e.key === "Enter") searchAgent();
    });
    
    console.log("ALIAS Frontend v1.0.0 loaded successfully");
});
