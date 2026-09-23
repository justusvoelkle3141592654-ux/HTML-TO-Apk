/* NovaChat – Oberflächen-Bausteine: Symbole, Hinweise, Menüs, Dialoge, Dateien */
(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = window.Markdown.escape;
  var isNative = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  var isElectron = /Electron/i.test(navigator.userAgent);
  var coarse = window.matchMedia('(pointer: coarse)').matches;

  function el(tag, attrs, html) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'class') e.className = attrs[k];
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== false && attrs[k] != null) e.setAttribute(k, attrs[k] === true ? '' : attrs[k]);
    });
    if (html != null) e.innerHTML = html;
    return e;
  }

  var P = {
    sidebar: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/>',
    compose: '<path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    doc: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/>',
    plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
    up: '<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>',
    down: '<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>',
    stop: '<rect x="7" y="7" width="10" height="10" rx="1.5" fill="currentColor" stroke="none"/>',
    mic: '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><path d="M12 19v3"/>',
    chevron: '<path d="m6 9 6 6 6-6"/>',
    copy: '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
    pencil: '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/>',
    speaker: '<path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z"/><path d="M16 9a5 5 0 0 1 0 6"/><path d="M19.364 18.364a9 9 0 0 0 0-12.728"/>',
    more: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
    trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
    pin: '<path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>',
    gear: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
    sparkles: '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>',
    clip: '<path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
    share: '<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="m16 6-4-4-4 4"/><path d="M12 2v13"/>',
    undo: '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
    moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    menu: '<path d="M4 9h16"/><path d="M4 15h10"/>',
    wifiOff: '<path d="M12 20h.01"/><path d="M8.5 16.429a5 5 0 0 1 7 0"/><path d="M5 12.859a10 10 0 0 1 5.17-2.69"/><path d="M19 12.859a10 10 0 0 0-2.007-1.523"/><path d="M2 8.82a15 15 0 0 1 4.177-2.643"/><path d="M22 8.82a15 15 0 0 0-11.288-3.764"/><path d="m2 2 20 20"/>',
    image: '<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
    canvas: '<path d="M12 20h9"/><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    card: '<rect width="20" height="14" x="2" y="5" rx="2"/><path d="M2 10h20"/>',
    plug: '<path d="M12 22v-5"/><path d="M9 8V2"/><path d="M15 8V2"/><path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z"/>',
    database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/>',
    printer: '<path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6"/><rect x="6" y="14" width="12" height="8" rx="1"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
    lightbulb: '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>',
    code: '<path d="m16 18 6-6-6-6"/><path d="m8 6-6 6 6 6"/>',
    offline: '<path d="M12 2v10"/><path d="M18.4 6.6a9 9 0 1 1-12.77.04"/>',
    help: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
    thumbUp: '<path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"/>',
    thumbDown: '<path d="M17 14V2"/><path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z"/>',
    left: '<path d="m15 18-6-6 6-6"/>',
    right: '<path d="m9 18 6-6-6-6"/>',
    wave: '<path d="M2 10v3"/><path d="M6 6v11"/><path d="M10 3v18"/><path d="M14 8v7"/><path d="M18 5v13"/><path d="M22 10v3"/>',
    temp: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" stroke-dasharray="3 3"/>',
    archive: '<rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/>',
    brain: '<path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/><path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/><path d="M12 18v-5"/>',
    globe: '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
    key: '<path d="m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4"/><path d="m21 2-9.6 9.6"/><circle cx="7.5" cy="15.5" r="5.5"/>',
    cpu: '<rect width="16" height="16" x="4" y="4" rx="2"/><rect width="6" height="6" x="9" y="9" rx="1"/><path d="M15 2v2"/><path d="M15 20v2"/><path d="M2 15h2"/><path d="M2 9h2"/><path d="M20 15h2"/><path d="M20 9h2"/><path d="M9 2v2"/><path d="M9 20v2"/>',
    auto: '<path d="M12 3v3"/><path d="M18.36 5.64l-2.12 2.12"/><path d="M21 12h-3"/><path d="M18.36 18.36l-2.12-2.12"/><path d="M12 21v-3"/><path d="M5.64 18.36l2.12-2.12"/><path d="M3 12h3"/><path d="M5.64 5.64l2.12 2.12"/>',
    library: '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
    external: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    slides: '<rect width="20" height="14" x="2" y="3" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 8h6"/><path d="M7 12h10"/>',
    fileWord: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="m8 12 1.5 6 2.5-4 2.5 4 1.5-6"/>',
    table: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/>',
    briefcase: '<path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/><rect width="20" height="14" x="2" y="6" rx="2"/>',
    bot: '<path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/>',
    folder: '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
    folderPlus: '<path d="M12 10v6"/><path d="M9 13h6"/><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
    play: '<path d="M6 3l14 9-14 9V3z"/>',
    circle: '<circle cx="12" cy="12" r="9"/>',
    checkCircle: '<circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.5 2.5 5-5"/>',
    alert: '<circle cx="12" cy="12" r="9"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
    logo: ''
  };
  function icon(name, size, sw) {
    size = size || 20;
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (sw || 2) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + P[name] + '</svg>';
  }
  function logo(size) {
    size = size || 24;
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 32 32" fill="none" aria-hidden="true">' +
      '<circle cx="16" cy="16" r="13" stroke="currentColor" stroke-width="2.4"/>' +
      '<path d="M16 7.5c.9 4.6 3.9 7.6 8.5 8.5-4.6.9-7.6 3.9-8.5 8.5-.9-4.6-3.9-7.6-8.5-8.5 4.6-.9 7.6-3.9 8.5-8.5Z" fill="currentColor"/></svg>';
  }

  function toast(msg, ms) {
    var t = el('div', { class: 'toast' });
    t.textContent = msg;
    $('#toasts').appendChild(t);
    setTimeout(function () { t.remove(); }, ms || 2600);
  }

  function copyText(text, silent) {
    var done = function () { if (!silent) toast('In die Zwischenablage kopiert'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text); done(); });
    }
    fallbackCopy(text); done();
    return Promise.resolve();
  }
  function fallbackCopy(text) {
    var ta = el('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (e) { /* ignorieren */ }
    ta.remove();
  }

  function slug(s) {
    return (s || 'datei').toLowerCase().replace(/[äöüß]/g, function (c) { return { ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' }[c]; })
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'datei';
  }

  function blobToBase64(blob) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(String(r.result).split(',')[1] || ''); };
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  }

  /** Datei speichern – Browser/Desktop per Download, Android-App über „Teilen“. content: String oder Blob */
  async function saveFile(filename, content, mime) {
    var plugins = window.Capacitor && window.Capacitor.Plugins;
    if (isNative && plugins && plugins.Filesystem) {
      try {
        var isBlob = content instanceof Blob;
        var opts = { path: filename, directory: 'CACHE', data: isBlob ? await blobToBase64(content) : content };
        if (!isBlob) opts.encoding = 'utf8';
        var res = await plugins.Filesystem.writeFile(opts);
        if (plugins.Share) await plugins.Share.share({ title: filename, url: res.uri, dialogTitle: 'Datei speichern oder teilen' });
        else toast('Gespeichert: ' + filename);
      } catch (e) {
        if (!(e && /cancel/i.test(e.message || ''))) toast('Speichern fehlgeschlagen: ' + (e.message || e));
      }
      return;
    }
    var blob = content instanceof Blob ? content : new Blob([content], { type: (mime || 'text/plain') + ';charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = el('a', { href: url, download: filename });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  /** Text über das Teilen-Menü des Systems teilen (Handy), sonst kopieren. */
  async function shareText(title, text) {
    var plugins = window.Capacitor && window.Capacitor.Plugins;
    try {
      if (isNative && plugins && plugins.Share) { await plugins.Share.share({ title: title, text: text, dialogTitle: 'Teilen' }); return; }
      if (navigator.share && coarse) { await navigator.share({ title: title, text: text }); return; }
    } catch (e) { if (e && /cancel|abort/i.test((e.name || '') + (e.message || ''))) return; }
    copyText(text);
  }

  function openExternal(url) {
    var plugins = window.Capacitor && window.Capacitor.Plugins;
    if (isNative && plugins && plugins.Browser) { plugins.Browser.open({ url: url }); return; }
    window.open(url, '_blank', 'noopener');
  }

  // ---------- Menüs ----------
  var activeMenu = null;
  function closeMenu() {
    if (!activeMenu) return false;
    var m = activeMenu;
    activeMenu = null;
    m.node.remove();
    document.removeEventListener('mousedown', m.outside, true);
    document.removeEventListener('touchstart', m.outside, true);
    if (m.onClose) m.onClose();
    return true;
  }

  /** items: [{ icon, label, desc, checked, danger, disabled, onClick } | { sep:true } | { header:true, label }] */
  function openMenu(anchor, items, opts) {
    opts = opts || {};
    closeMenu();
    var menu = el('div', { class: 'menu' + (opts.cls ? ' ' + opts.cls : ''), role: 'menu' });
    if (opts.width) menu.style.minWidth = opts.width + 'px';
    items.forEach(function (it) {
      if (!it) return;
      if (it.sep) { menu.appendChild(el('div', { class: 'menu-sep' })); return; }
      if (it.header) { menu.appendChild(el('div', { class: 'menu-label' }, esc(it.label))); return; }
      var b = el('button', { class: 'menu-item' + (it.danger ? ' danger' : ''), role: 'menuitem', type: 'button' },
        (it.icon ? icon(it.icon, 18) : '') +
        '<span class="mi-text">' + esc(it.label) + (it.desc ? '<small>' + esc(it.desc) + '</small>' : '') + '</span>' +
        (it.badge ? '<span class="mi-badge">' + esc(it.badge) + '</span>' : '') +
        (it.checked ? '<span class="mi-check">' + icon('check', 18) + '</span>' : ''));
      if (it.disabled) b.disabled = true;
      b.addEventListener('click', function () { closeMenu(); if (it.onClick) it.onClick(); });
      menu.appendChild(b);
    });
    $('#menuLayer').appendChild(menu);
    var r = anchor.getBoundingClientRect();
    var mw = menu.offsetWidth, mh = menu.offsetHeight;
    var vw = window.innerWidth, vh = window.innerHeight;
    var left = opts.align === 'right' ? r.right - mw : r.left;
    left = Math.max(8, Math.min(left, vw - mw - 8));
    var top = r.bottom + 6;
    if (opts.above || top + mh > vh - 8) top = r.top - mh - 6;
    if (top < 8) top = 8;
    menu.style.left = left + 'px';
    menu.style.top = top + 'px';
    var outside = function (e) { if (!menu.contains(e.target) && !anchor.contains(e.target)) closeMenu(); };
    setTimeout(function () {
      document.addEventListener('mousedown', outside, true);
      document.addEventListener('touchstart', outside, true);
    });
    activeMenu = { node: menu, outside: outside, onClose: opts.onClose };
    var first = menu.querySelector('.menu-item');
    if (first && !coarse) first.focus();
    return menu;
  }

  // ---------- Dialoge ----------
  var modalStack = [];
  function openModal(opts) {
    var bg = el('div', { class: 'modal-bg' });
    var m = el('div', { class: 'modal' + (opts.size ? ' ' + opts.size : ''), role: 'dialog', 'aria-modal': 'true' });
    if (opts.title !== false) {
      var head = el('div', { class: 'modal-head' + (opts.title ? '' : ' bare') }, '<h2>' + (opts.title || '') + '</h2>');
      var x = el('button', { class: 'icon-btn', 'aria-label': 'Schließen' }, icon('x'));
      x.addEventListener('click', closeModal);
      head.appendChild(x);
      m.appendChild(head);
    }
    if (opts.body) m.appendChild(opts.body);
    bg.appendChild(m);
    bg.addEventListener('mousedown', function (e) { if (e.target === bg) closeModal(); });
    $('#modalLayer').appendChild(bg);
    modalStack.push({ node: bg, onClose: opts.onClose });
    return m;
  }
  function closeModal() {
    var top = modalStack.pop();
    if (!top) return false;
    top.node.remove();
    if (top.onClose) top.onClose();
    return true;
  }
  function modalOpen() { return modalStack.length > 0; }

  function confirmDialog(o) {
    return new Promise(function (resolve) {
      var body = el('div');
      body.appendChild(el('div', { class: 'modal-body' }, '<p style="margin:0;font-size:15px">' + o.text + '</p>'));
      var foot = el('div', { class: 'modal-foot' });
      var c = el('button', { class: 'btn' }, o.cancel || 'Abbrechen');
      var ok = el('button', { class: 'btn ' + (o.danger ? 'danger' : 'primary') }, o.ok || 'OK');
      foot.appendChild(c); foot.appendChild(ok);
      body.appendChild(foot);
      var result = false;
      openModal({ title: esc(o.title), body: body, onClose: function () { resolve(result); } });
      c.addEventListener('click', function () { closeModal(); });
      ok.addEventListener('click', function () { result = true; closeModal(); });
      setTimeout(function () { ok.focus(); }, 30);
    });
  }

  window.UI = {
    $: $, $$: $$, el: el, esc: esc, icon: icon, logo: logo, toast: toast,
    copyText: copyText, slug: slug, saveFile: saveFile, shareText: shareText, openExternal: openExternal,
    openMenu: openMenu, closeMenu: closeMenu, menuOpen: function () { return !!activeMenu; },
    openModal: openModal, closeModal: closeModal, modalOpen: modalOpen, confirmDialog: confirmDialog,
    isNative: isNative, isElectron: isElectron, coarse: coarse
  };
})();
