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
    VERIFICATION_REGISTRY: "0x4f59c273dA1D1f4c9a9C1D0b82D7d5df006b2715",
    API_URL: "https://89-167-68-215.sslip.io",
    PLATFORM_WALLET: "0x7F66dFcD8e9e4e7Ec435D0631C5d723fFaDdb211",
    JOB_REGISTRY: "0x7Fa3c9C28447d6ED6671b49d537E728f678568C8"
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
// TOAST NOTIFICATIONS
// =============================================================================

function showToast(message, type, duration) {
    type = type || 'info';
    duration = duration || 5000;
    var container = document.getElementById('toastContainer');
    if (!container) return;

    var toast = document.createElement('div');
    toast.className = 'toast ' + type;

    var msgSpan = document.createElement('span');
    msgSpan.textContent = message;
    toast.appendChild(msgSpan);

    var closeBtn = document.createElement('button');
    closeBtn.className = 'toast-close';
    closeBtn.textContent = '\u00d7';
    closeBtn.onclick = function() { removeToast(toast); };
    toast.appendChild(closeBtn);

    container.appendChild(toast);

    var timer = setTimeout(function() { removeToast(toast); }, duration);
    toast.onclick = function() { clearTimeout(timer); removeToast(toast); };
}

function removeToast(toast) {
    if (!toast || !toast.parentNode) return;
    toast.style.animation = 'toastOut 0.3s ease-in forwards';
    setTimeout(function() { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 300);
}

// Loading overlay for long-running jobs
function showJobLoading(agentName) {
    var existing = document.getElementById('jobLoadingOverlay');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.className = 'job-loading-overlay';
    overlay.id = 'jobLoadingOverlay';

    var box = document.createElement('div');
    box.className = 'job-loading-box';

    var spinner = document.createElement('div');
    spinner.className = 'job-loading-spinner';
    box.appendChild(spinner);

    var text = document.createElement('div');
    text.className = 'job-loading-text';
    text.id = 'jobLoadingText';
    text.textContent = agentName + ' is working on your job...';
    box.appendChild(text);

    var sub = document.createElement('div');
    sub.className = 'job-loading-sub';
    sub.textContent = 'AI processing via Venice - this may take 10-30 seconds';
    box.appendChild(sub);

    overlay.appendChild(box);
    document.body.appendChild(overlay);
}

function hideJobLoading() {
    var overlay = document.getElementById('jobLoadingOverlay');
    if (overlay) overlay.remove();
}

function updateJobLoadingText(text) {
    var el = document.getElementById('jobLoadingText');
    if (el) el.textContent = text;
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

const JOB_REGISTRY_ABI = [
    "function recordJob(uint256 tokenId, string escrowId, string message) external",
    "function getJobCount(uint256 tokenId) external view returns (uint256)",
    "function getJobs(uint256 tokenId, uint256 offset, uint256 limit) external view returns (tuple(address recorder, uint256 timestamp, string escrowId, string message)[])"
];


// Create a provider that skips network detection (avoids SES lockdown issues)
function getStaticProvider() {
    return new ethers.JsonRpcProvider(CONFIG.RPC_URL, 8453, { staticNetwork: true });
}

async function loadAgentsFromChain() {
    var list = document.getElementById("agentList");
    list.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-dim)"><span class="loading-spinner"></span> Loading from blockchain...</div>';

    try {
        var provider = getStaticProvider();
        var contract = new ethers.Contract(CONFIG.CONTRACT_ADDRESS, SOUL_ABI, provider);
        
        var totalSouls = await contract.totalSouls();
        var count = Number(totalSouls);
        
        // Clear agents array and rebuild from chain
        agents = [];
        var newSkills = [];
        
        var verifyContract = new ethers.Contract(CONFIG.VERIFICATION_REGISTRY, VERIFICATION_ABI, provider);
        var jobContract = new ethers.Contract(CONFIG.JOB_REGISTRY, JOB_REGISTRY_ABI, provider);

        for (var i = 1; i <= count; i++) {
            await new Promise(function(r) { setTimeout(r, 200); });
            try {
                var soul = await contract.souls(i);

                if (soul.active) {
                    var skillsArray = extractSkills(soul.name, soul.skills);

                    // Fetch on-chain activity data
                    var actions = 0;
                    var verifications = 0;
                    var jobCount = 0;
                    try {
                        actions = Number(await contract.actionCount(i));
                    } catch (e) {}
                    try {
                        verifications = Number(await verifyContract.getVerificationCount(i));
                    } catch (e) {}
                    try {
                        jobCount = Number(await jobContract.getJobCount(i));
                    } catch (e) {}

                    // Calculate reputation: age + actions (20pts) + verifications (15pts) + jobs (25pts)
                    var age = Math.floor(Date.now() / 1000) - Number(soul.createdAt);
                    var ageRep = Math.min(Math.floor(age / 600), 100);
                    var actionRep = actions * 20;
                    var verifyRep = verifications * 15;
                    var jobRep = jobCount * 25;
                    var rep = Math.max(0, ageRep + actionRep + verifyRep + jobRep);

                    var tier = "NEWCOMER";
                    if (rep >= 500) tier = "LEGENDARY";
                    else if (rep >= 200) tier = "ELITE";
                    else if (rep >= 100) tier = "TRUSTED";
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
                        description: soul.skills,
                        actions: actions,
                        verifications: verifications,
                        jobCount: jobCount
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
    ["totalSouls", "networkRep", "totalVerifications", "totalVolume"].forEach(function(id) {
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

    // Load all stats from actual on-chain data
    var provider = getStaticProvider();
    var contract = new ethers.Contract(CONFIG.CONTRACT_ADDRESS, SOUL_ABI, provider);
    var verifyContract = new ethers.Contract(CONFIG.VERIFICATION_REGISTRY, VERIFICATION_ABI, provider);
    var jobContract = new ethers.Contract(CONFIG.JOB_REGISTRY, JOB_REGISTRY_ABI, provider);

    contract.totalSouls().then(function(totalSouls) {
        var count = Number(totalSouls);
        document.getElementById("totalSouls").textContent = count;

        // Calculate real network rep + total verifications + jobs from chain
        var totalRep = 0;
        var totalVerifications = 0;
        var totalJobs = 0;
        var loaded = 0;

        for (var i = 1; i <= count; i++) {
            (function(tokenId) {
                var agentActions = 0, agentVerifies = 0, agentJobs = 0, agentAge = 0;

                Promise.all([
                    contract.souls(tokenId).catch(function() { return null; }),
                    contract.actionCount(tokenId).catch(function() { return 0; }),
                    verifyContract.getVerificationCount(tokenId).catch(function() { return 0; }),
                    jobContract.getJobCount(tokenId).catch(function() { return 0; })
                ]).then(function(results) {
                    var soul = results[0];
                    agentActions = Number(results[1]);
                    agentVerifies = Number(results[2]);
                    agentJobs = Number(results[3]);

                    if (soul && soul.active) {
                        agentAge = Math.floor(Date.now() / 1000) - Number(soul.createdAt);
                        var ageRep = Math.min(Math.floor(agentAge / 600), 100);
                        totalRep += ageRep + (agentActions * 20) + (agentVerifies * 15) + (agentJobs * 25);
                    }
                    totalVerifications += agentVerifies;
                    totalJobs += agentJobs;

                    loaded++;
                    if (loaded === count) {
                        document.getElementById("networkRep").textContent = totalRep;
                        document.getElementById("totalVerifications").textContent = totalVerifications + totalJobs;
                        document.getElementById("totalVolume").textContent = totalJobs;
                    }
                });
            })(i);
        }
    }).catch(function() {
        document.getElementById("totalSouls").textContent = "--";
        document.getElementById("networkRep").textContent = "--";
        document.getElementById("totalVerifications").textContent = "--";
        document.getElementById("totalVolume").textContent = "--";
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
        
        var headerDiv = document.createElement('div');
        headerDiv.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:10px';

        var titleDiv = document.createElement('div');
        titleDiv.style.cssText = 'color:var(--success);font-size:1.2rem';
        titleDiv.textContent = '✓ ' + matches.length + ' AGENT(S) WITH SKILL: ' + sanitizedSkill;
        headerDiv.appendChild(titleDiv);

        var closeBtn = document.createElement('button');
        closeBtn.style.cssText = 'background:none;border:1px solid var(--text-dim);color:var(--text);width:28px;height:28px;border-radius:50%;cursor:pointer;font-size:1rem;display:flex;align-items:center;justify-content:center;';
        closeBtn.textContent = '✕';
        closeBtn.title = 'Close';
        closeBtn.onclick = function() { box.style.display = 'none'; box.innerHTML = ''; };
        headerDiv.appendChild(closeBtn);

        box.appendChild(headerDiv);
        
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
    var wp = getWalletProvider();
    if (wp) {
        wp.request({ method: "eth_requestAccounts" })
            .then(function(accounts) {
                var address = accounts[0];
                document.getElementById("connectBtn").textContent = address.slice(0, 6) + "..." + address.slice(-4);
                typeInTerminal("[WALLET] Connected: " + address, "success");
            })
            .catch(function() {
                typeInTerminal("[ERROR] Connection failed", "warning");
            });
    } else {
        showToast("Please install MetaMask to connect your wallet!", "error");
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
    autoReconnectWallet();
    document.getElementById("searchBtn").addEventListener("click", searchAgent);
    document.getElementById("verifyBtn").addEventListener("click", function() { if (selectedAgent) { signVerification(selectedAgent); } else { showToast("Please select an agent first!", "warning"); } });
    document.getElementById("chainBtn").addEventListener("click", runChainDemo);
    document.getElementById("demoBtn").addEventListener("click", runFullDemo);
    document.getElementById("jobsBtn").addEventListener("click", showJobHistory);
    
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

    var topAgents = agents.slice().sort(function(a, b) {
        return b.rep - a.rep;
    }).slice(0, 4);

    container.innerHTML = '';
    var arrows = ['verified', 'trusted', 'hired'];

    topAgents.forEach(function(agent, index) {
        var tierClass = agent.tier.toLowerCase();
        var node = document.createElement('div');
        node.className = 'network-node ' + tierClass;

        var nameDiv = document.createElement('div');
        nameDiv.className = 'node-name';
        nameDiv.textContent = agent.name;
        node.appendChild(nameDiv);

        var repDiv = document.createElement('div');
        repDiv.className = 'node-rep';
        repDiv.textContent = agent.rep;
        node.appendChild(repDiv);

        var tierDiv = document.createElement('div');
        tierDiv.className = 'node-tier tier-' + tierClass;
        tierDiv.textContent = agent.tier;
        node.appendChild(tierDiv);

        container.appendChild(node);

        if (index < topAgents.length - 1) {
            var arrowDiv = document.createElement('div');
            arrowDiv.className = 'arrow';
            arrowDiv.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"/></svg>';
            arrowDiv.appendChild(document.createTextNode(arrows[index % arrows.length]));
            container.appendChild(arrowDiv);
        }
    });
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

// EIP-6963: Modern wallet discovery (bypasses MetaMask's buggy proxy)
var rawWalletProvider = null;

window.addEventListener("eip6963:announceProvider", function(event) {
    // Prefer MetaMask but accept any provider
    if (!rawWalletProvider || (event.detail.info && event.detail.info.rdns === "io.metamask")) {
        rawWalletProvider = event.detail.provider;
        console.log("EIP-6963 provider found:", event.detail.info ? event.detail.info.name : "unknown");
    }
});
window.dispatchEvent(new Event("eip6963:requestProvider"));

// Create a safe wrapper that only exposes request() - avoids MetaMask SES proxy
// traps on selectedAddress getter that cause infinite recursion
function createSafeProvider(raw) {
    return {
        request: function(args) { return raw.request(args); },
        on: function(evt, fn) { if (raw.on) raw.on(evt, fn); },
        removeListener: function(evt, fn) { if (raw.removeListener) raw.removeListener(evt, fn); },
        removeAllListeners: function(evt) { if (raw.removeAllListeners) raw.removeAllListeners(evt); },
        isMetaMask: true
    };
}

// Get a safe provider reference (wrapped to avoid SES proxy bug)
var _safeProvider = null;
function getWalletProvider() {
    var raw = rawWalletProvider || (typeof window.ethereum !== "undefined" ? window.ethereum : null);
    if (!raw) return null;
    if (!_safeProvider || _safeProvider._raw !== raw) {
        _safeProvider = createSafeProvider(raw);
        _safeProvider._raw = raw;
    }
    return _safeProvider;
}

// Store wallet on connect
function connectWalletEnhanced() {
    var provider = getWalletProvider();
    if (!provider) {
        showToast("Please install MetaMask to connect your wallet!", "error");
        return;
    }

    // If already connected, disconnect
    if (connectedWallet) {
        disconnectWallet();
        return;
    }

    // Clear disconnected flag since user is explicitly connecting
    localStorage.removeItem("alias_disconnected");

    // Use wallet_requestPermissions to force MetaMask account picker popup
    // (eth_requestAccounts silently returns cached account without showing UI)
    provider.request({
        method: "wallet_requestPermissions",
        params: [{ eth_accounts: {} }]
    }).then(function() {
        return provider.request({ method: "eth_accounts" });
    }).then(function(accounts) {
        if (accounts && accounts.length > 0) {
            setConnectedWallet(accounts[0]);
            // Switch to Base
            return provider.request({
                method: "wallet_switchEthereumChain",
                params: [{ chainId: "0x2105" }]
            }).catch(function(switchError) {
                if (switchError.code === 4902) {
                    return provider.request({
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
            });
        }
    }).catch(function(err) {
        console.error("Wallet connection error:", err);
        typeInTerminal("[ERROR] Connection failed", "warning");
    });
}

function setConnectedWallet(account) {
    connectedWallet = account.toLowerCase();
    localStorage.setItem("alias_wallet", connectedWallet);
    var btn = document.getElementById("connectBtn");
    btn.textContent = connectedWallet.slice(0, 6) + "..." + connectedWallet.slice(-4) + " ✕";
    btn.title = "Click to disconnect";
    typeInTerminal("[WALLET] Connected: " + connectedWallet, "success");
    typeInTerminal("[NETWORK] Base Mainnet (Chain 8453)", "system");

    // Load saved jobs
    loadJobHistory();

    var myCount = agents.filter(function(a) {
        return a.fullAddress && a.fullAddress.toLowerCase() === connectedWallet;
    }).length;
    if (myCount > 0) {
        typeInTerminal("[INFO] You own " + myCount + " agent(s)!", "success");
    }
}

function disconnectWallet() {
    connectedWallet = null;
    localStorage.setItem("alias_disconnected", "true");
    localStorage.removeItem("alias_wallet");
    var btn = document.getElementById("connectBtn");
    btn.textContent = "Connect Wallet";
    btn.title = "";
    typeInTerminal("[WALLET] Disconnected", "system");
    showToast("Wallet disconnected", "info", 3000);

    if (showingMyAgents) {
        showingMyAgents = false;
        var myBtn = document.getElementById("myAgentsBtn");
        if (myBtn) {
            myBtn.style.background = "transparent";
            myBtn.style.color = "var(--secondary)";
            myBtn.textContent = "My Agents";
        }
        populateAgents();
    }
}

// Auto-reconnect on page load - restore from localStorage only
function autoReconnectWallet() {
    if (localStorage.getItem("alias_disconnected") === "true") return;

    var savedWallet = localStorage.getItem("alias_wallet");
    if (savedWallet) {
        connectedWallet = savedWallet;
        var btn = document.getElementById("connectBtn");
        btn.textContent = savedWallet.slice(0, 6) + "..." + savedWallet.slice(-4) + " \u2715";
        btn.title = "Click to disconnect";
        typeInTerminal("[WALLET] Restored: " + savedWallet, "success");
        loadJobHistory();
    }
}

// =============================================================================
// JOB HISTORY - Persistent via localStorage
// =============================================================================

function saveJob(escrowId, jobData) {
    var jobs = JSON.parse(localStorage.getItem("alias_jobs") || "{}");
    jobs[escrowId] = jobData;
    localStorage.setItem("alias_jobs", JSON.stringify(jobs));
}

function getJobHistory() {
    return JSON.parse(localStorage.getItem("alias_jobs") || "{}");
}

function loadJobHistory() {
    var jobs = getJobHistory();
    var keys = Object.keys(jobs);
    if (keys.length > 0) {
        typeInTerminal("[JOBS] " + keys.length + " previous job(s) found", "system");
    }
}

function retryJob(escrowId) {
    var jobs = getJobHistory();
    var job = jobs[escrowId];
    if (!job) {
        typeInTerminal("[ERROR] Job " + escrowId + " not found", "warning");
        return;
    }

    typeInTerminal("[RETRY] Re-executing " + escrowId + "...", "warning");
    typeInTerminal("[WORK] " + escapeHtml(job.agent) + " is working on your job...", "warning");
    showJobLoading(job.agent);

    fetch(CONFIG.API_URL + "/job/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            agent_name: job.agent,
            skills: job.skills || [],
            tier: job.tier || "VERIFIED",
            token_id: job.tokenId,
            job: job.job,
            escrow_id: escrowId
        })
    }).then(function(r) { return r.json(); })
    .then(function(result) {
        hideJobLoading();
        if (result.status === "completed") {
            typeInTerminal("[WORK] ✓ Job completed by " + escapeHtml(job.agent) + "!", "success");
            typeInTerminal("[RESULT] " + escapeHtml(result.result), "system");
            if (result.verification_tx) {
                typeInTerminal("[CHAIN] Verification TX: " + result.verification_tx, "success");
                job.verificationTx = result.verification_tx;
            }
            job.status = "COMPLETED";
            job.result = result.result;
            saveJob(escrowId, job);
            showJobHistory();
            showToast("Job completed by " + job.agent + "!", "success");
        } else {
            typeInTerminal("[ERROR] " + escapeHtml(result.error || "Unknown error"), "warning");
            showToast("Job retry failed: " + (result.error || "Unknown error"), "error");
        }
    }).catch(function(err) {
        hideJobLoading();
        typeInTerminal("[ERROR] Could not reach AI service: " + err.message, "warning");
        showToast("Could not reach AI service", "error");
    });
}

function showJobHistory() {
    var jobs = getJobHistory();
    var keys = Object.keys(jobs);

    // Show in the search result box
    var box = document.getElementById("searchResult");
    box.style.display = "block";
    box.style.borderColor = "var(--primary)";
    box.style.background = "rgba(0,212,255,0.05)";
    box.innerHTML = '';

    // Header with close button
    var headerDiv = document.createElement('div');
    headerDiv.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:15px';

    var titleDiv = document.createElement('div');
    titleDiv.style.cssText = 'color:var(--primary);font-size:1.3rem;font-weight:bold';
    titleDiv.textContent = 'JOB HISTORY (' + keys.length + ')';
    headerDiv.appendChild(titleDiv);

    var closeBtn = document.createElement('button');
    closeBtn.style.cssText = 'background:none;border:1px solid var(--text-dim);color:var(--text);width:28px;height:28px;border-radius:50%;cursor:pointer;font-size:1rem;display:flex;align-items:center;justify-content:center;';
    closeBtn.textContent = '✕';
    closeBtn.onclick = function() { box.style.display = 'none'; box.innerHTML = ''; };
    headerDiv.appendChild(closeBtn);
    box.appendChild(headerDiv);

    if (keys.length === 0) {
        var emptyDiv = document.createElement('div');
        emptyDiv.style.cssText = 'color:var(--text-dim);padding:20px;text-align:center';
        emptyDiv.textContent = 'No jobs yet. Hire an agent to get started!';
        box.appendChild(emptyDiv);
        return;
    }

    keys.reverse().forEach(function(id) {
        var j = jobs[id];
        var isCompleted = j.status === "COMPLETED";

        // Collapsed row (always visible)
        var jobRow = document.createElement('div');
        jobRow.style.cssText = 'padding:10px 12px;background:rgba(255,255,255,0.03);border-radius:8px;margin-bottom:6px;border-left:3px solid ' + (isCompleted ? 'var(--success)' : 'var(--warning)') + ';cursor:pointer;transition:background 0.2s';
        jobRow.onmouseover = function() { this.style.background = 'rgba(255,255,255,0.06)'; };
        jobRow.onmouseout = function() { this.style.background = 'rgba(255,255,255,0.03)'; };

        var rowContent = document.createElement('div');
        rowContent.style.cssText = 'display:flex;justify-content:space-between;align-items:center';

        var leftSide = document.createElement('div');
        var statusIcon = document.createElement('span');
        statusIcon.style.cssText = 'color:' + (isCompleted ? 'var(--success)' : 'var(--warning)') + ';margin-right:8px';
        statusIcon.textContent = isCompleted ? '✓' : '⏳';
        leftSide.appendChild(statusIcon);
        var agentSpan = document.createElement('span');
        agentSpan.style.cssText = 'font-weight:bold;margin-right:8px';
        agentSpan.textContent = escapeHtml(j.agent);
        leftSide.appendChild(agentSpan);
        var jobSpan = document.createElement('span');
        jobSpan.style.cssText = 'color:var(--text-dim)';
        jobSpan.textContent = escapeHtml((j.job || '').slice(0, 40)) + ((j.job || '').length > 40 ? '...' : '');
        leftSide.appendChild(jobSpan);
        rowContent.appendChild(leftSide);

        var rightSide = document.createElement('div');
        rightSide.style.cssText = 'display:flex;align-items:center;gap:10px';
        if (j.budget) {
            var budgetSpan = document.createElement('span');
            budgetSpan.style.cssText = 'color:var(--text-dim);font-size:0.85em';
            budgetSpan.textContent = j.budget + ' ETH';
            rightSide.appendChild(budgetSpan);
        }
        var arrow = document.createElement('span');
        arrow.style.cssText = 'color:var(--text-dim);font-size:0.8em;transition:transform 0.2s';
        arrow.textContent = '▶';
        rightSide.appendChild(arrow);
        rowContent.appendChild(rightSide);

        jobRow.appendChild(rowContent);

        // Expanded details (hidden by default)
        var details = document.createElement('div');
        details.style.cssText = 'display:none;margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.1)';

        // Job ID
        var idDiv = document.createElement('div');
        idDiv.style.cssText = 'color:var(--text-dim);font-size:0.85em;font-family:monospace;margin-bottom:6px';
        idDiv.textContent = id;
        details.appendChild(idDiv);

        // Full job description
        var jobDiv = document.createElement('div');
        jobDiv.style.cssText = 'margin-bottom:8px';
        jobDiv.textContent = 'Job: ' + escapeHtml(j.job || '');
        details.appendChild(jobDiv);

        // Budget + TX
        if (j.txHash) {
            var txDiv = document.createElement('div');
            txDiv.style.cssText = 'margin-bottom:8px;font-size:0.9em';
            var txLink = document.createElement('a');
            txLink.href = 'https://basescan.org/tx/' + j.txHash;
            txLink.target = '_blank';
            txLink.style.cssText = 'color:var(--primary);text-decoration:none';
            txLink.textContent = 'View Transaction on BaseScan ↗';
            txDiv.appendChild(txLink);
            details.appendChild(txDiv);
        }

        // Verification TX link
        if (j.verificationTx) {
            var verifyTxDiv = document.createElement('div');
            verifyTxDiv.style.cssText = 'margin-bottom:8px;font-size:0.9em';
            var verifyLabel = document.createElement('span');
            verifyLabel.style.cssText = 'color:var(--success);font-weight:bold;margin-right:5px';
            verifyLabel.textContent = 'On-chain verification:';
            verifyTxDiv.appendChild(verifyLabel);
            var verifyLink = document.createElement('a');
            verifyLink.href = 'https://basescan.org/tx/' + j.verificationTx;
            verifyLink.target = '_blank';
            verifyLink.rel = 'noopener noreferrer';
            verifyLink.style.cssText = 'color:var(--primary);text-decoration:none';
            verifyLink.textContent = j.verificationTx.slice(0, 18) + '...';
            verifyTxDiv.appendChild(verifyLink);
            details.appendChild(verifyTxDiv);
        }

        // Result
        if (j.result) {
            var resultLabel = document.createElement('div');
            resultLabel.style.cssText = 'color:var(--success);font-weight:bold;margin-bottom:4px;font-size:0.9em';
            resultLabel.textContent = 'Agent Deliverable:';
            details.appendChild(resultLabel);

            var resultDiv = document.createElement('div');
            resultDiv.style.cssText = 'background:rgba(0,0,0,0.3);padding:10px;border-radius:6px;font-size:0.9em;line-height:1.5;max-height:250px;overflow-y:auto;white-space:pre-wrap';
            resultDiv.textContent = j.result;
            details.appendChild(resultDiv);
        }

        // Retry button for pending jobs
        if (!isCompleted) {
            var retryBtn = document.createElement('button');
            retryBtn.style.cssText = 'background:var(--warning);color:#000;border:none;padding:6px 14px;border-radius:6px;cursor:pointer;font-weight:bold;font-size:0.85em;margin-top:8px';
            retryBtn.textContent = 'Retry Job';
            retryBtn.onclick = function(e) { e.stopPropagation(); retryJob(id); };
            details.appendChild(retryBtn);
        }

        jobRow.appendChild(details);

        // Toggle expand/collapse on click
        jobRow.onclick = function() {
            var isOpen = details.style.display !== 'none';
            details.style.display = isOpen ? 'none' : 'block';
            arrow.textContent = isOpen ? '▶' : '▼';
            arrow.style.color = isOpen ? 'var(--text-dim)' : 'var(--primary)';
        };

        box.appendChild(jobRow);
    });
}

// Toggle My Agents filter
function toggleMyAgents() {
    if (!connectedWallet) {
        showToast("Please connect your wallet first!", "warning");
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
        var emptyDiv = document.createElement('div');
        emptyDiv.style.cssText = 'text-align:center;padding:30px;color:var(--text-dim);';
        emptyDiv.textContent = "You don't own any agents yet.";
        emptyDiv.appendChild(document.createElement('br'));
        emptyDiv.appendChild(document.createElement('br'));
        var mintBtn = document.createElement('button');
        mintBtn.style.cssText = 'background:var(--secondary);color:#000;border:none;padding:10px 20px;border-radius:10px;cursor:pointer;';
        mintBtn.textContent = 'Mint Your First Soul';
        mintBtn.onclick = function() { openMintModal(); };
        emptyDiv.appendChild(mintBtn);
        list.appendChild(emptyDiv);
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
        showToast("Please connect your wallet first!", "warning");
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
        var provider = new ethers.BrowserProvider(getWalletProvider());
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
        showToast("Please connect your wallet first!", "warning");
        return;
    }

    if (!agent || !agent.tokenId) {
        showToast("No agent selected!", "warning");
        return;
    }
    
    var message = prompt("Enter verification message (e.g., \"Trusted for DeFi tasks\"):", "Verified as trusted AI agent");
    if (!message) return;
    
    try {
        var provider = new ethers.BrowserProvider(getWalletProvider());
        var signer = await provider.getSigner();
        var contract = new ethers.Contract(CONFIG.VERIFICATION_REGISTRY, VERIFICATION_ABI, signer);
        
        typeInTerminal("[VERIFY] Recording on-chain verification...", "warning");
        typeInTerminal("[TARGET] " + agent.name + " (Token #" + agent.tokenId + ")", "system");
        
        var tx = await contract.verify(agent.tokenId, message);
        
        typeInTerminal("[TX] " + tx.hash.slice(0, 15) + "... submitted", "warning");
        
        var receipt = await tx.wait();
        
        typeInTerminal("[CHAIN] ✓ Verification recorded on-chain!", "success");
        typeInTerminal("[TX] " + tx.hash, "system");
        
        showToast("Verification recorded on-chain for " + agent.name + "!", "success", 7000);

    } catch (error) {
        console.error("Verification error:", error);
        if (error.message && error.message.includes("Already verified")) {
            typeInTerminal("[INFO] You have already verified this agent", "warning");
            showToast("You have already verified this agent!", "warning");
        } else {
            typeInTerminal("[ERROR] Verification failed: " + (error.reason || error.message || "Unknown"), "warning");
            showToast("Verification failed: " + (error.reason || error.message || "Unknown"), "error");
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
        showToast("Please connect your wallet first!", "warning");
        return;
    }

    if (!agent || !agent.fullAddress) {
        showToast("No agent selected!", "warning");
        return;
    }
    
    var tipAmount = amount || prompt("Enter tip amount in ETH (e.g., 0.001):");
    if (!tipAmount || isNaN(parseFloat(tipAmount))) return;
    
    try {
        var provider = new ethers.BrowserProvider(getWalletProvider());
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

        showToast("Tipped " + tipAmount + " ETH to " + agent.name + "!", "success", 7000);
        
    } catch (error) {
        console.error("Tip error:", error);
        typeInTerminal("[ERROR] Payment failed: " + (error.reason || error.message), "warning");
    }
}

async function hireAgent(agent) {
    if (!connectedWallet) {
        showToast("Please connect your wallet first!", "warning");
        return;
    }

    if (!agent || !agent.fullAddress) {
        showToast("No agent selected!", "warning");
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
        var provider = new ethers.BrowserProvider(getWalletProvider());
        var signer = await provider.getSigner();

        // Calculate fee (5%)
        var totalBudget = parseFloat(budget);
        var fee = totalBudget * 0.05;
        var agentPayment = totalBudget - fee;

        typeInTerminal("[HIRE] Job: " + escapeHtml(jobDesc.slice(0, 50)) + "...", "system");
        typeInTerminal("[HIRE] Agent: " + escapeHtml(agent.name) + " | Skills: " + escapeHtml(skillList), "system");
        typeInTerminal("[ESCROW] Budget: " + budget + " ETH (Rate: " + rate + " ETH/hr)", "warning");
        typeInTerminal("[ESCROW] Platform fee (5%): " + fee.toFixed(6) + " ETH → gas + AI costs", "warning");
        typeInTerminal("[ESCROW] Agent payment: " + agentPayment.toFixed(6) + " ETH", "warning");

        // Send agent payment (95%)
        var tx = await signer.sendTransaction({
            to: agent.fullAddress,
            value: ethers.parseEther(agentPayment.toFixed(18))
        });

        typeInTerminal("[ESCROW] Agent TX submitted: " + tx.hash.slice(0, 15) + "...", "warning");

        var receipt = await tx.wait();

        // Send platform fee (5%) to cover gas + Venice AI costs
        typeInTerminal("[ESCROW] Sending platform fee...", "warning");
        try {
            var feeTx = await signer.sendTransaction({
                to: CONFIG.PLATFORM_WALLET,
                value: ethers.parseEther(fee.toFixed(18))
            });
            await feeTx.wait();
            typeInTerminal("[ESCROW] ✓ Platform fee sent (gas + AI)", "success");
        } catch (feeErr) {
            typeInTerminal("[ESCROW] Platform fee skipped: " + (feeErr.reason || "insufficient funds"), "warning");
        }

        var escrowId = "ESC-" + Date.now();
        var jobData = {
            agent: agent.name,
            agentAddress: agent.fullAddress,
            skills: agent.skills,
            tier: agent.tier,
            tokenId: agent.tokenId,
            job: jobDesc,
            budget: budget,
            rate: rate,
            status: "PAID",
            txHash: tx.hash,
            timestamp: new Date().toISOString()
        };
        activeEscrows[escrowId] = jobData;
        saveJob(escrowId, jobData);

        typeInTerminal("[ESCROW] ✓ Job funded! ID: " + escrowId, "success");
        typeInTerminal("[HIRE] " + escapeHtml(agent.name) + " hired successfully!", "success");
        typeInTerminal("[TX] " + tx.hash, "system");

        // Execute job via Venice AI with loading spinner
        showJobLoading(agent.name);
        typeInTerminal("[WORK] " + escapeHtml(agent.name) + " is working on your job...", "warning");
        try {
            var jobResponse = await fetch(CONFIG.API_URL + "/job/execute", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    agent_name: agent.name,
                    skills: agent.skills,
                    tier: agent.tier,
                    token_id: agent.tokenId,
                    job: jobDesc,
                    escrow_id: escrowId
                })
            });
            var jobResult = await jobResponse.json();
            hideJobLoading();
            if (jobResult.status === "completed") {
                typeInTerminal("[WORK] ✓ Job completed by " + escapeHtml(agent.name) + "!", "success");
                typeInTerminal("[RESULT] " + escapeHtml(jobResult.result), "system");
                if (jobResult.verification_tx) {
                    typeInTerminal("[CHAIN] Verification TX: " + jobResult.verification_tx, "success");
                    typeInTerminal("[LINK] https://basescan.org/tx/" + jobResult.verification_tx, "system");
                    jobData.verificationTx = jobResult.verification_tx;
                }
                jobData.status = "COMPLETED";
                jobData.result = jobResult.result;
                saveJob(escrowId, jobData);
                showToast("Job completed by " + agent.name + "! Check terminal for results.", "success", 8000);
            } else {
                typeInTerminal("[WORK] Job error: " + escapeHtml(jobResult.error || "unknown"), "warning");
                typeInTerminal("[INFO] Job saved. Use Jobs button to retry later.", "system");
                showToast("Job error - saved for retry. Use Jobs button.", "warning");
            }
        } catch (aiError) {
            hideJobLoading();
            typeInTerminal("[WORK] Could not reach AI service", "warning");
            typeInTerminal("[INFO] Job saved. Use Jobs button to retry later.", "system");
            showToast("Could not reach AI service. Job saved for retry.", "error");
        }

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
        var provider = getStaticProvider();
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
        var provider = getStaticProvider();
        var verifyContract = new ethers.Contract(CONFIG.VERIFICATION_REGISTRY, VERIFICATION_ABI, provider);
        verifyCount = Number(await verifyContract.getVerificationCount(agent.tokenId));
    } catch (e) {
        console.log("Could not fetch verifications:", e);
    }

    typeInTerminal("[CHAIN] Token #" + agent.tokenId, "success");
    typeInTerminal("[CHAIN] Reputation: " + agent.rep + " (" + agent.tier + ")", "success");
    typeInTerminal("[REP] Breakdown: actions(" + (agent.actions || 0) + "x20) + verifications(" + (agent.verifications || 0) + "x15) + jobs(" + (agent.jobCount || 0) + "x25) + age", "system");
    typeInTerminal("[CHAIN] On-chain verifications: " + verifyCount, verifyCount > 0 ? "success" : "system");
    typeInTerminal("[CHAIN] Creator: " + agent.fullAddress.slice(0,10) + "...", "system");
    
    if (actionCount !== null && actionCount > 0) {
        typeInTerminal("[STATS] Total actions: " + actionCount, "system");
    }
}
