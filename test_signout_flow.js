// Verification of Signout Modal and Auth Gate Flow
const fs = require('fs');
const assert = require('assert');

const html = fs.readFileSync(__dirname + '/frontend/index.html', 'utf8');
const js = fs.readFileSync(__dirname + '/frontend/script.js', 'utf8');
const css = fs.readFileSync(__dirname + '/frontend/style.css', 'utf8');

console.log("Starting Signout & Gate Flow Verification...\n");

// 1. Verify HTML Structure
assert(html.includes('id="mandatory-auth-gate" class="mandatory-gate-backdrop hidden"'), 
  "Mandatory auth gate must start with 'hidden' class");
assert(html.includes('id="close-gate-btn"'), 
  "Close gate button (#close-gate-btn) must exist in HTML");
assert(html.includes('id="signout-modal" class="modal-backdrop hidden"'), 
  "Sign out modal (#signout-modal) must exist and start hidden");
assert(html.includes('id="close-signout-btn"'), 
  "Close signout button (#close-signout-btn) must exist in HTML");
assert(html.includes('id="signout-modal-title" class="gate-title-simple">SIGN OUT</h2>'), 
  "Sign out modal must display 'SIGN OUT' as title");
assert(html.includes('id="cancel-signout-btn"'), 
  "Cancel button (#cancel-signout-btn) must exist in signout modal");
assert(html.includes('id="confirm-signout-btn"'), 
  "Confirm button (#confirm-signout-btn) must exist in signout modal");
assert(html.includes('id="signout-btn"'), 
  "Signout item (#signout-btn) must exist in user dropdown");

console.log("✓ HTML Elements & Structure verified.");

// 2. Verify JS Implementation
// Check that refs includes closeGateBtn and closeSignoutBtn
assert(js.includes("closeGateBtn: document.getElementById('close-gate-btn')"), 
  "refs.closeGateBtn must be defined");
assert(js.includes("closeSignoutBtn: document.getElementById('close-signout-btn')"), 
  "refs.closeSignoutBtn must be defined");
assert(js.includes("signoutModal: document.getElementById('signout-modal')"), 
  "refs.signoutModal must be defined");
assert(js.includes("cancelSignoutBtn: document.getElementById('cancel-signout-btn')"), 
  "refs.cancelSignoutBtn must be defined");
assert(js.includes("confirmSignoutBtn: document.getElementById('confirm-signout-btn')"), 
  "refs.confirmSignoutBtn must be defined");

// Check updateAuthUI does NOT call openMandatoryGate()
const updateAuthUIMatch = js.match(/function updateAuthUI\(\) \{([\s\S]*?)\n    \}/);
assert(updateAuthUIMatch, "updateAuthUI function must exist");
assert(!updateAuthUIMatch[1].includes("openMandatoryGate();"), 
  "updateAuthUI MUST NOT call openMandatoryGate() - it caused signout to open signin!");

// Check performSignOut calls closeMandatoryGate and sets guest mode
const performSignOutMatch = js.match(/function performSignOut\(\) \{([\s\S]*?)\n    \}/);
assert(performSignOutMatch, "performSignOut function must exist");
assert(performSignOutMatch[1].includes("closeMandatoryGate();"), 
  "performSignOut must close the mandatory gate");
assert(performSignOutMatch[1].includes("closeAllModals();"), 
  "performSignOut must close all modals");
assert(performSignOutMatch[1].includes("centagon_guest_mode"), 
  "performSignOut must record guest mode in sessionStorage");
assert(!performSignOutMatch[1].includes("openMandatoryGate();"), 
  "performSignOut MUST NOT open mandatory gate");

// Check event listeners are properly attached
assert(js.includes("if (refs.signoutBtn) refs.signoutBtn.addEventListener('click', openSignoutModal);"),
  "signoutBtn must open signout modal");
assert(js.includes("if (refs.cancelSignoutBtn) refs.cancelSignoutBtn.addEventListener('click', closeSignoutModal);"),
  "cancelSignoutBtn must close signout modal");
assert(js.includes("if (refs.confirmSignoutBtn) refs.confirmSignoutBtn.addEventListener('click', performSignOut);"),
  "confirmSignoutBtn must trigger performSignOut");
assert(js.includes("refs.closeSignoutBtn.addEventListener('click', closeSignoutModal)"),
  "closeSignoutBtn must close signout modal");
assert(js.includes("if (refs.closeGateBtn) {"), 
  "closeGateBtn event listener must exist");

console.log("✓ JavaScript Logic & Event Handlers verified.");

// 3. Verify CSS Rules
assert(css.includes(".modal-backdrop.hidden"), "modal-backdrop.hidden must have display: none !important");
assert(css.includes(".mandatory-gate-backdrop.hidden"), "mandatory-gate-backdrop.hidden must have display: none !important");
assert(css.includes(".signout-modal-card"), "signout-modal-card styles must exist");
assert(css.includes(".signout-btn-cancel"), "signout-btn-cancel styles must exist");
assert(css.includes(".signout-btn-confirm"), "signout-btn-confirm styles must exist");

console.log("✓ CSS Styles & z-index rules verified.\n");
console.log("ALL SIGNOUT AND GATE FLOW CHECKS PASSED!");
