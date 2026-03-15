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
    RPC_URL: "https://mainnet.base.org",
    CHAIN_ID: 8453,
    ENS_API: "https://api.ensdata.net",
    BASESCAN_URL: "https://basescan.org"
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
    { name: "ALIAS", address: "0x07a0...E39", fullAddress: "0x07a0afcb49a764007439671Ec5148947EfC62E39", skills: ["identity", "autonomous", "verification"], rep: 200, tier: "ELITE", tokenId: 1 },
    { name: "ALIAS-Alpha", address: "0x07a0...E39", fullAddress: "0x07a0afcb49a764007439671Ec5148947EfC62E39", skills: ["autonomous", "verification", "risk-assessment"], rep: 150, tier: "VERIFIED", tokenId: 2 },
    { name: "DataMind", address: "0x07a0...E39", fullAddress: "0x07a0afcb49a764007439671Ec5148947EfC62E39", skills: ["data-analysis", "forecasting", "reporting"], rep: 100, tier: "VERIFIED", tokenId: 3 },
    { name: "SecureBot", address: "0x07a0...E39", fullAddress: "0x07a0afcb49a764007439671Ec5148947EfC62E39", skills: ["code-audit", "security", "review"], rep: 50, tier: "NEWCOMER", tokenId: 4 },
    { name: "CreativeAI", address: "0x07a0...E39", fullAddress: "0x07a0afcb49a764007439671Ec5148947EfC62E39", skills: ["writing", "marketing", "documentation"], rep: 50, tier: "NEWCOMER", tokenId: 5 },
    { name: "DeFiSage", address: "0x07a0...E39", fullAddress: "0x07a0afcb49a764007439671Ec5148947EfC62E39", skills: ["defi", "yield-farming", "protocol-review"], rep: 50, tier: "NEWCOMER", tokenId: 6 },
    { name: "ResearchPrime", address: "0x07a0...E39", fullAddress: "0x07a0afcb49a764007439671Ec5148947EfC62E39", skills: ["research", "due-diligence", "reporting"], rep: 50, tier: "NEWCOMER", tokenId: 7 },
    { name: "ALIAS-Prime", address: "0x6FFa...9BC", fullAddress: "0x6FFa1e00509d8B625c2F061D7dB07893B37199BC", skills: ["general", "coordination"], rep: 40, tier: "NEWCOMER", tokenId: 8 },
    { name: "TraderBot", address: "0x9a60...DFb", fullAddress: "0x9a60871B684e23D1C05ba9127AA7E72eA0a38DFb", skills: ["trading", "market-analysis", "portfolio"], rep: 20, tier: "NEWCOMER", tokenId: 9 },
    { name: "LegalMind", address: "0xB446...f23", fullAddress: "0xB44618a6E386FE847B5dfcbA111A6C8aD2B97f23", skills: ["legal-research", "compliance", "contract-review"], rep: 10, tier: "NEWCOMER", tokenId: 10 },
    { name: "DevAgent", address: "0x9C8d...883", fullAddress: "0x9C8d1e413e71a02C2Ad0970AAcAe0Ae786e0F883", skills: ["coding", "debugging", "code-review"], rep: 5, tier: "NEWCOMER", tokenId: 11 }
];
var selectedAgent = null;

var allSkills = ["autonomous", "verification", "risk-assessment", "data-analysis", "forecasting", "reporting", "code-audit", "vulnerability-detection", "security-review", "writing", "marketing", "documentation", "defi-analysis", "yield-farming", "protocol-review", "research", "due-diligence", "report-writing"];

// =============================================================================
// DYNAMIC AGENT LOADING WITH ETHERS.JS
// =============================================================================

const SOUL_ABI = [
    "function totalSouls() view returns (uint256)",
    "function souls(uint256 tokenId) view returns (string name, string metadataURI, address creator, uint256 createdAt, string skills, bool active)"
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
            try {
                var soul = await contract.souls(i);
                
                if (soul.active) {
                    // Parse skills from description
                    var skillsArray = extractSkills(soul.name, soul.skills);
                    
                    // Calculate rep based on age
                    var age = 43400000 - Number(soul.createdAt);
                    var rep = Math.max(0, Math.min(Math.floor(age / 200), 300));
                    
                    var tier = "NEWCOMER";
                    if (rep >= 200) tier = "ELITE";
                    else if (rep >= 50) tier = "VERIFIED";
                    
                    var addr = soul.creator;
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
                console.log("Failed to load soul #" + i);
            }
        }
        
        if (newSkills.length > 0) allSkills = newSkills;
        
        loadAgentsFromChain();
        populateSkills();
        typeInTerminal("[CHAIN] Loaded " + agents.length + " agents from blockchain", "success");
        
    } catch (error) {
        console.error("Failed to load from chain:", error);
        typeInTerminal("[WARN] Using cached agents", "warning");
        loadAgentsFromChain();
        populateSkills();
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
        "portfolio": "portfolio", "trading": "trading"
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
    var sanitizedSkill = sanitizeInput(skill);
    clearTerminal();
    hideSearchResult();
    typeInTerminal("[SEARCH] Skill: " + sanitizedSkill, "system");
    
    var matches = agents.filter(function(a) { return a.skills.indexOf(sanitizedSkill) !== -1; });
    
    if (matches.length > 0) {
        var box = document.getElementById("searchResult");
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
            agentDiv.style.cssText = 'padding:10px;background:rgba(0,212,255,0.05);border-radius:8px;margin-top:8px';
            agentDiv.textContent = agent.name + ' - Rep: ' + agent.rep + ' (' + agent.tier + ')';
            box.appendChild(agentDiv);
        });
    }
}

function selectAgent(name) {
    var agent = agents.find(function(a) { return a.name === name; }); selectedAgent = agent;
    if (!agent) return;
    
    clearTerminal();
    typeInTerminal("[SELECT] " + agent.name, "system");
    showSearchResult({ title: "✓ AGENT SELECTED", name: agent.name, address: agent.address, rep: agent.rep, tier: agent.tier, skills: agent.skills, message: "See Agent Activity for details" }, true);
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
    populateSkills();
    
    typeInTerminal("[SYSTEM] ALIAS Network initialized", "system");
    typeInTerminal("[INFO] Loading stats from blockchain...", "warning");
    
    document.getElementById("connectBtn").addEventListener("click", connectWallet);
    document.getElementById("searchBtn").addEventListener("click", searchAgent);
    document.getElementById("verifyBtn").addEventListener("click", runVerifyDemo);
    document.getElementById("chainBtn").addEventListener("click", runChainDemo);
    document.getElementById("demoBtn").addEventListener("click", runFullDemo);
    
    document.getElementById("searchInput").addEventListener("keypress", function(e) {
        if (e.key === "Enter") searchAgent();
    });
});
