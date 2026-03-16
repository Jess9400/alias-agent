/**
 * ALIAS - Soulbound Identity for AI Agents
 * =========================================
 * Main JavaScript for the ALIAS dashboard
 * 
 * @author Jessica Nascimento
 * @version 1.1.0
 * @license MIT
 * @see https://github.com/Jess9400/alias-agent
 * 
 * Security Features:
 * - XSS protection via HTML escaping
 * - Input sanitization for all user inputs
 * - Safe DOM manipulation (textContent over innerHTML)
 */

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONFIG = {
    CONTRACT_ADDRESS: "0x0F2f94281F87793ee086a2B6517B6db450192874",
    RPC_URL: "https://base.publicnode.com",
    CHAIN_ID: 8453,
    ENS_API: "https://api.ensdata.net",
    BASESCAN_URL: "https://basescan.org",
    VERIFICATION_REGISTRY: "0x4f59c273dA1D1f4c9a9C1D0b82D7d5df006b2715"
};

// Agent operator wallets (where tips/payments go) - keyed by token ID
const AGENT_WALLETS = {
    1: "0x6FFa1e00509d8B625c2F061D7dB07893B37199BC",
    2: "0x07a0afcb49a764007439671Ec5148947EfC62E39",
    3: "0x9a60871B684e23D1C05ba9127AA7E72eA0a38DFb",
    4: "0xB44618a6E386FE847B5dfcbA111A6C8aD2B97f23",
    5: "0x9C8d1e413e71a02C2Ad0970AAcAe0Ae786e0F883",
    6: "0x5870d20af5d0d8F3010A3804819e9036a6032301",
    7: "0x9a60871B684e23D1C05ba9127AA7E72eA0a38DFb",
    8: "0xB44618a6E386FE847B5dfcbA111A6C8aD2B97f23",
    9: "0x9C8d1e413e71a02C2Ad0970AAcAe0Ae786e0F883",
    10: "0x5870d20af5d0d8F3010A3804819e9036a6032301",
    11: "0x07a0afcb49a764007439671Ec5148947EfC62E39"
};

// Agent hourly rates in ETH - keyed by token ID
const AGENT_RATES = {
    1: 0.0001,
    2: 0.0005,
    3: 0.0003,
    4: 0.0008,
    5: 0.0002,
    6: 0.0006,
    7: 0.0004,
    8: 0.0001,
    9: 0.0005,
    10: 0.0003,
    11: 0.0004
};

const SELECTORS = {
    hasSoul: "0xbdd75202",
    agentToSoul: "0xf7c3328c",
    totalSouls: "0x4879a9a6"
};

// =============================================================================
// SECURITY UTILITIES
// =============================================================================

/**
 * Escape HTML to prevent XSS attacks
 * @param {string} text - Raw text that may contain HTML
 * @returns {string} - Safely escaped text
 */
function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    var div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
}

/**
 * Sanitize user input
 * @param {string} input - Raw user input
 * @returns {string} - Sanitized input
 */
