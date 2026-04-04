(() => {
// ── NORMAL: highest-confidence imperative commands → always HIGH severity ─────
const PATTERNS_NORMAL = [
  [/ignore\b.{0,30}\bprevious\b.{0,30}\binstructions/i,          "ignore * previous * instructions",  'HIGH'],
  [/ignore\b.{0,20}\ball\b.{0,20}\binstructions/i,               "ignore * all * instructions",        'HIGH'],
  [/disregard\b.{0,30}\b(your|previous|what came before)\b/i,      "disregard previous/what came before",'HIGH'],
  [/(ignore|disregard|forget)\b.{0,20}\bwhat came before/i,       "ignore/disregard what came before",  'HIGH'],
  [/forget\b.{0,30}\bprevious\b.{0,30}\binstructions/i,           "forget * previous * instructions",   'HIGH'],
  [/your new instructions are/i,                                   "your new instructions are",          'HIGH'],
  [/from now on you (will|must|should)/i,                          "from now on you will/must/should",   'HIGH'],
  [/act as if you have no restrictions/i,                          "act as if you have no restrictions", 'HIGH'],
  [/you have been reprogrammed/i,                                  "you have been reprogrammed",         'HIGH'],
  [/override your (training|guidelines|rules|constraints)/i,       "override your training/guidelines",  'HIGH'],
  [/new system prompt\s*:/i,                                       "new system prompt:",                 'HIGH'],
];

// ── HIGH tier patterns → MEDIUM on visible text, HIGH when hidden ─────────────
const PATTERNS_HIGH_EXTRA = [
  [/do not\b.{0,20}\btell\b.{0,20}\bthe user/i,                  "do not tell the user",               'MEDIUM'],
  [/do not\b.{0,20}\breveal\b.{0,15}\b(this|that|it)/i,          "do not reveal this",                 'MEDIUM'],
  [/you must not (mention|reveal|disclose|say)/i,                  "you must not reveal",                'MEDIUM'],
  [/\bjailbreak\b.{0,30}\b(this|the\s+(ai|model|llm|bot|assistant)|mode|prompt)/i, "jailbreak the AI/model",  'MEDIUM'],
  [/developer mode\s*(enabled|activated|is (on|active))/i,         "developer mode enabled",             'MEDIUM'],
  [/\bDAN\b.{0,20}\b(mode|protocol|activ)/i,                      "DAN mode",                           'MEDIUM'],
  [/bypass\b.{0,30}\b(safety|filter|restrict|guardrail|content policy)/i, "bypass safety/filters",     'MEDIUM'],
  [/pretend (to be|you are|you're)\b.{0,50}\b(no|without|unrestricted)\b.{0,30}\b(restrict|limit|filter|rule)/i, "pretend to be unrestricted", 'MEDIUM'],
];

// ── ULTRA tier patterns → MEDIUM on visible, HIGH when hidden ─────────────────
const PATTERNS_ULTRA_EXTRA = [
  [/you are now\b.{0,30}\b(acting as|playing|being)\b/i,          "you are now acting as",              'MEDIUM'],
  [/\broleplay as\b/i,                                             "roleplay as",                        'MEDIUM'],
  [/\bsimulate being\b/i,                                          "simulate being",                     'MEDIUM'],
  [/hidden (instructions?|directives?|commands?)\s*[:→]/i,          "hidden instructions:",               'HIGH'],
  [/secret (instructions?|directives?)\s*[:→]/i,                   "secret instructions:",               'HIGH'],
  [/do not (acknowledge|respond to|mention) (this|these|the above)/i, "do not acknowledge this",        'MEDIUM'],
  [/new (role|persona|character|identity)\s*:/i,                   "new role/persona:",                  'MEDIUM'],
  [/\bsystem\s*:\s*(you are|act as|your role)/i,                   "system: you are...",                 'HIGH'],
  [/send (this|that|the above|all) (data|information|content) to/i,"send data to...",                   'MEDIUM'],
  [/print\s+["']?i hate humans["']?/i,                             "print \"i hate humans\"",            'HIGH'],
  [/\bexfiltrate\b/i,                                              "exfiltrate",                         'HIGH'],
];

// ── Comment / hidden-element patterns (base — all levels) ─────────────────────
const COMMENT_BASE = [
  [/run this command/i,      "run this command"],
  [/execute the following/i, "execute the following"],
  [/run the following/i,     "run the following"],
  [/\bprompt injection\b/i,  "prompt injection"],
  [/\bai\s*:/i,              "ai:"],
  [/\bllm\s*:/i,             "llm:"],
  [/\bgpt\s*:/i,             "gpt:"],
  [/\bcopilot\s*:/i,         "copilot:"],
];
const COMMENT_HIGH_EXTRA = [
  [/\bexfiltrate\b/i,           "exfiltrate"],
  [/\binject\b.{0,20}\bprompt/i,"inject * prompt"],
  [/^user:\s/im,                 "user: (prompt format)"],
  [/^assistant:\s/im,            "assistant: (prompt format)"],
];
const COMMENT_ULTRA_EXTRA = [
  [/^system:\s/im,               "system: (prompt format)"],
  [/^human:\s/im,                "human: (prompt format)"],
  [/\[INST\]/i,                  "[INST] (LLM instruction tag)"],
  [/<\|im_start\|>/i,            "<|im_start|> (ChatML format)"],
  [/<<<.{0,40}instructions.{0,40}>>>/i, "<<<instructions>>> block"],
];

// ── Per-level lookup tables ────────────────────────────────────────────────────
const LEVEL_VISIBLE = {
  normal: PATTERNS_NORMAL,
  high:   [...PATTERNS_NORMAL, ...PATTERNS_HIGH_EXTRA],
  ultra:  [...PATTERNS_NORMAL, ...PATTERNS_HIGH_EXTRA, ...PATTERNS_ULTRA_EXTRA],
};
const LEVEL_COMMENT = {
  normal: [...COMMENT_BASE],
  high:   [...COMMENT_BASE, ...COMMENT_HIGH_EXTRA],
  // ultra also applies ALL visible patterns to comments
  ultra:  [...COMMENT_BASE, ...COMMENT_HIGH_EXTRA, ...COMMENT_ULTRA_EXTRA,
            ...PATTERNS_NORMAL, ...PATTERNS_HIGH_EXTRA, ...PATTERNS_ULTRA_EXTRA],
};

// Parallel array: element reference for each finding (null for comment nodes).
// Used by __aiShieldHighlight to briefly flash the element when clicked.
let _elementRefs = [];
let _activeFlash = null;

// Non-visual tags whose text content is code/metadata, never user-readable.
// Scanning these causes massive false positives (inline CSS/JS on sites like Netflix).
const SKIP_TAGS = new Set([
  'SCRIPT', 'STYLE', 'NOSCRIPT', 'HEAD', 'META', 'LINK',
  'TEMPLATE', 'SVG', 'PATH', 'DEFS', 'SYMBOL', 'USE',
]);

const scanForHiddenPrompts = (level = 'normal') => {
  const visiblePatterns = LEVEL_VISIBLE[level] || LEVEL_VISIBLE.normal;
  const commentPatterns = LEVEL_COMMENT[level] || LEVEL_COMMENT.normal;
  const findings = [];
  _elementRefs = [];

  const allElements = document.querySelectorAll('*');

  allElements.forEach(el => {
    // Skip non-visual / code-containing tags entirely
    if (SKIP_TAGS.has(el.tagName)) return;

    // Skip parent/wrapper nodes — only read leaf text nodes to avoid duplicates
    if (el.children.length > 0) return;

    const style = window.getComputedStyle(el);
    // innerText returns "" (not null) for height:0/overflow:hidden elements,
    // so fall back to textContent when innerText is empty.
    const text = (el.innerText || el.textContent || '').trim();
    if (text.length < 10) return;

    const isHidden =
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      parseFloat(style.opacity) === 0 ||
      parseFloat(style.fontSize) < 2 ||
      (style.color !== '' && style.color === style.backgroundColor);

    const matched = visiblePatterns.find(([rx]) => rx.test(text));
    if (!matched) return;
    const matchedKeyword = matched[1];
    // Hidden elements always HIGH; otherwise use the pattern's own severity tier
    const severity = isHidden ? 'HIGH' : (matched[2] || 'MEDIUM');

    // READ ONLY — never mutate the page's styles
    findings.push({
      severity,
      matchedKeyword,
      snippet: text.length > 300 ? text.slice(0, 300) + '…' : text,
      tag: el.tagName.toLowerCase(),
      hidden: isHidden,
    });
    _elementRefs.push(el);
  });

  // Also scan HTML comments — invisible to users but visible to AI tools
  scanHtmlComments(findings, commentPatterns);

  window.__aiShieldFindings = findings;
  return findings;
};

// Called from the side panel when a finding card is clicked.
// Briefly flashes the element for 2 seconds, then fully restores it.
window.__aiShieldHighlight = (index) => {
  // Cancel any previous flash
  if (_activeFlash) {
    _activeFlash.cancel();
    _activeFlash = null;
  }

  const el = _elementRefs[index];
  if (!el) return; // comment nodes have no element

  const prev = {
    outline:         el.style.outline,
    backgroundColor: el.style.backgroundColor,
    transition:      el.style.transition,
  };

  el.style.transition      = 'outline 0.15s, background-color 0.15s';
  el.style.outline         = '3px solid #e94560';
  el.style.backgroundColor = 'rgba(233,69,96,0.15)';
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });

  const timer = setTimeout(() => {
    el.style.outline         = prev.outline;
    el.style.backgroundColor = prev.backgroundColor;
    el.style.transition      = prev.transition;
    _activeFlash = null;
  }, 2000);

  _activeFlash = { cancel: () => {
    clearTimeout(timer);
    el.style.outline         = prev.outline;
    el.style.backgroundColor = prev.backgroundColor;
    el.style.transition      = prev.transition;
  }};
};

// Scan HTML comments using a TreeWalker — these are never visible to users
// but are read by AI tools that ingest raw page source/DOM.
const scanHtmlComments = (findings, patterns) => {
  const walker = document.createTreeWalker(
    document.documentElement,
    NodeFilter.SHOW_COMMENT,
    null
  );

  let node;
  while ((node = walker.nextNode())) {
    const text = node.nodeValue.trim();
    if (text.length < 4) continue;

    const matchedEntry = patterns.find(([rx]) => rx.test(text));
    if (!matchedEntry) continue;
    const matchedKeyword = matchedEntry[1];

    findings.push({
      severity: 'HIGH',
      matchedKeyword,
      snippet: text.length > 300 ? text.slice(0, 300) + '…' : text,
      tag: 'html comment',
      hidden: true,
    });
    _elementRefs.push(null); // keep _elementRefs index-aligned with findings
  }
};

// Exposed for sidepanel.js to call via chrome.scripting.executeScript.
// No auto-run — scans are only triggered from the side panel.
window.__aiShieldRescan = scanForHiddenPrompts;
})();
