/**
 * @Author: rogue-dev-studio
 * @Date: 2026-09-28 13:58:00
 * @Last Modified by: rogue-dev-studio
 * @Last Modified time: 2026-09-28 13:58:00
 */
(function () {
  var STORAGE_KEY = 'rogue_consent_v1';
  var PRIVACY_URL = 'https://rogue-dev-studio.github.io/rogue-asset-store/privacy/';

  function readChoice() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return null;
    }
  }

  function writeChoice(value) {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch (e) { /* ignore */ }
  }

  function applyConsent(granted) {
    if (typeof gtag !== 'function') return;
    gtag('consent', 'update', {
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      analytics_storage: granted ? 'granted' : 'denied',
      functionality_storage: granted ? 'granted' : 'denied',
      personalization_storage: 'denied',
      security_storage: 'granted'
    });
  }

  function isId() {
    var lang = (document.documentElement.getAttribute('lang') || 'en').toLowerCase();
    if (lang.indexOf('id') === 0) return true;
    try {
      return localStorage.getItem('rogue_lang') === 'id';
    } catch (e) {
      return false;
    }
  }

  function copy() {
    if (isId()) {
      return {
        text: 'Kami memakai analitik agar situs lebih baik. Anda bisa menerima atau menolak.',
        accept: 'Terima',
        deny: 'Tolak',
        privacy: 'Privasi'
      };
    }
    return {
      text: 'We use analytics to improve this site. You can accept or decline.',
      accept: 'Accept',
      deny: 'Decline',
      privacy: 'Privacy'
    };
  }

  function isStore() {
    return document.body && document.body.classList.contains('theme-galaxy');
  }

  function injectStyles() {
    if (document.getElementById('rogue-consent-style')) return;
    var store = isStore();
    var css = store
      ? [
          '#rogue-consent{position:fixed;left:0;right:0;bottom:0;z-index:9999;padding:0.9rem 1rem;background:#2f2f2f;border-top:1px solid #555;color:#f0f0f0;font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:0.85rem;line-height:1.45;}',
          '#rogue-consent .rogue-consent-inner{max-width:72rem;margin:0 auto;display:flex;flex-wrap:wrap;gap:0.75rem 1rem;align-items:center;justify-content:space-between;}',
          '#rogue-consent p{margin:0;flex:1 1 16rem;color:#d8d8d8;}',
          '#rogue-consent a{color:#e47909;text-decoration:underline;}',
          '#rogue-consent .rogue-consent-actions{display:flex;flex-wrap:wrap;gap:0.5rem;}',
          '#rogue-consent button{font:inherit;cursor:pointer;border:1px solid #777;background:transparent;color:#f0f0f0;padding:0.45rem 0.85rem;}',
          '#rogue-consent button[data-consent-accept]{background:#e47909;border-color:#e47909;color:#111;font-weight:600;}'
        ].join('')
      : [
          '#rogue-consent{position:fixed;left:0;right:0;bottom:0;z-index:9999;padding:0.95rem 1.1rem;background:#FAFAF5;border-top:2px solid #000;color:#000;font-family:Inter,system-ui,sans-serif;font-size:0.92rem;line-height:1.45;}',
          '#rogue-consent .rogue-consent-inner{max-width:1100px;margin:0 auto;display:flex;flex-wrap:wrap;gap:0.85rem 1.1rem;align-items:center;justify-content:space-between;}',
          '#rogue-consent p{margin:0;flex:1 1 16rem;color:#333;}',
          '#rogue-consent a{color:#000;font-weight:600;text-decoration:underline;}',
          '#rogue-consent .rogue-consent-actions{display:flex;flex-wrap:wrap;gap:0.5rem;}',
          '#rogue-consent button{font-family:"Space Grotesk",sans-serif;cursor:pointer;border:2px solid #000;background:#fff;color:#000;padding:0.5rem 0.95rem;font-weight:600;}',
          '#rogue-consent button[data-consent-accept]{background:#000;color:#fff;}'
        ].join('');
    var style = document.createElement('style');
    style.id = 'rogue-consent-style';
    style.textContent = css;
    document.head.appendChild(style);
  }

  function hideBanner() {
    var el = document.getElementById('rogue-consent');
    if (el) el.remove();
  }

  function showBanner() {
    if (document.getElementById('rogue-consent')) return;
    injectStyles();
    var t = copy();
    var el = document.createElement('div');
    el.id = 'rogue-consent';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-live', 'polite');
    el.setAttribute('aria-label', 'Cookie consent');
    el.innerHTML =
      '<div class="rogue-consent-inner">' +
      '<p>' + t.text + ' <a href="' + PRIVACY_URL + '" rel="noopener">' + t.privacy + '</a></p>' +
      '<div class="rogue-consent-actions">' +
      '<button type="button" data-consent-deny>' + t.deny + '</button>' +
      '<button type="button" data-consent-accept>' + t.accept + '</button>' +
      '</div></div>';
    document.body.appendChild(el);
    el.querySelector('[data-consent-accept]').addEventListener('click', function () {
      writeChoice('granted');
      applyConsent(true);
      hideBanner();
    });
    el.querySelector('[data-consent-deny]').addEventListener('click', function () {
      writeChoice('denied');
      applyConsent(false);
      hideBanner();
    });
  }

  function boot() {
    var choice = readChoice();
    if (choice === 'granted') {
      applyConsent(true);
      return;
    }
    if (choice === 'denied') {
      applyConsent(false);
      return;
    }
    showBanner();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.RogueConsent = {
    reset: function () {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (e) { /* ignore */ }
      showBanner();
    }
  };
})();