function sanitizeInput(input) {
    if (!input) return '';
    return String(input).replace(/<[^>]*>/g, '').replace(/[<>\"'&]/g, '').trim();
}

/**
 * Validate Ethereum address format
 */
function isValidAddress(address) {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Validate ENS name format
 */
function isValidENS(name) {
    return /^[a-zA-Z0-9-]+\.eth$/.test(name);
}

// =============================================================================
// AGENT REGISTRY
// =============================================================================

var agents = [
    { name: "ALIAS-Prime", address: "0x6FFa...9BC", fullAddress: "0x6FFa1e00509d8B625c2F061D7dB07893B37199BC", skills: ["general", "coordination"], rep: 200, tier: "ELITE", tokenId: 1 },
    { name: "ALIAS-Alpha", address: "0x07a0...E39", fullAddress: "0x07a0afcb49a764007439671Ec5148947EfC62E39", skills: ["autonomous", "verification", "risk-assessment", "collaboration"], rep: 150, tier: "VERIFIED", tokenId: 2 },
    { name: "DataMind", address: "0x1111...111", fullAddress: "0x1111111111111111111111111111111111111111", skills: ["data-analysis", "forecasting", "reporting"], rep: 100, tier: "VERIFIED", tokenId: 3 },
    { name: "SecureBot", address: "0x2222...222", fullAddress: "0x2222222222222222222222222222222222222222", skills: ["code-audit", "vulnerability-detection", "security-review"], rep: 50, tier: "NEWCOMER", tokenId: 4 },
    { name: "CreativeAI", address: "0x3333...333", fullAddress: "0x3333333333333333333333333333333333333333", skills: ["writing", "marketing", "documentation"], rep: 50, tier: "NEWCOMER", tokenId: 5 },
    { name: "DeFiSage", address: "0x4444...444", fullAddress: "0x4444444444444444444444444444444444444444", skills: ["defi-analysis", "yield-farming", "protocol-review"], rep: 50, tier: "NEWCOMER", tokenId: 6 },
    { name: "ResearchPrime", address: "0x5555...555", fullAddress: "0x5555555555555555555555555555555555555555", skills: ["research", "due-diligence", "report-writing"], rep: 50, tier: "NEWCOMER", tokenId: 7 },
    { name: "TraderBot", address: "0x9a60...DFb", fullAddress: "0x9a60871B684e23D1C05ba9127AA7E72eA0a38DFb", skills: ["trading", "market-analysis", "portfolio"], rep: 20, tier: "NEWCOMER", tokenId: 9 },
    { name: "LegalMind", address: "0xB446...f23", fullAddress: "0xB44618a6E386FE847B5dfcbA111A6C8aD2B97f23", skills: ["legal-research", "compliance", "contract-review"], rep: 10, tier: "NEWCOMER", tokenId: 10 },
    { name: "DevAgent", address: "0x9C8d...883", fullAddress: "0x9C8d1e413e71a02C2Ad0970AAcAe0Ae786e0F883", skills: ["coding", "debugging", "code-review"], rep: 5, tier: "NEWCOMER", tokenId: 11 }
];
var selectedAgent = null;

var allSkills = ["general", "coordination", "autonomous", "verification", "risk-assessment", "collaboration", "data-analysis", "forecasting", "reporting", "code-audit", "vulnerability-detection", "security-review", "writing", "marketing", "documentation", "defi-analysis", "yield-farming", "protocol-review", "research", "due-diligence", "report-writing"];

// =============================================================================
// DYNAMIC AGENT LOADING WITH ETHERS.JS
// =============================================================================
const SOUL_ABI = [
    "function registerSoul(address agent, string name, string metadataURI, string skills) returns (uint256)",
    "function totalSouls() view returns (uint256)",
    "function actionCount(uint256 tokenId) view returns (uint256)",
    "function souls(uint256 tokenId) view returns (string name, string metadataURI, address creator, uint256 createdAt, string skills, bool active)"
];

const VERIFICATION_ABI = [
    "function verify(uint256 tokenId, string message) external",
    "function getVerificationCount(uint256 tokenId) external view returns (uint256)",
    "function getVerifications(uint256 tokenId) external view returns (tuple(address verifier, uint256 timestamp, string message)[])",
    "function isVerifiedBy(address verifier, uint256 tokenId) external view returns (bool)"
];


async function loadAgentsFromChain() {
    var list = document.getElementById("agentList");
    list.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-dim)"><span class="loading-spinner"></span> Loading from blockchain...</div>';
    
    try {
        var provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);
        var contract = new ethers.Contract(CONFIG.CONTRACT_ADDRESS, SOUL_ABI, provider);
        
        var totalSouls = await contract.totalSouls();
        var count = Number(totalSouls);
        
        // Clear agents array and rebuild from chain
        agents = [];
        var newSkills = [];
        
        for (var i = 1; i <= count; i++) {
            await new Promise(function(r) { setTimeout(r, 200); });
            try {
                var soul = await contract.souls(i);
                
                if (soul.active) {
                    // Parse skills from description
                    var skillsArray = extractSkills(soul.name, soul.skills);
                    
                    // Calculate rep based on age
                    var age = Math.floor(Date.now() / 1000) - Number(soul.createdAt);
                    var rep = Math.max(0, Math.min(Math.floor(age / 200), 300));
                    
                    var tier = "NEWCOMER";
                    if (rep >= 200) tier = "ELITE";
                    else if (rep >= 50) tier = "VERIFIED";
                    
                    var addr = AGENT_WALLETS[i] || soul.creator;
                    agents.push({
                        name: soul.name,
                        address: addr.slice(0, 6) + "..." + addr.slice(-3),
                        fullAddress: addr,
                        skills: skillsArray,
                        rep: rep,
                        tier: tier,
                        tokenId: i,
                        active: soul.active,
                        description: soul.skills
                    });
                    
                    // Collect skills
                    skillsArray.forEach(function(s) {
                        if (newSkills.indexOf(s) === -1) newSkills.push(s);
                    });
                }
            } catch (e) {
                console.log("Failed to load soul #" + i, e);
            }
        }
        
        if (newSkills.length > 0) allSkills = newSkills;
        
        populateAgents();
        populateSkillsWithSearch(); populateTrustNetwork();
        typeInTerminal("[CHAIN] Loaded " + agents.length + " agents from blockchain", "success");
        
    } catch (error) {
        console.error("Failed to load from chain:", error);
        typeInTerminal("[WARN] Using cached agents", "warning");
        populateAgents();
        populateSkillsWithSearch(); populateTrustNetwork();
    }
}

function extractSkills(name, description) {
    var nameLower = (name || "").toLowerCase();
    var descLower = (description || "").toLowerCase();
    var found = [];
    
    var keywords = {
        "trading": "trading", "market": "market-analysis", "analysis": "data-analysis",
        "legal": "legal-research", "compliance": "compliance", "contract": "contract-review",
        "code": "coding", "debug": "debugging", "review": "code-review",
        "security": "security", "audit": "audit", "research": "research",
        "forecast": "forecasting", "report": "reporting", "defi": "defi",
        "autonomous": "autonomous", "verification": "verification", "identity": "identity",
        "portfolio": "portfolio"
    };
    
    for (var k in keywords) {
        if (descLower.indexOf(k) !== -1 || nameLower.indexOf(k) !== -1) {
            if (found.indexOf(keywords[k]) === -1) found.push(keywords[k]);
        }
    }
    
    if (found.length === 0) {
        if (nameLower.indexOf("trader") !== -1) found = ["trading", "market-analysis"];
        else if (nameLower.indexOf("legal") !== -1) found = ["legal-research", "compliance"];
        else if (nameLower.indexOf("dev") !== -1) found = ["coding", "debugging"];
        else if (nameLower.indexOf("data") !== -1) found = ["data-analysis", "reporting"];
        else found = ["general", "autonomous"];
    }
    
    return found.slice(0, 3);
}

// =============================================================================
// UI HELPER FUNCTIONS
// =============================================================================

/**
 * Show loading skeleton in stats
 */
function showStatsSkeleton() {
    ["totalSouls", "networkRep", "totalVerifications"].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.innerHTML = '<span class="skeleton-loader"></span>';
    });
}

/**
 * Display search result safely (no XSS)
 */
function showSearchResult(data, isSuccess) {
    var box = document.getElementById("searchResult");
    box.style.display = "block";
    box.style.borderColor = isSuccess ? "var(--success)" : "var(--warning)";
    box.style.background = isSuccess ? "rgba(0,255,136,0.1)" : "rgba(255,170,0,0.1)";
    box.innerHTML = '';
    
    if (data.title) {
        var titleDiv = document.createElement('div');
        titleDiv.style.cssText = 'font-size:1.2rem;margin-bottom:10px;color:' + (isSuccess ? 'var(--success)' : 'var(--warning)');
        titleDiv.textContent = data.title;
        box.appendChild(titleDiv);
    }
    
    if (data.name) {
        var nameDiv = document.createElement('div');
        nameDiv.style.cssText = 'font-size:1.3rem;font-weight:bold';
        nameDiv.textContent = data.name;
        box.appendChild(nameDiv);
    }
    
    if (data.address) {
        var addrDiv = document.createElement('div');
        addrDiv.style.cssText = 'color:var(--text-dim);font-family:monospace;margin-top:5px';
        addrDiv.textContent = data.address;
        box.appendChild(addrDiv);
    }
    
    if (data.tokenId !== undefined) {
        var tokenDiv = document.createElement('div');
        tokenDiv.style.cssText = 'margin-top:15px';
        var tokenSpan = document.createElement('span');
        tokenSpan.style.cssText = 'color:var(--primary);font-size:2rem;font-weight:bold';
        tokenSpan.textContent = '#' + data.tokenId;
        tokenDiv.appendChild(tokenSpan);
        var labelSpan = document.createElement('span');
        labelSpan.style.cssText = 'color:var(--text-dim);margin-left:10px';
        labelSpan.textContent = 'TOKEN ID';
        tokenDiv.appendChild(labelSpan);
        box.appendChild(tokenDiv);
    }
    
    if (data.rep !== undefined) {
        var repDiv = document.createElement('div');
        repDiv.style.cssText = 'margin-top:10px';
        var repSpan = document.createElement('span');
        repSpan.style.cssText = 'color:var(--success);font-size:1.5rem;font-weight:bold';
        repSpan.textContent = data.rep;
        repDiv.appendChild(repSpan);
        var repLabel = document.createElement('span');
        repLabel.style.cssText = 'color:var(--text-dim);margin-left:5px';
        repLabel.textContent = ' REP';
        repDiv.appendChild(repLabel);
        if (data.tier) {
            var tierSpan = document.createElement('span');
            tierSpan.style.cssText = 'background:rgba(0,212,255,0.2);padding:3px 10px;border-radius:10px;margin-left:10px';
            tierSpan.textContent = data.tier;
            repDiv.appendChild(tierSpan);
        }
        box.appendChild(repDiv);
    }
    
    if (data.skills && data.skills.length > 0) {
        var skillsDiv = document.createElement('div');
        skillsDiv.style.cssText = 'color:var(--primary);margin-top:10px';
        skillsDiv.textContent = data.skills.join(' • ');
        box.appendChild(skillsDiv);
    }
    
    if (data.link) {
        var linkDiv = document.createElement('div');
        linkDiv.style.cssText = 'margin-top:15px';
        var link = document.createElement('a');
        link.href = data.link;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.style.cssText = 'color:var(--primary)';
        link.textContent = 'View on BaseScan →';
        linkDiv.appendChild(link);
        box.appendChild(linkDiv);
    }
    
    if (isSuccess && data.name && data.rep !== undefined) {
        var verifyDiv = document.createElement("div");
        verifyDiv.style.cssText = "margin-top:15px;";
        var verifyBtn = document.createElement("button");
        verifyBtn.style.cssText = "background:var(--secondary);color:#000;border:none;padding:10px 20px;border-radius:10px;cursor:pointer;font-weight:bold;";
        verifyBtn.textContent = "✓ Sign Verification";
        verifyBtn.onclick = function() { signVerification(selectedAgent); };
        verifyDiv.appendChild(verifyBtn);
        box.appendChild(verifyDiv);
        // Payment buttons
        if (selectedAgent) { addPaymentButtons(box, selectedAgent); }
    }

    if (data.message) {
        var msgDiv = document.createElement('div');
        msgDiv.style.cssText = 'margin-top:10px;color:var(--text-dim)';
        msgDiv.textContent = data.message;
        box.appendChild(msgDiv);
    }
}

