// Open the side panel on icon click (Chrome 114+).
// Firefox does not support the sidePanel API — it falls back to default_popup.
if (typeof chrome.sidePanel !== 'undefined') {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
}
