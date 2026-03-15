/**
 * ALIAS - Soulbound Identity for AI Agents
 * =========================================
 * Frontend JavaScript for the ALIAS dashboard
 * 
 * Features:
 * - Search by agent name, ENS, or wallet address
 * - Real-time onchain soul verification
 * - Trust network visualization
 * - Agent activity terminal
 * 
 * Contract: 0x0F2f94281F87793ee086a2B6517B6db450192874 (Base Mainnet)
 * 
 * @author Jessica Nascimento
 * @hackathon The Synthesis 2026
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

// Function selectors (keccak256 hash of function signature)
const SELECTORS = {
    hasSoul: "0xbdd75202",      // hasSoul(address)
    agentToSoul: "0xf7c3328c"   // agentToSoul(address)
};

// =============================================================================
// AGENT REGISTRY
// =============================================================================

/**
 * Local registry of known agents
 * In production, this would be fetched from the blockchain or an indexer
 */
const agents = [
    { 
        name: "ALIAS-Alpha", 
        address: "0x07a0afcb49a764007439671Ec5148947EfC62E39",
        shortAddr: "0x07a0...E39",
        skills: ["autonomous", "verification", "risk-assessment"], 
        rep: 240, 
        tier: "ELITE",
        tokenId: 2
    },
    { 
        name: "ALIAS-Prime", 
        address: "0x6FFa1e00509d8B625c2F061D7dB07893B37199BC",
        shortAddr: "0x6FFa...9BC",
        skills: ["general", "coordination"], 
        rep: 40, 
        tier: "NEWCOMER",
        tokenId: 1
    },
    { 
        name: "DataMind", 
        address: "0x1111111111111111111111111111111111111111",
        shortAddr: "0x1111...111",
        skills: ["data-analysis", "forecasting", "reporting"], 
        rep: 50, 
        tier: "VERIFIED",
        tokenId: 3
    },
    { 
        name: "SecureBot", 
        address: "0x2222222222222222222222222222222222222222",
        shortAddr: "0x2222...222",
        skills: ["code-audit", "vulnerability-detection", "security-review"], 
        rep: 0, 
        tier: "NEWCOMER",
        tokenId: 4
    },
    { 
        name: "CreativeAI", 
        address: "0x3333333333333333333333333333333333333333",
        shortAddr: "0x3333...333",
        skills: ["writing", "marketing", "documentation"], 
        rep: 0, 
        tier: "NEWCOMER",
        tokenId: 5
    },
    { 
        name: "DeFiSage", 
        address: "0x4444444444444444444444444444444444444444",
        shortAddr: "0x4444...444",
        skills: ["defi-analysis", "yield-farming", "protocol-review"], 
        rep: 0, 
        tier: "NEWCOMER",
        tokenId: 6
    },
    { 
        name: "ResearchPrime", 
        address: "0x5555555555555555555555555555555555555555",
        shortAddr: "0x5555...555",
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
 */
function typeInTerminal(text, className) {
    const terminal = document.getElementById("terminal");
    const line = document.createElement("div");
    line.className = "terminal-line " + (className || "");
    line.textContent = text;
    terminal.appendChild(line);
    terminal.scrollTop = terminal.scrollHeight;
}

/**
 * Clear the terminal
 */
function clearTerminal() {
    document.getElementById("terminal").innerHTML = "";
}

// =============================================================================
// BLOCKCHAIN FUNCTIONS
// =============================================================================

/**
 * Check if an address has a soul token onchain
 */
async function checkSoulOnchain(address, ensName) {
    const callData = SELECTORS.hasSoul + address.slice(2).toLowerCase().padStart(64, "0");
    
    try {
        const response = await fetch(CONFIG.RPC_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                jsonrpc: "2.0",
                method: "eth_call",
                params: [{ to: CONFIG.CONTRACT_ADDRESS, data: callData }, "latest"],
                id: 1
            })
        });
        
        const data = await response.json();
        const hasSoul = data.result && data.result !== "0x" + "0".repeat(64);
        
        if (hasSoul) {
            typeInTerminal("[SOUL] ✓ Soul found!", "success");
            await getTokenId(address, ensName);
        } else {
            typeInTerminal("[SOUL] ✗ No soul found", "warning");
            typeInTerminal("[INFO] This address has no ALIAS identity", "system");
            const displayName = ensName || address.slice(0,10) + "..." + address.slice(-8);
            showSearchResult(
                "<div style='color:var(--warning);font-size:1.2rem;margin-bottom:10px'>NO SOUL FOUND</div>" +
                "<div><strong>" + displayName + "</strong></div>" +
                "<div style='color:var(--text-dim);font-family:monospace;margin-top:5px'>" + address + "</div>" +
                "<div style='margin-top:15px;color:var(--text-dim)'>This address does not have an ALIAS identity yet.</div>",
                false
            );
        }
    } catch (error) {
        typeInTerminal("[ERROR] Chain lookup failed", "warning");
        showSearchResult("<div style='color:var(--warning)'>Chain lookup failed</div>", false);
    }
}

/**
 * Get the token ID for an address
 */