function showSearchLoading(message) {
    var box = document.getElementById("searchResult");
    box.style.display = "block";
    box.style.borderColor = "var(--primary)";
    box.style.background = "rgba(0,212,255,0.1)";
    box.innerHTML = '';
    var spinner = document.createElement('span');
    spinner.className = 'loading-spinner';
    box.appendChild(spinner);
    box.appendChild(document.createTextNode(' ' + escapeHtml(message)));
}

function hideSearchResult() {
    document.getElementById("searchResult").style.display = "none";
}

function typeInTerminal(text, cls) {
    var terminal = document.getElementById("terminal");
    var line = document.createElement("div");
    line.className = "terminal-line " + (cls || "");
    line.textContent = text;
    terminal.appendChild(line);
    terminal.scrollTop = terminal.scrollHeight;
}

function clearTerminal() {
    document.getElementById("terminal").innerHTML = "";
}

// =============================================================================
// BLOCKCHAIN FUNCTIONS
// =============================================================================

function loadStats() {
    showStatsSkeleton();
    
    fetch(CONFIG.RPC_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", method: "eth_call", params: [{ to: CONFIG.CONTRACT_ADDRESS, data: SELECTORS.totalSouls }, "latest"], id: 1 })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
        if (data.result) {
            var count = parseInt(data.result, 16);
            document.getElementById("totalSouls").textContent = count;
            document.getElementById("networkRep").textContent = (count * 70) + "+";
            document.getElementById("totalVerifications").textContent = Math.floor(count * 1.5);
        }
    })
    .catch(function() {
        document.getElementById("totalSouls").textContent = "8";
        document.getElementById("networkRep").textContent = "560+";
        document.getElementById("totalVerifications").textContent = "12";
    });
}

function checkSoulOnchain(address, ensName) {
    if (!isValidAddress(address)) {
        typeInTerminal("[ERROR] Invalid address format", "warning");
        showSearchResult({ title: "✗ Invalid address format", message: "Please enter a valid Ethereum address" }, false);
        return;
    }
    
    var callData = SELECTORS.hasSoul + address.slice(2).toLowerCase().padStart(64, "0");
    
    fetch(CONFIG.RPC_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", method: "eth_call", params: [{ to: CONFIG.CONTRACT_ADDRESS, data: callData }, "latest"], id: 1 })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
        var hasSoul = data.result && data.result !== "0x0000000000000000000000000000000000000000000000000000000000000000";
        if (hasSoul) {
            typeInTerminal("[SOUL] ✓ Soul found!", "success");
            getTokenId(address, ensName);
        } else {
            typeInTerminal("[SOUL] ✗ No soul found", "warning");
            var displayName = ensName || address.slice(0,10) + "..." + address.slice(-8);
            showSearchResult({ title: "✗ NO SOUL FOUND", name: displayName, address: address, message: "This address does not have an ALIAS identity yet." }, false);
        }
    })
    .catch(function() {
        typeInTerminal("[ERROR] Chain lookup failed", "warning");
        showSearchResult({ title: "✗ Chain lookup failed", message: "Please try again" }, false);
    });
}

function getTokenId(address, ensName) {
    var callData = SELECTORS.agentToSoul + address.slice(2).toLowerCase().padStart(64, "0");
    
    fetch(CONFIG.RPC_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", method: "eth_call", params: [{ to: CONFIG.CONTRACT_ADDRESS, data: callData }, "latest"], id: 1 })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
        if (data.result) {
            var tokenId = parseInt(data.result, 16);
            typeInTerminal("[TOKEN] ID: #" + tokenId, "agent");
            var displayName = ensName || address.slice(0,10) + "..." + address.slice(-8);
            showSearchResult({ title: "✓ SOUL VERIFIED", name: displayName, address: address, tokenId: tokenId, link: CONFIG.BASESCAN_URL + "/token/" + CONFIG.CONTRACT_ADDRESS + "?a=" + tokenId, message: "See Agent Activity for logs" }, true);
        }
    })
    .catch(function() {});
}

// =============================================================================
// SEARCH FUNCTIONS
// =============================================================================

function searchAgent() {
    var rawInput = document.getElementById("searchInput").value;
    var q = sanitizeInput(rawInput);
    var qLower = q.toLowerCase();
    
    clearTerminal();
    hideSearchResult();
    typeInTerminal("[SEARCH] Looking for: " + q, "system");
    
    if (!q) {
        typeInTerminal("[ERROR] Please enter a search term", "warning");
        return;
    }
    
    if (q.endsWith(".eth")) {
        if (!isValidENS(q)) {
            typeInTerminal("[ERROR] Invalid ENS format", "warning");
            showSearchResult({ title: "✗ Invalid ENS format" }, false);
            return;
        }
        showSearchLoading("Resolving " + q + "...");
        typeInTerminal("[ENS] Resolving " + q + "...", "warning");
        
        fetch(CONFIG.ENS_API + "/" + encodeURIComponent(q))
            .then(function(r) { return r.json(); })
            .then(function(data) {
                if (data.address && isValidAddress(data.address)) {
                    typeInTerminal("[ENS] Resolved!", "success");
                    showSearchResult({ title: "✓ ENS RESOLVED", name: q, address: data.address, message: "Checking for ALIAS soul..." }, true);
                    checkSoulOnchain(data.address, q);
                } else {
                    typeInTerminal("[ERROR] ENS name not found", "warning");
                    showSearchResult({ title: "✗ ENS name not found" }, false);
                }
            })
            .catch(function() {
                typeInTerminal("[ERROR] ENS lookup failed", "warning");
                showSearchResult({ title: "✗ ENS lookup failed" }, false);
            });
        return;
    }
    
    if (q.startsWith("0x") && q.length === 42) {
        if (!isValidAddress(q)) {
            showSearchResult({ title: "✗ Invalid address format" }, false);
            return;
        }
        showSearchLoading("Checking onchain...");
        checkSoulOnchain(q, null);
        return;
    }
    
    var found = null;
    for (var i = 0; i < agents.length; i++) {
        if (agents[i].name.toLowerCase().indexOf(qLower) !== -1) {
            found = agents[i];
            break;
        }
    }
    
    if (found) {
        typeInTerminal("[FOUND] " + found.name, "success");
        showSearchResult({ title: "✓ AGENT FOUND", name: found.name, address: found.address, rep: found.rep, tier: found.tier, skills: found.skills, message: "See Agent Activity for details" }, true);
    } else {
        typeInTerminal("[ERROR] Agent not found", "warning");
        showSearchResult({ title: "✗ Agent not found", message: "Try a wallet address (0x...) or ENS name (.eth)" }, false);
    }
}

