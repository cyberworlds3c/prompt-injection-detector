const scanBtn    = document.getElementById('scanBtn');
const statusBar  = document.getElementById('statusBar');
const findingsEl = document.getElementById('findings');

const escapeHtml = (str) =>
  str.replace(/&/g, '&amp;')
     .replace(/</g, '&lt;')
     .replace(/>/g, '&gt;')
     .replace(/"/g, '&quot;');

const renderFindings = (findings) => {
  if (!Array.isArray(findings) || findings.length === 0) {
    statusBar.textContent = '✅ No prompt injection patterns detected.';
    statusBar.className = 'status-bar clean';
    findingsEl.innerHTML = `
      <div class="empty-state">
        <div class="icon">✅</div>
        <p>No suspicious content found.<br>This page looks safe to use with Copilot.</p>
      </div>`;
    return;
  }

  const highCount = findings.filter(f => f.severity === 'HIGH').length;
  const medCount  = findings.filter(f => f.severity === 'MEDIUM').length;
  statusBar.textContent =
    `⚠️ ${findings.length} finding(s) — ${highCount} high risk, ${medCount} medium risk`;
  statusBar.className = 'status-bar threat';

  const cards = findings.map((f, i) => {
    const canClick = f.tag !== 'html comment';
    const clickAttr = canClick ? `data-index="${i}"` : '';
    const pointer   = canClick ? 'style="cursor:pointer" title="Click to locate on page"' : '';
    return `
    <div class="finding-card ${f.severity.toLowerCase()}" ${clickAttr} ${pointer}>
      <div class="finding-header">
        <span class="badge ${f.severity.toLowerCase()}">${f.severity}</span>
        <span class="keyword-pill">${escapeHtml(f.matchedKeyword)}</span>
        <span class="hidden-tag">${
          f.tag === 'html comment' ? '&lt;!-- comment --&gt;' :
          f.hidden                 ? 'hidden element' :
                                     '&lt;' + escapeHtml(f.tag) + '&gt;'
        }</span>
        ${canClick ? '<span class="locate-icon">&#x1F4CD;</span>' : ''}
      </div>
      <div class="snippet">${escapeHtml(f.snippet)}</div>
    </div>`;
  }).join('');

  const wrapper = document.createElement('div');
  wrapper.className = 'findings-list';
  wrapper.innerHTML = cards;
  findingsEl.replaceChildren(wrapper);

  // Click any card to flash the element on the page
  findingsEl.querySelectorAll('[data-index]').forEach(card => {
    card.addEventListener('click', () => {
      const idx = parseInt(card.dataset.index, 10);
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs[0]) return;
        chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          func: (i) => window.__aiShieldHighlight(i),
          args: [idx],
        });
      });
    });
  });
};

const runScan = () => {
  const level = document.querySelector('.level-btn.active')?.dataset.level ?? 'normal';
  scanBtn.disabled = true;
  scanBtn.textContent = 'Scanning…';
  statusBar.textContent = 'Scanning page elements…';
  statusBar.className = 'status-bar';
  findingsEl.innerHTML = '';

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]) {
      statusBar.textContent = 'No active tab found.';
      statusBar.className = 'status-bar error';
      scanBtn.disabled = false;
      scanBtn.textContent = 'Scan Page';
      return;
    }

    const tabId = tabs[0].id;

    // Always inject fresh scanner.js so we never accidentally call a stale
    // old version that may already be registered on window.__aiShieldRescan.
    chrome.scripting.executeScript(
      { target: { tabId }, files: ['scanner.js'] },
      () => {
        if (chrome.runtime.lastError) {
          statusBar.textContent = 'Cannot scan this page: ' + chrome.runtime.lastError.message;
          statusBar.className = 'status-bar error';
          scanBtn.disabled = false;
          scanBtn.textContent = 'Scan Page';
          return;
        }
        chrome.scripting.executeScript(
          { target: { tabId }, func: (lvl) => window.__aiShieldRescan(lvl), args: [level] },
          (r) => {
            scanBtn.disabled = false;
            scanBtn.textContent = 'Scan Page';
            renderFindings(r?.[0]?.result ?? []);
          }
        );
      }
    );
  });
};

const resetToIdle = () => {
  statusBar.textContent = 'Click "Scan Page" to check this page for prompt injections.';
  statusBar.className = 'status-bar';
  findingsEl.innerHTML = `
    <div class="empty-state">
      <div class="icon">🛡️</div>
      <p>Ready to scan.<br>Click the button above to analyse this page.</p>
    </div>`;
};

scanBtn.addEventListener('click', runScan);

// Level selector toggle
document.querySelectorAll('.level-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.level-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

// Reset panel when the user switches to a different tab
chrome.tabs.onActivated.addListener(resetToIdle);

// Show idle state on first open
resetToIdle();
