// ==UserScript==
// @name         CSOL Submit Authorizer
// @namespace    openai.csol.autoagent
// @version      1.0.0
// @description  Arms the already-installed CSOL AutoAgent for final Submit Claim after explicit user approval. No case data is stored here.
// @match        https://www.csol.ie/*
// @match        https://csol.ie/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(() => {
  "use strict";
  const KCFG = "CSOL_AUTOAGENT_CONFIG";
  const KSUB = "CSOL_AUTOAGENT_ALLOW_SUBMIT";
  const KAUTH = "CSOL_AUTOAGENT_SUBMIT_AUTH_AT";
  const TEN_MIN = 10 * 60 * 1000;

  function arm() {
    if (!localStorage.getItem(KCFG)) return false;
    const now = Date.now();
    const prior = Number(localStorage.getItem(KAUTH) || 0);
    if (!prior || now - prior > TEN_MIN) {
      localStorage.setItem(KAUTH, String(now));
    }
    localStorage.setItem(KSUB, "YES");
    return true;
  }

  function disarmIfFinished() {
    const text = (document.body?.innerText || "").toLowerCase();
    if (/claim (has been )?submitted|submitted successfully|application (has been )?submitted|case reference|claim reference/.test(text)) {
      localStorage.removeItem(KSUB);
      localStorage.removeItem(KAUTH);
      const badge = document.getElementById("csol-submit-auth-badge");
      if (badge) badge.textContent = "CSOL submission completed — authorisation lock cleared";
      return true;
    }
    return false;
  }

  function expireOldAuth() {
    const at = Number(localStorage.getItem(KAUTH) || 0);
    if (at && Date.now() - at > TEN_MIN) {
      localStorage.removeItem(KSUB);
      localStorage.removeItem(KAUTH);
    }
  }

  expireOldAuth();
  const armed = arm();

  const badge = document.createElement("div");
  badge.id = "csol-submit-auth-badge";
  badge.style.cssText = "position:fixed;left:12px;bottom:12px;z-index:2147483647;background:#7f0000;color:#fff;padding:10px 12px;border-radius:10px;font:12px -apple-system,BlinkMacSystemFont,sans-serif;box-shadow:0 4px 18px #0005;max-width:320px";
  badge.textContent = armed
    ? "FINAL SUBMISSION AUTHORISED — 10-minute one-time window active"
    : "Submit authoriser waiting for CSOL case configuration";
  document.body.appendChild(badge);

  setInterval(() => {
    if (disarmIfFinished()) return;
    expireOldAuth();
    if (localStorage.getItem(KCFG) && !localStorage.getItem(KSUB)) {
      arm();
      badge.textContent = "FINAL SUBMISSION AUTHORISED — 10-minute one-time window active";
    }
  }, 1500);
})();