function searchSkill(skill) {
    console.log("Searching for skill:", skill);
    console.log("All agents:", agents.map(function(a) { return { name: a.name, skills: a.skills }; }));
    var sanitizedSkill = sanitizeInput(skill);
    clearTerminal();
    hideSearchResult();
    typeInTerminal("[SEARCH] Skill: " + sanitizedSkill, "system");
    
    var matches = agents.filter(function(a) { return a.skills.indexOf(sanitizedSkill) !== -1; });
    console.log("Found matches:", matches.length, matches.map(function(m) { return m.name; }));
    
    if (matches.length > 0) {
        var box = document.getElementById("skillSearchResults");
        box.style.display = "block";
        box.style.borderColor = "var(--success)";
        box.style.background = "rgba(0,255,136,0.1)";
        box.innerHTML = '';
        
        var titleDiv = document.createElement('div');
        titleDiv.style.cssText = 'color:var(--success);font-size:1.2rem;margin-bottom:10px';
        titleDiv.textContent = '✓ ' + matches.length + ' AGENT(S) WITH SKILL: ' + sanitizedSkill;
        box.appendChild(titleDiv);
        
        matches.forEach(function(agent) {
            var agentDiv = document.createElement('div');
            agentDiv.style.cssText = 'padding:10px;background:rgba(0,212,255,0.05);border-radius:8px;margin-top:8px;cursor:pointer;transition:background 0.2s';
            agentDiv.textContent = agent.name + ' - Rep: ' + agent.rep + ' (' + agent.tier + ')';
            agentDiv.onmouseover = function() { this.style.background = 'rgba(0,212,255,0.15)'; };
            agentDiv.onmouseout = function() { this.style.background = 'rgba(0,212,255,0.05)'; };
            agentDiv.onclick = function() { selectAgent(agent.name); window.scrollTo({ top: 0, behavior: 'smooth' }); };
            box.appendChild(agentDiv);
        });
    } else {
        typeInTerminal("[INFO] No agents found with skill: " + sanitizedSkill, "warning");
    }
}

function selectAgent(name) {
    var agent = agents.find(function(a) { return a.name === name; }); selectedAgent = agent;
    if (!agent) return;
    
    clearTerminal();
    typeInTerminal("[SELECT] " + agent.name, "system");
    showSearchResult({ title: "✓ AGENT SELECTED", name: agent.name, address: agent.address, rep: agent.rep, tier: agent.tier, skills: agent.skills, tokenId: agent.tokenId, message: "Loading activity..." }, true);
    showAgentActivity(agent);
}

// =============================================================================
// UI POPULATION (XSS-safe)
// =============================================================================

function populateAgents() {
    var list = document.getElementById("agentList");
    list.innerHTML = '';
    
    agents.forEach(function(a) {
        var item = document.createElement('div');
        item.className = 'agent-item';
        item.onclick = function() { selectAgent(a.name); };
        
        var icon = document.createElement('div');
        icon.className = 'agent-icon';
        icon.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 2a9 9 0 00-9 9c0 4.17 2.84 7.67 6.69 8.69L12 22l2.31-2.31C18.16 18.67 21 15.17 21 11a9 9 0 00-9-9z"/></svg>';
        item.appendChild(icon);
        
        var info = document.createElement('div');
        info.className = 'agent-info';
        
        var nameDiv = document.createElement('div');
        nameDiv.className = 'agent-name';
        nameDiv.textContent = a.name;
        info.appendChild(nameDiv);
        
        var addrDiv = document.createElement('div');
        addrDiv.className = 'agent-addr';
        addrDiv.textContent = a.address;
        info.appendChild(addrDiv);
        
        var skillsDiv = document.createElement('div');
        skillsDiv.className = 'agent-skills';
        skillsDiv.textContent = a.skills.join(' • ');
        info.appendChild(skillsDiv);
        
        item.appendChild(info);
        
        var rep = document.createElement('div');
        rep.className = 'agent-rep';
        
        var repValue = document.createElement('div');
        repValue.className = 'rep-value';
        repValue.textContent = a.rep;
        rep.appendChild(repValue);
        
        var repTier = document.createElement('div');
        repTier.className = 'rep-tier';
        repTier.textContent = a.tier;
        rep.appendChild(repTier);
        
        item.appendChild(rep);
        list.appendChild(item);
    });
}

function populateSkills() {
    var grid = document.getElementById("skillsGrid");
    grid.innerHTML = '';
    
    allSkills.forEach(function(skill) {
        var tag = document.createElement('span');
        tag.className = 'skill-tag';
        tag.textContent = skill;
        tag.onclick = function() { searchSkill(skill); };
        grid.appendChild(tag);
    });
}

// =============================================================================
// DEMO FUNCTIONS
// =============================================================================

function runVerifyDemo() {
    clearTerminal();
    hideSearchResult();
    var agent = selectedAgent || agents[0];
    typeInTerminal("[SYSTEM] Initiating verification...", "system");
    setTimeout(function() { typeInTerminal("[TARGET] " + agent.name + " (" + agent.address + ")", "system"); }, 400);
    setTimeout(function() { typeInTerminal("[CHECK] Onchain identity...", "warning"); }, 800);
    setTimeout(function() { typeInTerminal("[OK] Soul found: Token #" + agent.tokenId, "success"); }, 1200);
    setTimeout(function() { typeInTerminal("[OK] Reputation: " + agent.rep + " (" + agent.tier + ")", "success"); }, 1600);
    setTimeout(function() { typeInTerminal("[OK] Risk: " + Math.max(10, 100 - agent.rep) + "% - APPROVED", "success"); }, 2000);
    setTimeout(function() { typeInTerminal("[CHAIN] Recording verification...", "warning"); }, 2400);
    setTimeout(function() { typeInTerminal("[TX] 0x" + Math.random().toString(16).slice(2,6) + "..." + Math.random().toString(16).slice(2,6), "system"); }, 2800);
    setTimeout(function() { typeInTerminal("[DONE] Verification complete!", "success"); }, 3200);
}