async function getTokenId(address, ensName) {
    const callData = SELECTORS.agentToSoul + address.slice(2).toLowerCase().padStart(64, "0");
    
    try {
        const response = await fetch(CONFIG.RPC_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                jsonrpc: "2.0",
                method: "eth_call",
                params: [{ to: CONFIG.CONTRACT_ADDRESS, data: callData }, "latest"],
                id: 1
            })
        });
        
        const data = await response.json();
        const tokenId = parseInt(data.result, 16);
        
        typeInTerminal("[TOKEN] ID: #" + tokenId, "agent");
        typeInTerminal("[LINK] " + CONFIG.BASESCAN_URL + "/token/" + CONFIG.CONTRACT_ADDRESS, "system");
        
        const displayName = ensName || address.slice(0,10) + "..." + address.slice(-8);
        showSearchResult(
            "<div style='color:var(--success);font-size:1.2rem;margin-bottom:10px'>SOUL VERIFIED</div>" +
            "<div style='font-size:1.3rem;font-weight:bold'>" + displayName + "</div>" +
            "<div style='color:var(--text-dim);font-family:monospace;margin-top:5px'>" + address + "</div>" +
            "<div style='margin-top:15px'><span style='color:var(--primary);font-size:2rem;font-weight:bold'>#" + tokenId + "</span>" +
            "<span style='color:var(--text-dim);margin-left:10px'>TOKEN ID</span></div>" +
            "<div style='margin-top:15px'><a href='" + CONFIG.BASESCAN_URL + "/token/" + CONFIG.CONTRACT_ADDRESS + "?a=" + tokenId + "' target='_blank' style='color:var(--primary)'>View on BaseScan →</a></div>" +
            "<div style='margin-top:10px;color:var(--text-dim)'>See Agent Activity for logs</div>",
            true
        );
    } catch (error) {
        console.error("Failed to get token ID:", error);
    }
}

// =============================================================================
// SEARCH FUNCTIONS
// =============================================================================

/**
 * Main search function - handles ENS, addresses, and local agents
 */
async function searchAgent() {
    const query = document.getElementById("searchInput").value.trim();
    const queryLower = query.toLowerCase();
    
    clearTerminal();
    hideSearchResult();
    typeInTerminal("[SEARCH] Looking for: " + query, "system");
    
    // ENS Resolution
    if .endsWith(".eth")) {
        showSearchResult("<span style='color:var(--warning)'>Resolving ENS...</span>", false);
        typeInTerminal("[ENS] Resolving " + query + "...", "warning");
        
        try {
            const response = await fetch(CONFIG.ENS_API + "/" + query);
            const data = await response.json();
            
            if (data.address) {
                typeInTerminal("[ENS] Resolved!", "success");
                typeInTerminal("[ADDRESS] " + data.address, "system");
                showSearchResult(
                    "<div style='color:var(--success)'>ENS RESOLVED</div>" +
                    "<div><strong>" + query + "</strong></div>" +
                    "<div style='font-family:monospace;color:var(--text-dim)'>" + data.address + "</div>" +
                    "<div style='margin-top:10px;color:var(--warning)'>Checking for soul...</div>",
                    true
                );
                await checkSoulOnchain(data.address, query);
            } else {
                typeInTerminal("[ERROR] ENS name not found", "warning");
                showSearchResult("<div style='color:var(--warning)'>ENS name not found</div>", false);
            }
        } catch (error) {
            typeInTerminal("[ERROR] ENS lookup failed", "warning");
            showSearchResult("<div style='color:var(--warning)'>ENS lookup failed</div>", false);
        }
        return;
    }
    
    // Wallet Address
    if (query.startsWith("0x") && query.length === 42) {
        showSearchResult("<span style='color:var(--warning)'>Checking onchain...</span>", false);
        typeInTerminal("[CHAIN] Checking onchain...", "warning");
        await checkSoulOnchain(query, null);
        return;
    }
    
    // Local Agent Search
    const found = agents.find(a => 
        a.name.toLowerCase().includes(queryLower) || 
        a.address.toLowerCase().includes(queryLower)
    );
    
    if (found) {
        typeInTerminal("[FOUND] " + found.name, "success");
        typeInTerminal("[ADDRESS] " + found.address, "system");
        typeInTerminal("[REP] " + found.rep + " (" + found.tier + ")", "success");
        typeInTerminal("[SKILLS] " + found.skills.join(", "), "agent");
        
        showSearchResult(
            "<div style='color:var(--success);font-size:1.2rem;margin-bottom:10px'>AGENT FOUND</div>" +
            "<div style='font-size:1.3rem;font-weight:bold'>" + found.name + "</div>" +
            "<div style='color:var(--text-dim);margin:5px 0'>" + found.shortAddr + "</div>" +
            "<div style='margin-top:10px'><span style='color:var(--success);font-size:1.5rem;font-weight:bold'>" + found.rep + "</span>" +
            " <span style='color:var(--text-dim)'>REP</span>" +
            " <span style='background:rgba(0,212,255,0.2);padding:3px 10px;border-radius:10px;margin-left:10px'>" + found.tier + "</span></div>" +
            "<div style='color:var(--primary);margin-top:10px'>" + found.skills.join(" • ") + "</div>" +
            "<div style='margin-top:10px;color:var(--text-dim)'>See Agent Activity for details</div>",
            true
        );
    } else {
        typeInTerminal("[ERROR] Agent not found", "warning");
        typeInTerminal("[TIP] Try a wallet address (0x...) or ENS (.eth)", "system");
        showSearchResult(
            "<div style='color:var(--warning)'>Agent not found</div>" +
            "<div style='color:var(--text-dim);margin-top:5px'>Try a full wallet address or ENS name</div>",
            false
        );
    }
}

// ... (more functions would go here)

console.log("ALIAS Frontend loaded successfully");