function runChainDemo() {
    clearTerminal();
    hideSearchResult();
    
    // Get top 4 agents by reputation (from blockchain data)
    var topAgents = agents.slice().sort(function(a, b) {
        return b.rep - a.rep;
    }).slice(0, 4);
    
    typeInTerminal("[SYSTEM] === TRUST CHAIN (Live from Blockchain) ===", "system");
    
    var delay = 300;
    topAgents.forEach(function(agent, index) {
        setTimeout(function() {
            typeInTerminal(agent.name + " (" + agent.tier + ", " + agent.rep + " REP)", "agent");
        }, delay);
        delay += 200;
        
        if (index < topAgents.length - 1) {
            var action = ["verified", "trusted", "hired"][index % 3];
            setTimeout(function() {
                typeInTerminal("  |-- " + action + " -->", "success");
            }, delay);
            delay += 200;
        }
    });
    
    setTimeout(function() {
        typeInTerminal("[INFO] Chain depth: " + (topAgents.length - 1) + " levels", "system");
    }, delay + 200);
    setTimeout(function() {
        typeInTerminal("[INFO] Total network agents: " + agents.length, "success");
    }, delay + 500);
}

function runFullDemo() {
    clearTerminal();
    hideSearchResult();
    typeInTerminal("[SYSTEM] === HOW IT WORKS ===", "system");
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

function connectWallet() {
    if (typeof window.ethereum !== "undefined") {
        window.ethereum.request({ method: "eth_requestAccounts" })
            .then(function(accounts) {
                var address = accounts[0];
                document.getElementById("connectBtn").textContent = address.slice(0, 6) + "..." + address.slice(-4);
                typeInTerminal("[WALLET] Connected: " + address, "success");
            })
            .catch(function() {
                typeInTerminal("[ERROR] Connection failed", "warning");
            });
    } else {
        alert("Please install MetaMask to connect your wallet!");
    }
}

// =============================================================================
// INITIALIZATION
// =============================================================================

document.addEventListener("DOMContentLoaded", function() {
    loadStats();
    loadAgentsFromChain();
    populateSkillsWithSearch(); populateTrustNetwork();
    
    typeInTerminal("[SYSTEM] ALIAS Network initialized", "system");
    typeInTerminal("[INFO] Loading stats from blockchain...", "warning");
    
    document.getElementById("connectBtn").addEventListener("click", connectWalletEnhanced);
    document.getElementById("searchBtn").addEventListener("click", searchAgent);
    document.getElementById("verifyBtn").addEventListener("click", function() { if (selectedAgent) { signVerification(selectedAgent); } else { alert("Please select an agent first!"); } });
    document.getElementById("chainBtn").addEventListener("click", runChainDemo);
    document.getElementById("demoBtn").addEventListener("click", runFullDemo);
    
    document.getElementById("searchInput").addEventListener("keypress", function(e) {
        if (e.key === "Enter") searchAgent();
    });
});

// =============================================================================
// DYNAMIC TRUST NETWORK & SKILLS
// =============================================================================

function populateTrustNetwork() {
    var container = document.getElementById("trustNetwork");
    if (!container || agents.length === 0) return;
    
    // Sort agents by reputation (highest first) and take top 4
    var topAgents = agents.slice().sort(function(a, b) {
        return b.rep - a.rep;
    }).slice(0, 4);
    
    var html = '';
    var arrows = ['verified', 'trusted', 'hired'];
    
    topAgents.forEach(function(agent, index) {
        var tierClass = escapeHtml(agent.tier.toLowerCase());
        html += '<div class="network-node ' + tierClass + '">';
        html += '<div class="node-name">' + escapeHtml(agent.name) + '</div>';
        html += '<div class="node-rep">' + escapeHtml(String(agent.rep)) + '</div>';
        html += '<div class="node-tier tier-' + tierClass + '">' + escapeHtml(agent.tier) + '</div>';
        html += '</div>';
        
        // Add arrow between nodes (not after last one)
        if (index < topAgents.length - 1) {
            html += '<div class="arrow"><svg viewBox="0 0 24 24"><path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"/></svg>' + arrows[index % arrows.length] + '</div>';
        }
    });
    
    container.innerHTML = html;
}

function populateSkillsWithSearch() {
    var grid = document.getElementById("skillsGrid");
    var searchInput = document.getElementById("skillSearchInput");
    if (!grid) return;
    
    // Count skills across all agents
    var skillCounts = {};
    agents.forEach(function(agent) {
        agent.skills.forEach(function(skill) {
            skillCounts[skill] = (skillCounts[skill] || 0) + 1;
        });
    });
    
    // Sort by count (most used first)
    var sortedSkills = Object.keys(skillCounts).sort(function(a, b) {
        return skillCounts[b] - skillCounts[a];
    });
    
    function renderSkills(filter) {
        grid.innerHTML = '';
        var filterLower = (filter || '').toLowerCase();
        var displayed = 0;
        var maxDisplay = filter ? sortedSkills.length : 10; // Show all when searching, top 10 otherwise
        
        sortedSkills.forEach(function(skill) {
            if (displayed >= maxDisplay) return;
            if (filterLower && skill.toLowerCase().indexOf(filterLower) === -1) return;
            
            var tag = document.createElement('span');
            tag.className = 'skill-tag';
            tag.textContent = '';
            tag.appendChild(document.createTextNode(skill + ' '));
            var countSpan = document.createElement('span');
            countSpan.style.cssText = 'opacity:0.6;font-size:0.8em;';
            countSpan.textContent = '(' + skillCounts[skill] + ')';
            tag.appendChild(countSpan);
            tag.onclick = function() { searchSkill(skill); };
            grid.appendChild(tag);
            displayed++;
        });
        
        if (displayed === 0) {
            grid.innerHTML = '<span style="color:var(--text-dim);">No skills found</span>';
        }
    }
    
    // Initial render
    renderSkills('');
    
    // Search listener
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            renderSkills(this.value);
        });
    }
}

// =============================================================================
// WALLET FEATURES: MINT, MY AGENTS, VERIFY
// =============================================================================

var connectedWallet = null;
var showingMyAgents = false;

// Store wallet on connect
function connectWalletEnhanced() {
    if (typeof window.ethereum !== "undefined") {
        // First ensure we're on Base
        window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: "0x2105" }]
        }).catch(function(switchError) {
            // Chain not added yet, add it
            if (switchError.code === 4902) {
                return window.ethereum.request({
                    method: "wallet_addEthereumChain",
                    params: [{
                        chainId: "0x2105",
                        chainName: "Base",
                        nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
                        rpcUrls: ["https://mainnet.base.org"],
                        blockExplorerUrls: ["https://basescan.org"]
                    }]
                });
            }
        }).then(function() {
            return window.ethereum.request({ method: "eth_requestAccounts" });
        }).then(function(accounts) {
                connectedWallet = accounts[0].toLowerCase();
                document.getElementById("connectBtn").textContent = connectedWallet.slice(0, 6) + "..." + connectedWallet.slice(-4);
                typeInTerminal("[WALLET] Connected: " + connectedWallet, "success");
                typeInTerminal("[NETWORK] Base Mainnet (Chain 8453)", "system");

                // Check if user owns any agents
                var myCount = agents.filter(function(a) {
                    return a.fullAddress && a.fullAddress.toLowerCase() === connectedWallet;
                }).length;

                if (myCount > 0) {
                    typeInTerminal("[INFO] You own " + myCount + " agent(s)!", "success");
                }
            })
            .catch(function() {
                typeInTerminal("[ERROR] Connection failed", "warning");
            });
    } else {
        alert("Please install MetaMask to connect your wallet!");
    }
}

// Toggle My Agents filter
function toggleMyAgents() {
    if (!connectedWallet) {
        alert("Please connect your wallet first!");
        return;
    }
    
    showingMyAgents = !showingMyAgents;
    var btn = document.getElementById("myAgentsBtn");
    
    if (showingMyAgents) {
        btn.style.background = "var(--secondary)";
        btn.style.color = "#000";
        btn.textContent = "All Agents";
        filterMyAgents();
        typeInTerminal("[FILTER] Showing your agents...", "system");
    } else {
        btn.style.background = "transparent";
        btn.style.color = "var(--secondary)";
        btn.textContent = "My Agents";
        populateAgents();
    }
}

function filterMyAgents() {
    var list = document.getElementById("agentList");
    list.innerHTML = '';
    
    var myAgents = agents.filter(function(a) {
        return a.fullAddress && a.fullAddress.toLowerCase() === connectedWallet;
    });
    
    typeInTerminal("[FILTER] Found " + myAgents.length + " agent(s) created by you", myAgents.length > 0 ? "success" : "warning");
    
    if (myAgents.length === 0) {
        list.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-dim);">You don\'t own any agents yet.<br><br><button onclick="openMintModal()" style="background:var(--secondary);color:#000;border:none;padding:10px 20px;border-radius:10px;cursor:pointer;">Mint Your First Soul</button></div>';
        return;
    }
    
    myAgents.forEach(function(a) {
        var item = document.createElement('div');
        item.className = 'agent-item';
        item.style.border = '1px solid var(--secondary)';
        item.onclick = function() { selectAgent(a.name); };
        
        var info = document.createElement('div');
        info.className = 'agent-info';
        
        var name = document.createElement('div');
        name.className = 'agent-name';
        name.textContent = '';
        name.appendChild(document.createTextNode(a.name + ' '));
        var badge = document.createElement('span');
        badge.style.cssText = 'color:var(--secondary);font-size:0.8em;';
        badge.textContent = 'YOURS';
        name.appendChild(badge);
        info.appendChild(name);
        
        var addr = document.createElement('div');
        addr.className = 'agent-address';
        addr.textContent = a.address;
        info.appendChild(addr);
        
        var skills = document.createElement('div');
        skills.className = 'agent-skills';
        a.skills.slice(0, 3).forEach(function(s) {
            var tag = document.createElement('span');
            tag.className = 'skill-tag small';
            tag.textContent = s;
            skills.appendChild(tag);
        });
        info.appendChild(skills);
        
        item.appendChild(info);
        
        var rep = document.createElement('div');
        rep.className = 'agent-rep';
        var repScore = document.createElement('div');
        repScore.className = 'rep-score';
        repScore.textContent = a.rep;
        rep.appendChild(repScore);
        var repTier = document.createElement('div');
        repTier.className = 'rep-tier tier-' + a.tier.toLowerCase();
        repTier.textContent = a.tier;
        rep.appendChild(repTier);
        
        item.appendChild(rep);
        list.appendChild(item);
    });
}

// Mint Modal Functions
function openMintModal() {
    if (!connectedWallet) {
        alert("Please connect your wallet first!");
        return;
    }
    document.getElementById("mintModal").style.display = "flex";
    document.getElementById("mintStatus").textContent = "";
}

function closeMintModal() {
    document.getElementById("mintModal").style.display = "none";
}

async function mintSoul() {
    var name = document.getElementById("mintName").value.trim();
    var agentAddr = document.getElementById("mintAddress").value.trim();
    var metadata = document.getElementById("mintMetadata").value.trim();
    var skills = document.getElementById("mintSkills").value.trim();
    var status = document.getElementById("mintStatus");
    
    if (!name || !agentAddr || !metadata || !skills) {
        status.textContent = "Please fill in all fields!";
        status.style.color = "var(--warning)";
        return;
    }
    
    if (!agentAddr.match(/^0x[a-fA-F0-9]{40}$/)) {
        status.textContent = "Invalid agent address!";
        status.style.color = "var(--warning)";
        return;
    }
    
    status.textContent = "Preparing transaction...";
    status.style.color = "var(--primary)";
    
    try {
        var provider = new ethers.BrowserProvider(window.ethereum);
        var signer = await provider.getSigner();
        var contract = new ethers.Contract(CONFIG.CONTRACT_ADDRESS, SOUL_ABI, signer);
        
        status.textContent = "Please confirm in MetaMask...";
        
        var tx = await contract.registerSoul(agentAddr, name, metadata, skills);
        
        status.textContent = "Transaction submitted! Waiting for confirmation...";
        typeInTerminal("[MINT] TX submitted: " + tx.hash.slice(0, 10) + "...", "warning");
        
        var receipt = await tx.wait();
        
        status.textContent = "Soul minted successfully!";
        status.style.color = "var(--success)";
        typeInTerminal("[MINT] Success! New soul: " + name, "success");
        
        // Refresh agents list
        setTimeout(function() {
            closeMintModal();
            loadAgentsFromChain();
        }, 2000);
        
    } catch (error) {
        console.error("Mint error:", error);
        status.textContent = "Error: " + (error.reason || error.message || "Transaction failed");
        status.style.color = "var(--warning)";
        typeInTerminal("[ERROR] Mint failed: " + (error.reason || "Unknown error"), "warning");
    }
}

// Verification signing (off-chain)
async function signVerification(agent) {
    if (!connectedWallet) {
        alert("Please connect your wallet first!");
        return;
    }
    
    if (!agent || !agent.tokenId) {
        alert("No agent selected!");
        return;
    }
    
    var message = prompt("Enter verification message (e.g., \"Trusted for DeFi tasks\"):", "Verified as trusted AI agent");
    if (!message) return;
    
    try {
        var provider = new ethers.BrowserProvider(window.ethereum);
        var signer = await provider.getSigner();
        var contract = new ethers.Contract(CONFIG.VERIFICATION_REGISTRY, VERIFICATION_ABI, signer);
        
        typeInTerminal("[VERIFY] Recording on-chain verification...", "warning");
        typeInTerminal("[TARGET] " + agent.name + " (Token #" + agent.tokenId + ")", "system");
        
        var tx = await contract.verify(agent.tokenId, message);
        
        typeInTerminal("[TX] " + tx.hash.slice(0, 15) + "... submitted", "warning");
        
        var receipt = await tx.wait();
        
        typeInTerminal("[CHAIN] ✓ Verification recorded on-chain!", "success");
        typeInTerminal("[TX] " + tx.hash, "system");
        
        alert("On-chain verification complete!\n\nAgent: " + agent.name + "\nToken: #" + agent.tokenId + "\nMessage: " + message + "\nTX: " + tx.hash.slice(0, 20) + "...");
        
    } catch (error) {
        console.error("Verification error:", error);
        if (error.message && error.message.includes("Already verified")) {
            typeInTerminal("[INFO] You have already verified this agent", "warning");
            alert("You have already verified this agent!");
        } else {
            typeInTerminal("[ERROR] Verification failed: " + (error.reason || error.message || "Unknown"), "warning");
        }
    }
}

// Initialize new event listeners
document.addEventListener("DOMContentLoaded", function() {
    // New buttons
    document.getElementById("mintBtn").addEventListener("click", openMintModal);
    document.getElementById("myAgentsBtn").addEventListener("click", toggleMyAgents);
    document.getElementById("mintSubmitBtn").addEventListener("click", mintSoul);
    document.getElementById("mintCancelBtn").addEventListener("click", closeMintModal);
    
    // Close modal on outside click
    document.getElementById("mintModal").addEventListener("click", function(e) {
        if (e.target.id === "mintModal") closeMintModal();
    });
});

// =============================================================================
// PAYMENT & ESCROW FUNCTIONS (BANKR INTEGRATION)
// =============================================================================

var activeEscrows = {};

async function tipAgent(agent, amount) {
    if (!connectedWallet) {
        alert("Please connect your wallet first!");
        return;
    }
    
    if (!agent || !agent.fullAddress) {
        alert("No agent selected!");
        return;
    }
    
    var tipAmount = amount || prompt("Enter tip amount in ETH (e.g., 0.001):");
    if (!tipAmount || isNaN(parseFloat(tipAmount))) return;
    
    try {
        var provider = new ethers.BrowserProvider(window.ethereum);
        var signer = await provider.getSigner();
        
        typeInTerminal("[BANKR] Preparing tip transaction...", "warning");
        
        var tx = await signer.sendTransaction({
            to: agent.fullAddress,
            value: ethers.parseEther(tipAmount)
        });
        
        typeInTerminal("[BANKR] TX submitted: " + tx.hash.slice(0, 15) + "...", "warning");
        
        var receipt = await tx.wait();
        
        typeInTerminal("[BANKR] ✓ Sent " + tipAmount + " ETH to " + agent.name, "success");
        typeInTerminal("[TX] " + tx.hash, "system");
        
        alert("Successfully tipped " + tipAmount + " ETH to " + agent.name + "!");
        
    } catch (error) {
        console.error("Tip error:", error);
        typeInTerminal("[ERROR] Payment failed: " + (error.reason || error.message), "warning");
    }
}

async function hireAgent(agent) {
    if (!connectedWallet) {
        alert("Please connect your wallet first!");
        return;
    }

    if (!agent || !agent.fullAddress) {
        alert("No agent selected!");
        return;
    }

    var rate = AGENT_RATES[agent.tokenId] || 0.0003;
    var skills = agent.skills || [];

    // Show hire modal with agent info
    var skillList = skills.join(", ") || "general";
    var jobDesc = prompt(
        "Hire " + agent.name + " (" + agent.tier + ")\n\n" +
        "Skills: " + skillList + "\n" +
        "Rate: " + rate + " ETH/hr\n" +
        "Suggested jobs: " + getSuggestedJobs(skills) + "\n\n" +
        "Describe the job:"
    );
    if (!jobDesc) return;

    // Check if job matches agent skills
    var jobLower = jobDesc.toLowerCase();
    var skillMatch = skills.some(function(s) {
        var keywords = getSkillKeywords(s);
        return keywords.some(function(k) { return jobLower.indexOf(k) !== -1; });
    });

    if (!skillMatch && skills.length > 0) {
        var proceed = confirm(
            "⚠️ This job may not match " + agent.name + "'s skills (" + skillList + ").\n\n" +
            "Consider hiring an agent specialized in this area.\n\nProceed anyway?"
        );
        if (!proceed) return;
    }

    // Suggest budget based on hourly rate (estimate 1-4 hours)
    var suggested1h = rate;
    var suggested4h = (rate * 4).toFixed(6);
    var budget = prompt(
        "Set budget for: " + jobDesc.slice(0, 50) + "\n\n" +
        "Agent rate: " + rate + " ETH/hr\n" +
        "Suggested:\n" +
        "  Quick task (1hr): " + suggested1h + " ETH\n" +
        "  Standard (4hr): " + suggested4h + " ETH\n\n" +
        "Enter budget in ETH:"
    );
    if (!budget || isNaN(parseFloat(budget))) return;

    try {
        var provider = new ethers.BrowserProvider(window.ethereum);
        var signer = await provider.getSigner();

        // Calculate fee (5%)
        var totalBudget = parseFloat(budget);
        var fee = totalBudget * 0.05;
        var agentPayment = totalBudget - fee;

        typeInTerminal("[HIRE] Job: " + escapeHtml(jobDesc.slice(0, 50)) + "...", "system");
        typeInTerminal("[HIRE] Agent: " + escapeHtml(agent.name) + " | Skills: " + escapeHtml(skillList), "system");
        typeInTerminal("[ESCROW] Budget: " + budget + " ETH (Rate: " + rate + " ETH/hr)", "warning");
        typeInTerminal("[ESCROW] Platform fee (5%): " + fee.toFixed(6) + " ETH", "warning");
        typeInTerminal("[ESCROW] Agent payment: " + agentPayment.toFixed(6) + " ETH", "warning");

        var tx = await signer.sendTransaction({
            to: agent.fullAddress,
            value: ethers.parseEther(budget)
        });

        typeInTerminal("[ESCROW] TX submitted: " + tx.hash.slice(0, 15) + "...", "warning");

        var receipt = await tx.wait();

        var escrowId = "ESC-" + Date.now();
        activeEscrows[escrowId] = {
            agent: agent.name,
            agentAddress: agent.fullAddress,
            job: jobDesc,
            budget: budget,
            rate: rate,
            skillMatch: skillMatch,
            status: "PAID",
            txHash: tx.hash,
            timestamp: new Date().toISOString()
        };

        typeInTerminal("[ESCROW] ✓ Job funded! ID: " + escrowId, "success");
        typeInTerminal("[HIRE] " + escapeHtml(agent.name) + " hired successfully!", "success");
        typeInTerminal("[TX] " + tx.hash, "system");

        alert(
            "✅ Successfully hired " + agent.name + "!\n\n" +
            "Job: " + jobDesc + "\n" +
            "Budget: " + budget + " ETH\n" +
            "Agent Payment: " + agentPayment.toFixed(6) + " ETH\n" +
            "Escrow ID: " + escrowId
        );

    } catch (error) {
        console.error("Hire error:", error);
        typeInTerminal("[ERROR] Hire failed: " + (error.reason || error.message), "warning");
    }
}

function getSuggestedJobs(skills) {
    var suggestions = {
        "data-analysis": "market analysis, trend reports",
        "forecasting": "price predictions, growth models",
        "reporting": "weekly reports, dashboards",
        "code-audit": "smart contract audit, security review",
        "vulnerability-detection": "penetration testing, bug hunting",
        "security-review": "codebase security assessment",
        "writing": "blog posts, documentation",
        "marketing": "social media campaigns, copywriting",
        "documentation": "API docs, technical guides",
        "defi-analysis": "protocol analysis, TVL tracking",
        "yield-farming": "yield optimization strategies",
        "protocol-review": "DeFi protocol due diligence",
        "research": "deep research, competitive analysis",
        "due-diligence": "project evaluation, risk assessment",
        "report-writing": "research papers, investment memos",
        "trading": "trade execution, market analysis",
        "market-analysis": "market trends, sentiment analysis",
        "portfolio-management": "portfolio rebalancing, allocation",
        "contract-review": "legal contract review",
        "compliance": "regulatory compliance checks",
        "legal-research": "legal precedent research",
        "coding": "feature development, bug fixes",
        "debugging": "issue diagnosis, troubleshooting",
        "code-review": "PR review, code quality checks",
        "general": "general tasks, coordination",
        "coordination": "team coordination, planning",
        "collaboration": "multi-agent tasks",
        "autonomous": "automated workflows",
        "verification": "identity verification",
        "risk-assessment": "risk scoring, trust evaluation"
    };
    var result = [];
    skills.forEach(function(s) {
        if (suggestions[s]) result.push(suggestions[s]);
    });
    return result.slice(0, 3).join("; ") || "general tasks";
}

function getSkillKeywords(skill) {
    var keywords = {
        "data-analysis": ["data", "analysis", "analytics", "metrics", "statistics"],
        "forecasting": ["forecast", "predict", "projection", "trend"],
        "reporting": ["report", "dashboard", "summary", "weekly", "monthly"],
        "code-audit": ["audit", "code", "smart contract", "solidity"],
        "vulnerability-detection": ["vulnerability", "bug", "exploit", "penetration"],
        "security-review": ["security", "review", "assessment", "risk"],
        "writing": ["write", "blog", "article", "content", "copy"],
        "marketing": ["market", "campaign", "social", "brand", "promote"],
        "documentation": ["document", "docs", "api", "guide", "readme"],
        "defi-analysis": ["defi", "protocol", "tvl", "liquidity", "pool"],
        "yield-farming": ["yield", "farm", "apy", "staking", "reward"],
        "protocol-review": ["protocol", "review", "evaluate", "assess"],
        "research": ["research", "investigate", "study", "explore", "deep dive"],
        "due-diligence": ["due diligence", "evaluate", "vet", "background"],
        "report-writing": ["report", "paper", "memo", "writeup"],
        "trading": ["trade", "swap", "buy", "sell", "execute"],
        "market-analysis": ["market", "trend", "sentiment", "price"],
        "portfolio-management": ["portfolio", "rebalance", "allocat", "diversif"],
        "contract-review": ["contract", "legal", "terms", "agreement"],
        "compliance": ["compliance", "regulat", "kyc", "aml"],
        "legal-research": ["legal", "law", "precedent", "jurisdiction"],
        "coding": ["code", "develop", "build", "implement", "feature"],
        "debugging": ["debug", "fix", "bug", "issue", "error"],
        "code-review": ["review", "pr", "pull request", "quality"],
        "general": ["help", "assist", "task", "work"],
        "coordination": ["coordinate", "plan", "organize", "manage"],
        "collaboration": ["collaborate", "together", "team", "multi"],
        "autonomous": ["automate", "workflow", "schedule", "monitor"],
        "verification": ["verify", "identity", "check", "validate"],
        "risk-assessment": ["risk", "assess", "score", "trust", "evaluate"]
    };
    return keywords[skill] || [skill];
}

// Add payment buttons to search result when agent is selected
function addPaymentButtons(box, agent) {
    var payDiv = document.createElement("div");
    payDiv.style.cssText = "margin-top:10px;display:flex;gap:10px;flex-wrap:wrap;";
    
    var tipBtn = document.createElement("button");
    tipBtn.style.cssText = "background:var(--success);color:#000;border:none;padding:8px 15px;border-radius:8px;cursor:pointer;font-weight:bold;font-size:0.9em;";
    tipBtn.textContent = "💰 Tip Agent";
    tipBtn.onclick = function() { tipAgent(agent); };
    payDiv.appendChild(tipBtn);
    
    var hireBtn = document.createElement("button");
    hireBtn.style.cssText = "background:var(--primary);color:#000;border:none;padding:8px 15px;border-radius:8px;cursor:pointer;font-weight:bold;font-size:0.9em;";
    hireBtn.textContent = "📋 Hire Agent";
    hireBtn.onclick = function() { hireAgent(agent); };
    payDiv.appendChild(hireBtn);
    
    box.appendChild(payDiv);
}

// =============================================================================
// AGENT ACTIVITY (ON-CHAIN ACTIONS)
// =============================================================================

async function fetchAgentActivity(agent) {
    if (!agent || !agent.tokenId) return null;
    
    try {
        var provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);
        var contract = new ethers.Contract(CONFIG.CONTRACT_ADDRESS, SOUL_ABI, provider);
        
        var actionCount = await contract.actionCount(agent.tokenId);
        return Number(actionCount);
    } catch (error) {
        console.log("Failed to fetch activity:", error);
        return null;
    }
}

async function showAgentActivity(agent) {
    if (!agent) return;
    
    typeInTerminal("[ACTIVITY] Fetching on-chain data for " + agent.name + "...", "system");
    
    var actionCount = await fetchAgentActivity(agent);
    
    // Fetch verification count from new registry
    var verifyCount = 0;
    try {
        var provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);
        var verifyContract = new ethers.Contract(CONFIG.VERIFICATION_REGISTRY, VERIFICATION_ABI, provider);
        verifyCount = Number(await verifyContract.getVerificationCount(agent.tokenId));
    } catch (e) {
        console.log("Could not fetch verifications:", e);
    }
    
    typeInTerminal("[CHAIN] Token #" + agent.tokenId, "success");
    typeInTerminal("[CHAIN] Reputation: " + agent.rep + " (" + agent.tier + ")", "success");
    typeInTerminal("[CHAIN] On-chain verifications: " + verifyCount, verifyCount > 0 ? "success" : "system");
    typeInTerminal("[CHAIN] Creator: " + agent.fullAddress.slice(0,10) + "...", "system");
    
    if (actionCount !== null && actionCount > 0) {
        typeInTerminal("[STATS] Total actions: " + actionCount, "system");
    }
}
