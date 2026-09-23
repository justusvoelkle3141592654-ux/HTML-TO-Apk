/* NovaChat – App-Logik */
(function () {
  'use strict';

  // ======================================================================
  // Hilfsfunktionen
  // ======================================================================
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = window.Markdown.escape;
  var uid = function () { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); };
  var isNative = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  var isElectron = /Electron/i.test(navigator.userAgent);
  var coarse = window.matchMedia('(pointer: coarse)').matches;
  var mobileMQ = window.matchMedia('(max-width: 767px)');
  var APP = 'NovaChat';

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

  function copyText(text) {
    var done = function () { toast('In die Zwischenablage kopiert'); };
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

  /** Datei speichern – im Browser/Desktop per Download, in der Android-App über Teilen. */
  async function saveFile(filename, content, mime) {
    if (isNative && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem) {
      try {
        var FS = window.Capacitor.Plugins.Filesystem;
        var res = await FS.writeFile({ path: filename, data: content, directory: 'CACHE', encoding: 'utf8' });
        var Share = window.Capacitor.Plugins.Share;
        if (Share) await Share.share({ title: filename, url: res.uri, dialogTitle: 'Datei speichern oder teilen' });
        else toast('Gespeichert: ' + filename);
        return;
      } catch (e) {
        if (e && /cancel/i.test(e.message || '')) return;
        toast('Speichern fehlgeschlagen: ' + (e.message || e));
        return;
      }
    }
    var blob = new Blob([content], { type: (mime || 'text/plain') + ';charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = el('a', { href: url, download: filename });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  // ======================================================================
  // Zustand & Speicher
  // ======================================================================
  var DEFAULT_SETTINGS = {
    theme: 'system',
    userName: '',
    aboutUser: '',
    responseStyle: '',
    enterToSend: !coarse,
    mode: 'auto',
    provider: 'openai',
    openai: { baseUrl: 'https://api.openai.com/v1', apiKey: '', model: '', temperature: '' },
    anthropic: { apiKey: '', model: 'claude-sonnet-5', maxTokens: 8192 },
    plan: 'free',
    planSince: null,
    sidebarCollapsed: false
  };

  function merge(base, over) {
    var out = JSON.parse(JSON.stringify(base));
    if (!over || typeof over !== 'object') return out;
    Object.keys(over).forEach(function (k) {
      if (out[k] && typeof out[k] === 'object' && !Array.isArray(out[k])) out[k] = merge(out[k], over[k]);
      else out[k] = over[k];
    });
    return out;
  }

  var Store = {
    get: function (k, d) { try { var v = localStorage.getItem('novachat.' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set: function (k, v) {
      try { localStorage.setItem('novachat.' + k, JSON.stringify(v)); return true; }
      catch (e) { toast('Speicher ist voll – lösche alte Chats oder Bilder.'); return false; }
    }
  };

  var state = {
    chats: Store.get('chats', []),
    docs: Store.get('docs', []),
    settings: merge(DEFAULT_SETTINGS, Store.get('settings', {})),
    currentId: null,
    attachments: [],
    canvasMode: false,
    streaming: null,
    docId: null,
    cvMode: 'edit',
    recognition: null
  };

  var saveTimers = {};
  function persist(key, now) {
    clearTimeout(saveTimers[key]);
    var run = function () { Store.set(key, state[key]); };
    if (now) run(); else saveTimers[key] = setTimeout(run, 400);
  }
  function saveSettings() { Store.set('settings', state.settings); }

  function currentChat() { return state.chats.find(function (c) { return c.id === state.currentId; }) || null; }
  function getDoc(id) { return state.docs.find(function (d) { return d.id === id; }) || null; }

  // ======================================================================
  // Design
  // ======================================================================
  var darkMQ = window.matchMedia('(prefers-color-scheme: dark)');
  function applyTheme() {
    var t = state.settings.theme;
    var eff = t === 'system' ? (darkMQ.matches ? 'dark' : 'light') : t;
    document.documentElement.setAttribute('data-theme', eff);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', eff === 'dark' ? '#212121' : '#ffffff');
  }
  darkMQ.addEventListener && darkMQ.addEventListener('change', applyTheme);

  // ======================================================================
  // Statische Symbole setzen
  // ======================================================================
  function paintStatic() {
    $('#sbLogo').innerHTML = logo(24);
    $('#sbClose').innerHTML = icon('sidebar');
    $('#navNew').innerHTML = icon('compose', 18) + '<span>Neuer Chat</span><span class="kbd">' + (navigator.platform.indexOf('Mac') >= 0 ? '⇧⌘O' : 'Strg+⇧+O') + '</span>';
    $('#navSearch').innerHTML = icon('search', 18) + '<span>Chats suchen</span>';
    $('#navDocs').innerHTML = icon('doc', 18) + '<span>Dokumente</span>';
    $('#sbOpenMobile').innerHTML = icon('menu', 22);
    $('#sbOpen').innerHTML = icon('sidebar');
    $('#topNewDesk').innerHTML = icon('compose');
    $('#topNew').innerHTML = icon('compose');
    $('#shareBtn').innerHTML = icon('share');
    $('#plusBtn').innerHTML = icon('plus');
    $('#micBtn').innerHTML = icon('mic');
    $('#scrollDown').innerHTML = icon('down', 18);
    $('#cvClose').innerHTML = icon('x');
    $('#cvUndo').innerHTML = icon('undo', 18);
    $('#cvCopy').innerHTML = icon('copy', 18);
    $('#cvExport').innerHTML = icon('download', 18);
    $('#cvAskBtn').innerHTML = icon('up', 18);
    $('#canvasChip').innerHTML = '<span class="ic">' + icon('canvas', 18) + '</span><span class="x">' + icon('x', 18) + '</span><span>Canvas</span>';
    var hasSpeech = !!(window.SpeechRecognition || window.webkitSpeechRecognition) && !isElectron;
    $('#micBtn').hidden = !hasSpeech;
  }

  // ======================================================================
  // Seitenleiste
  // ======================================================================
  function groupLabel(ts) {
    var now = new Date();
    var d0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    if (ts >= d0) return 'Heute';
    if (ts >= d0 - 864e5) return 'Gestern';
    if (ts >= d0 - 7 * 864e5) return 'Vorherige 7 Tage';
    if (ts >= d0 - 30 * 864e5) return 'Vorherige 30 Tage';
    return new Date(ts).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
  }

  function renderSidebar() {
    var list = $('#chatList');
    list.innerHTML = '';
    var chats = state.chats.slice().sort(function (a, b) { return (b.updated || 0) - (a.updated || 0); });
    if (!chats.length) {
      list.appendChild(el('div', { class: 'sb-empty' }, 'Noch keine Chats. Starte einfach eine Unterhaltung.'));
    }
    var groups = [];
    var pinned = chats.filter(function (c) { return c.pinned; });
    if (pinned.length) groups.push({ label: 'Angeheftet', items: pinned });
    chats.filter(function (c) { return !c.pinned; }).forEach(function (c) {
      var lbl = groupLabel(c.updated || c.created);
      var g = groups[groups.length - 1];
      if (!g || g.label !== lbl || g.pinned) groups.push(g = { label: lbl, items: [] });
      g.items.push(c);
    });
    groups.forEach(function (g) {
      var sec = el('div', { class: 'sb-group' });
      sec.appendChild(el('h3', null, esc(g.label)));
      g.items.forEach(function (c) { sec.appendChild(chatItem(c)); });
      list.appendChild(sec);
    });
    renderProfile();
  }

  function chatItem(c) {
    var item = el('div', { class: 'chat-item' + (c.id === state.currentId ? ' active' : ''), 'data-id': c.id });
    var link = el('button', { class: 'ci-link', title: c.title }, (c.pinned ? icon('pin', 14) : '') + '<span class="ci-title">' + esc(c.title || 'Neuer Chat') + '</span>');
    link.addEventListener('click', function () { openChat(c.id); closeMobileSidebar(); });
    var more = el('button', { class: 'ci-more', 'aria-label': 'Optionen' }, icon('more', 18));
    more.addEventListener('click', function (e) {
      e.stopPropagation();
      item.classList.add('menu-open');
      openMenu(more, [
        { icon: 'share', label: 'Exportieren', onClick: function () { exportChat(c); } },
        { icon: 'pencil', label: 'Umbenennen', onClick: function () { renameInline(item, c); } },
        { icon: 'pin', label: c.pinned ? 'Loslösen' : 'Anheften', onClick: function () { c.pinned = !c.pinned; persist('chats'); renderSidebar(); } },
        { sep: true },
        { icon: 'trash', label: 'Löschen', danger: true, onClick: function () { confirmDeleteChat(c); } }
      ], { onClose: function () { item.classList.remove('menu-open'); } });
    });
    item.appendChild(link);
    item.appendChild(more);
    return item;
  }

  function renameInline(item, c) {
    var input = el('input', { class: 'ci-rename', value: c.title || '' });
    item.innerHTML = '';
    item.appendChild(input);
    input.focus(); input.select();
    var done = false;
    function finish(save) {
      if (done) return; done = true;
      if (save && input.value.trim()) { c.title = input.value.trim().slice(0, 120); persist('chats'); }
      renderSidebar();
    }
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') finish(true);
      if (e.key === 'Escape') finish(false);
    });
    input.addEventListener('blur', function () { finish(true); });
  }

  function confirmDeleteChat(c) {
    confirmDialog({
      title: 'Chat löschen?',
      text: 'Dadurch wird <b>' + esc(c.title || 'Neuer Chat') + '</b> gelöscht.',
      ok: 'Löschen', danger: true
    }).then(function (ok) {
      if (!ok) return;
      if (state.streaming && state.streaming.chatId === c.id) stopStreaming();
      state.chats = state.chats.filter(function (x) { return x.id !== c.id; });
      persist('chats', true);
      if (state.currentId === c.id) newChat(); else renderSidebar();
    });
  }

  function planName(p) { return { free: 'Free', plus: 'Plus', pro: 'Pro' }[p] || 'Free'; }

  function renderProfile() {
    var s = state.settings;
    var name = s.userName || 'Du';
    var paid = s.plan !== 'free';
    $('#profileBtn').innerHTML = '<span class="avatar">' + esc(name.charAt(0).toUpperCase()) + '</span>' +
      '<span class="p-name">' + esc(name) + '<small>' + planName(s.plan) + '</small></span>' +
      (paid ? '<span class="plan-badge">' + planName(s.plan).toUpperCase() + '</span>' : '');
    $('#sbUpgrade').hidden = s.plan === 'pro';
    $('#sbUpgrade').innerHTML = '<span class="ico">' + icon('sparkles', 16) + '</span><span><b>' + (paid ? 'Auf Pro upgraden' : 'Plan upgraden') + '</b><small>Mehr Zugriff auf die besten Modelle</small></span>';
    $('#topUpgrade').hidden = paid;
    $('#topUpgrade').innerHTML = icon('sparkles', 16) + '<span>Upgrade auf Plus</span>';
  }

  function setSidebarCollapsed(v) {
    state.settings.sidebarCollapsed = v;
    $('#app').classList.toggle('sb-collapsed', v);
    saveSettings();
  }
  function openMobileSidebar() { $('#app').classList.add('sb-mobile-open'); }
  function closeMobileSidebar() { $('#app').classList.remove('sb-mobile-open'); }

  // ======================================================================
  // Kopfzeile
  // ======================================================================
  function renderTopbar() {
    var s = state.settings;
    var prov = window.Providers.active(s);
    var sub = window.Providers.label(s);
    $('#modelBtn').innerHTML = '<span>' + APP + '</span>' + (s.plan !== 'free' ? '<span class="sub">' + planName(s.plan) + '</span>' : '') +
      '<span class="sub" style="font-size:15px">' + esc(sub) + '</span>' + icon('chevron', 16);
    var net = $('#netPill');
    if (!navigator.onLine) { net.hidden = false; net.innerHTML = icon('wifiOff', 14) + '<span>Offline</span>'; }
    else if (prov === 'offline') { net.hidden = false; net.innerHTML = icon('offline', 14) + '<span>Offline-Modus</span>'; }
    else net.hidden = true;
    $('#disclaimer').textContent = prov === 'offline'
      ? 'Offline-Modus: eingeschränkte Funktionen. KI-Verbindung in den Einstellungen einrichten.'
      : APP + ' kann Fehler machen. Überprüfe wichtige Informationen.';
  }

  function openModelMenu() {
    var s = state.settings;
    var prov = window.Providers.active(s);
    var configured = (s.provider === 'anthropic' && s.anthropic.apiKey && s.anthropic.model) || (s.provider === 'openai' && s.openai.baseUrl && s.openai.model);
    var onlineLabel = s.provider === 'anthropic' ? (s.anthropic.model || 'Anthropic') : (s.openai.model || 'OpenAI-kompatibel');
    var items = [
      { label: 'Modell', header: true },
      {
        icon: 'sparkles', label: configured ? onlineLabel : 'KI-Verbindung einrichten',
        desc: configured ? (s.provider === 'anthropic' ? 'Anthropic · online' : (window.Providers.isLocalEndpoint(s) ? 'Lokales Modell' : 'Online')) : 'Eigenen API-Schlüssel oder Ollama verbinden',
        checked: s.mode === 'auto' && prov !== 'offline',
        onClick: function () {
          if (!configured) { openSettings('ai'); return; }
          s.mode = 'auto'; saveSettings(); renderTopbar();
          if (window.Providers.active(s) === 'offline') toast('Keine Internetverbindung – Offline-Modus bleibt aktiv.');
        }
      },
      {
        icon: 'offline', label: 'Offline (eingebaut)', desc: 'Rechnen, Umrechnen, Dokumentvorlagen – ohne Internet',
        checked: prov === 'offline',
        onClick: function () { s.mode = 'offline'; saveSettings(); renderTopbar(); }
      },
      { sep: true },
      { icon: 'gear', label: 'KI-Verbindung verwalten', onClick: function () { openSettings('ai'); } }
    ];
    if (s.plan === 'free') items.push({ icon: 'sparkles', label: 'Upgrade auf Plus', desc: 'Unser intelligentestes Modell und mehr', onClick: openPlans });
    openMenu($('#modelBtn'), items, { align: 'left', width: 300 });
  }

  // ======================================================================
  // Verlauf
  // ======================================================================
  var thread = $('#thread');
  var stickToBottom = true;

  function renderThread() {
    var chat = currentChat();
    var box = $('#messages');
    box.innerHTML = '';
    var empty = !chat || !chat.messages.length;
    $('#main').classList.toggle('is-empty', empty);
    if (empty) {
      var greet = ['Womit kann ich helfen?', 'Was steht heute an?', 'Bereit, wenn du es bist.', 'Woran arbeitest du gerade?'];
      $('#emptyTitle').textContent = state.settings.userName
        ? ['Hallo ' + state.settings.userName + ', womit kann ich helfen?', 'Was steht heute an, ' + state.settings.userName + '?'][Math.floor(Math.random() * 2)]
        : greet[Math.floor(Math.random() * greet.length)];
      renderSuggestions();
      return;
    }
    chat.messages.forEach(function (m, i) { box.appendChild(renderMessage(chat, m, i)); });
    scrollToBottom(true);
  }

  function renderSuggestions() {
    var sugg = [
      { icon: 'doc', label: 'Dokument erstellen', prompt: 'Erstelle ein Dokument über ', canvas: true },
      { icon: 'pencil', label: 'Brief schreiben', prompt: 'Schreibe einen Brief an ', canvas: true },
      { icon: 'lightbulb', label: 'Ideen sammeln', prompt: 'Gib mir 10 Ideen für ' },
      { icon: 'code', label: 'Code', prompt: 'Schreibe ein Python-Skript, das ' },
      { icon: 'help', label: 'Was kannst du?', prompt: 'Was kannst du?', send: true }
    ];
    var box = $('#suggestions');
    box.innerHTML = '';
    sugg.forEach(function (s) {
      var b = el('button', { type: 'button' }, icon(s.icon, 16) + '<span>' + esc(s.label) + '</span>');
      b.addEventListener('click', function () {
        if (s.canvas) setCanvasMode(true);
        var input = $('#input');
        input.value = s.prompt;
        autosize();
        updateSend();
        if (s.send) sendMessage();
        else { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
      });
      box.appendChild(b);
    });
  }

  function attachmentHTML(a, removable, idx) {
    var rm = removable ? '<button type="button" class="rm" data-rm="' + idx + '" aria-label="Entfernen">' + icon('x', 12, 3) + '</button>' : '';
    if (a.kind === 'image') return '<div class="img-chip"><img src="' + a.data + '" alt="' + esc(a.name) + '">' + rm + '</div>';
    var ext = (a.name.split('.').pop() || '').toUpperCase().slice(0, 5);
    return '<div class="file-chip"><span class="fi ' + (a.kind === 'text' ? 'doc' : '') + '">' + icon('doc', 18) + '</span>' +
      '<span class="fn"><b>' + esc(a.name) + '</b><small>' + esc(ext || 'Datei') + '</small></span>' + rm + '</div>';
  }

  function renderMessage(chat, m, idx) {
    var wrap = el('div', { class: 'msg ' + m.role + (m.pending ? ' streaming' : ''), 'data-id': m.id });
    if (m.role === 'user') {
      if (m.attachments && m.attachments.length) {
        var att = el('div', { class: 'msg-attach' });
        att.innerHTML = m.attachments.map(function (a) {
          return a.kind === 'image' ? '<img src="' + a.data + '" alt="' + esc(a.name) + '">' : attachmentHTML(a);
        }).join('');
        wrap.appendChild(att);
      }
      if (m.content) {
        var bubble = el('div', { class: 'bubble' });
        bubble.textContent = m.content;
        wrap.appendChild(bubble);
      }
      var ua = el('div', { class: 'msg-actions' });
      ua.appendChild(actionBtn('copy', 'Kopieren', function (b) { copyText(m.content); flashCheck(b, 'copy'); }));
      ua.appendChild(actionBtn('pencil', 'Nachricht bearbeiten', function () { editMessage(chat, m, wrap); }));
      wrap.appendChild(ua);
      return wrap;
    }
    // Assistent
    var content = el('div', { class: 'md content' });
    wrap.appendChild(content);
    if (m.docId) {
      var d = getDoc(m.docId);
      var card = el('button', { class: 'doc-card', type: 'button' },
        '<span class="di">' + icon('doc', 20) + '</span><span><b>' + esc(d ? d.title : 'Dokument (gelöscht)') + '</b><small>' + (m.pending ? 'Wird geschrieben …' : 'Dokument · Zum Öffnen klicken') + '</small></span>');
      card.addEventListener('click', function () { if (d) openCanvas(d.id); else toast('Dieses Dokument wurde gelöscht.'); });
      wrap.appendChild(card);
    }
    fillAssistant(content, m);
    if (m.error) {
      var er = el('div', { class: 'msg-error' }, '<b>Fehler:</b> ' + esc(m.error) +
        '<div class="row"><button class="btn small" data-retry>' + icon('refresh', 14) + 'Erneut versuchen</button>' +
        '<button class="btn small" data-settings>' + icon('gear', 14) + 'KI-Verbindung</button>' +
        '<button class="btn small" data-offline>' + icon('offline', 14) + 'Offline antworten</button></div>');
      er.querySelector('[data-retry]').addEventListener('click', function () { regenerate(chat, m); });
      er.querySelector('[data-settings]').addEventListener('click', function () { openSettings('ai'); });
      er.querySelector('[data-offline]').addEventListener('click', function () { regenerate(chat, m, { forceOffline: true }); });
      wrap.appendChild(er);
    }
    var aa = el('div', { class: 'msg-actions' });
    aa.appendChild(actionBtn('copy', 'Kopieren', function (b) {
      var d2 = m.docId && getDoc(m.docId);
      copyText(d2 ? d2.content : m.content); flashCheck(b, 'copy');
    }));
    if ('speechSynthesis' in window && !isNative) aa.appendChild(actionBtn('speaker', 'Vorlesen', function (b) { speak(m.content, b); }));
    aa.appendChild(actionBtn('refresh', 'Neu generieren', function () { regenerate(chat, m); }));
    if (m.model) aa.appendChild(el('span', { class: 'meta' }, esc(m.model)));
    wrap.appendChild(aa);
    return wrap;
  }

  function fillAssistant(content, m) {
    if (m.docId) { content.hidden = true; return; }
    if (m.pending && !m.content) { content.innerHTML = '<span class="typing-dot"></span>'; return; }
    content.innerHTML = window.Markdown.render(m.content || '');
  }

  function actionBtn(ic, title, fn) {
    var b = el('button', { type: 'button', title: title, 'aria-label': title }, icon(ic, 18));
    b.addEventListener('click', function () { fn(b); });
    return b;
  }
  function flashCheck(b, orig) {
    b.innerHTML = icon('check', 18);
    setTimeout(function () { b.innerHTML = icon(orig, 18); }, 1500);
  }

  function speak(text, btn) {
    var synth = window.speechSynthesis;
    if (synth.speaking) { synth.cancel(); btn.classList.remove('active'); return; }
    var plain = String(text || '').replace(/```[\s\S]*?```/g, ' Codeblock. ').replace(/[#*_`>|~-]/g, ' ');
    var u = new SpeechSynthesisUtterance(plain);
    u.lang = 'de-DE';
    u.onend = function () { btn.classList.remove('active'); };
    btn.classList.add('active');
    synth.speak(u);
  }

  function editMessage(chat, m, wrap) {
    if (state.streaming) return toast('Bitte warte, bis die Antwort fertig ist.');
    var bubble = wrap.querySelector('.bubble');
    var actions = wrap.querySelector('.msg-actions');
    var box = el('div', { class: 'edit-box' });
    var ta = el('textarea');
    ta.value = m.content;
    var row = el('div', { class: 'edit-actions' });
    var cancel = el('button', { class: 'btn small', type: 'button' }, 'Abbrechen');
    var ok = el('button', { class: 'btn small primary', type: 'button' }, 'Senden');
    row.appendChild(cancel); row.appendChild(ok);
    box.appendChild(ta); box.appendChild(row);
    if (bubble) bubble.replaceWith(box); else wrap.insertBefore(box, actions);
    actions.hidden = true;
    ta.style.height = Math.min(300, ta.scrollHeight + 4) + 'px';
    ta.focus();
    cancel.addEventListener('click', renderThread);
    ok.addEventListener('click', function () {
      var v = ta.value.trim();
      if (!v && !(m.attachments || []).length) return;
      var idx = chat.messages.indexOf(m);
      m.content = v;
      chat.messages = chat.messages.slice(0, idx + 1);
      chat.updated = Date.now();
      persist('chats');
      renderThread();
      generate(chat);
    });
    ta.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey && state.settings.enterToSend) { e.preventDefault(); ok.click(); }
      if (e.key === 'Escape') cancel.click();
    });
  }

  function isNearBottom() { return thread.scrollHeight - thread.scrollTop - thread.clientHeight < 80; }
  function scrollToBottom(force) {
    if (force || stickToBottom) thread.scrollTop = thread.scrollHeight;
    updateScrollBtn();
  }
  function updateScrollBtn() {
    $('#scrollDown').hidden = isNearBottom() || $('#main').classList.contains('is-empty');
  }

  // ======================================================================
  // Chats
  // ======================================================================
  function newChat() {
    if (state.streaming) stopStreaming();
    state.currentId = null;
    state.attachments = [];
    renderAttachments();
    renderThread();
    renderSidebar();
    closeMobileSidebar();
    if (!coarse) $('#input').focus();
  }

  function openChat(id) {
    state.currentId = id;
    renderThread();
    renderSidebar();
  }

  function ensureChat(firstText) {
    var chat = currentChat();
    if (!chat) {
      chat = { id: uid(), title: makeTitle(firstText), created: Date.now(), updated: Date.now(), messages: [] };
      state.chats.push(chat);
      state.currentId = chat.id;
    }
    return chat;
  }
  function makeTitle(text) {
    var t = String(text || '').replace(/\s+/g, ' ').trim();
    if (!t) return 'Neuer Chat';
    return t.length > 42 ? t.slice(0, 40).replace(/\s+\S*$/, '') + ' …' : t;
  }

  // ======================================================================
  // Eingabe
  // ======================================================================
  var input = $('#input');
  function autosize() {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, window.innerHeight * 0.38) + 'px';
  }
  function updateSend() {
    var btn = $('#sendBtn');
    if (state.streaming) {
      btn.disabled = false;
      btn.innerHTML = icon('stop', 18);
      btn.setAttribute('aria-label', 'Stopp');
      btn.title = 'Antwort stoppen';
    } else {
      btn.disabled = !input.value.trim() && !state.attachments.length;
      btn.innerHTML = icon('up', 20, 2.2);
      btn.setAttribute('aria-label', 'Senden');
      btn.title = 'Senden';
    }
  }

  function setCanvasMode(on) {
    state.canvasMode = on;
    $('#canvasChip').hidden = !on;
    input.placeholder = on ? 'Beschreibe das Dokument, das ich schreiben soll …' : 'Frag alles';
  }

  function openPlusMenu() {
    openMenu($('#plusBtn'), [
      { icon: 'clip', label: 'Fotos & Dateien hinzufügen', onClick: function () { $('#fileInput').click(); } },
      { sep: true },
      { icon: 'canvas', label: 'Canvas', desc: 'Dokument mit KI schreiben', checked: state.canvasMode, onClick: function () { setCanvasMode(!state.canvasMode); input.focus(); } },
      { icon: 'doc', label: 'Leeres Dokument', desc: 'Selbst schreiben', onClick: function () { createDoc('Unbenanntes Dokument', ''); } }
    ], { align: 'left', above: true });
  }

  // ---------- Anhänge ----------
  var TEXT_EXT = /\.(txt|md|markdown|csv|tsv|json|xml|html?|css|js|mjs|ts|tsx|jsx|py|java|c|h|cpp|hpp|cs|go|rs|rb|php|sh|bat|ps1|yml|yaml|toml|ini|cfg|log|sql|swift|kt|dart|vue|svelte|tex|rtf|srt)$/i;

  function readAsDataURL(file) {
    return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(r.result); }; r.onerror = rej; r.readAsDataURL(file); });
  }
  function readAsText(file) {
    return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(r.result); }; r.onerror = rej; r.readAsText(file); });
  }
  function shrinkImage(dataUrl, max) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () {
        var scale = Math.min(1, max / Math.max(img.width, img.height));
        var c = document.createElement('canvas');
        c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = function () { resolve(dataUrl); };
      img.src = dataUrl;
    });
  }

  async function addFiles(files) {
    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      if (state.attachments.length >= 10) { toast('Maximal 10 Dateien pro Nachricht.'); break; }
      try {
        if (/^image\//.test(f.type)) {
          var d = await shrinkImage(await readAsDataURL(f), 1280);
          state.attachments.push({ kind: 'image', name: f.name || 'Bild.jpg', data: d });
        } else if (/^text\//.test(f.type) || TEXT_EXT.test(f.name) || /json|xml|javascript/.test(f.type)) {
          if (f.size > 400 * 1024) { toast(f.name + ': Textdatei zu groß (max. 400 KB).'); continue; }
          state.attachments.push({ kind: 'text', name: f.name, data: await readAsText(f) });
        } else {
          state.attachments.push({ kind: 'file', name: f.name, data: '' });
          toast(f.name + ': Inhalt kann nicht gelesen werden – nur der Dateiname wird gesendet.');
        }
      } catch (e) { toast('Datei konnte nicht gelesen werden: ' + f.name); }
    }
    renderAttachments();
    updateSend();
  }

  function renderAttachments() {
    var box = $('#attachments');
    box.innerHTML = state.attachments.map(function (a, i) { return attachmentHTML(a, true, i); }).join('');
  }

  // ======================================================================
  // Senden & Generieren
  // ======================================================================
  function buildSystemPrompt(task) {
    var s = state.settings;
    var d = new Date();
    var parts = [
      'Du bist ' + APP + ', ein hilfreicher, präziser und freundlicher KI-Assistent.',
      'Antworte in der Sprache des Nutzers (standardmäßig Deutsch). Formatiere mit Markdown, wenn es die Lesbarkeit verbessert. Code immer in Codeblöcken mit Sprachangabe.',
      'Aktuelles Datum: ' + d.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) + '.'
    ];
    if (s.userName) parts.push('Der Nutzer heißt ' + s.userName + '.');
    if (s.aboutUser) parts.push('Informationen über den Nutzer:\n' + s.aboutUser);
    if (s.responseStyle) parts.push('Gewünschter Antwortstil:\n' + s.responseStyle);
    if (task === 'document') {
      parts.push('AUFGABE: Schreibe ein vollständiges Dokument gemäß der Anfrage. Gib AUSSCHLIESSLICH den Dokumentinhalt in Markdown aus – ohne Einleitung, ohne Kommentar davor oder danach. Beginne mit einer Überschrift der Ebene 1 (# Titel).');
    }
    if (task === 'edit-document') {
      parts.push('AUFGABE: Du bearbeitest ein bestehendes Dokument. Gib AUSSCHLIESSLICH die vollständige, überarbeitete Fassung des Dokuments in Markdown aus – ohne Kommentar davor oder danach.');
    }
    return parts.join('\n\n');
  }

  function historyFor(chat, uptoIdx) {
    return chat.messages.slice(0, uptoIdx).filter(function (m) { return !m.error || m.content; }).map(function (m) {
      var content = m.content || '';
      if (m.role === 'assistant' && m.docId) {
        var d = getDoc(m.docId);
        content = d ? '[Dokument „' + d.title + '“ erstellt]\n\n' + d.content.slice(0, 20000) : '[Dokument erstellt]';
      }
      return { role: m.role, content: content, attachments: m.attachments };
    }).filter(function (m) { return m.content || (m.attachments && m.attachments.length); });
  }

  function sendMessage() {
    if (state.streaming) { stopStreaming(); return; }
    var text = input.value.trim();
    if (!text && !state.attachments.length) return;
    var chat = ensureChat(text || (state.attachments[0] && state.attachments[0].name));
    chat.messages.push({ id: uid(), role: 'user', content: text, attachments: state.attachments.slice(), time: Date.now() });
    chat.updated = Date.now();
    state.attachments = [];
    input.value = '';
    autosize();
    renderAttachments();
    renderThread();
    renderSidebar();
    var task = state.canvasMode ? 'document' : null;
    if (state.canvasMode) setCanvasMode(false);
    generate(chat, { task: task });
  }

  function regenerate(chat, m, opts) {
    if (state.streaming) return;
    var idx = chat.messages.indexOf(m);
    if (idx < 0) return;
    var task = m.docId ? 'document' : null;
    chat.messages = chat.messages.slice(0, idx);
    renderThread();
    generate(chat, Object.assign({ task: task }, opts || {}));
  }

  async function generate(chat, opts) {
    opts = opts || {};
    var settings = opts.forceOffline ? merge(state.settings, { mode: 'offline' }) : state.settings;
    var history = historyFor(chat, chat.messages.length);
    var msg = { id: uid(), role: 'assistant', content: '', pending: true, time: Date.now(), model: window.Providers.label(settings) };
    var doc = null;
    if (opts.task === 'document') {
      var lastUser = history[history.length - 1];
      doc = createDoc(makeTitle(lastUser ? lastUser.content : 'Dokument'), '', { silent: true });
      msg.docId = doc.id;
      openCanvas(doc.id);
      setCvMode('edit');
      setCanvasBusy(true, 'KI schreibt …');
    }
    chat.messages.push(msg);
    chat.updated = Date.now();
    var box = $('#messages');
    var node = renderMessage(chat, msg, chat.messages.length - 1);
    box.appendChild(node);
    $('#main').classList.remove('is-empty');
    stickToBottom = true;
    scrollToBottom(true);

    var controller = new AbortController();
    state.streaming = { controller: controller, chatId: chat.id, msgId: msg.id };
    updateSend();

    var content = node.querySelector('.content');
    var raf = 0;
    function paint() {
      raf = 0;
      if (doc) {
        doc.content = msg.content;
        var t = /^#\s+(.+)$/m.exec(doc.content);
        if (t) doc.title = t[1].trim().slice(0, 100);
        if (state.docId === doc.id) syncCanvasFromDoc(true);
      } else if (content.isConnected) {
        fillAssistant(content, msg);
      }
      scrollToBottom();
    }

    try {
      await window.Providers.stream({
        settings: settings,
        messages: history,
        system: buildSystemPrompt(opts.task),
        signal: controller.signal,
        task: opts.task,
        onDelta: function (d) {
          msg.content += d;
          if (!raf) raf = requestAnimationFrame(paint);
        }
      });
      if (doc) msg.content = msg.content.replace(/^\s*```(?:markdown|md)?\s*\n([\s\S]*?)\n```\s*$/i, '$1');
    } catch (e) {
      if (e.name !== 'AbortError') msg.error = window.Providers.friendlyError(e);
    } finally {
      if (raf) cancelAnimationFrame(raf);
      paint();
      delete msg.pending;
      if (doc) {
        doc.updated = Date.now();
        setCanvasBusy(false, 'Gespeichert');
        if (state.docId === doc.id && doc.content.trim()) { setCvMode('preview'); $('#canvas .canvas-body').scrollTop = 0; editor.scrollTop = 0; }
        if (!msg.content && !msg.error) msg.error = 'Es wurde kein Inhalt erzeugt.';
        if (!doc.content.trim()) {
          // Leeres Dokument nach Fehler/Abbruch wieder entfernen
          state.docs = state.docs.filter(function (x) { return x.id !== doc.id; });
          delete msg.docId;
          if (state.docId === doc.id) closeCanvas();
        }
        persist('docs', true);
      }
      state.streaming = null;
      chat.updated = Date.now();
      persist('chats', true);
      updateSend();
      var old = document.querySelector('.msg[data-id="' + msg.id + '"]');
      if (old && currentChat() === chat) old.replaceWith(renderMessage(chat, msg, chat.messages.indexOf(msg)));
      renderSidebar();
      scrollToBottom();
    }
  }

  function stopStreaming() {
    if (state.streaming) state.streaming.controller.abort();
  }

  // ======================================================================
  // Canvas / Dokumente
  // ======================================================================
  var editor = $('#cvEditor');

  function createDoc(title, content, opts) {
    var d = { id: uid(), title: title || 'Unbenanntes Dokument', content: content || '', created: Date.now(), updated: Date.now() };
    state.docs.push(d);
    persist('docs', true);
    if (!opts || !opts.silent) openCanvas(d.id);
    return d;
  }

  function openCanvas(id) {
    var d = getDoc(id);
    if (!d) return;
    state.docId = id;
    $('#canvas').hidden = false;
    $('#app').classList.add('canvas-open');
    syncCanvasFromDoc();
    setCvMode(state.cvMode);
    $('#cvUndo').disabled = !d.prev;
    $('#cvStatus').textContent = '';
    closeMobileSidebar();
    closeModal();
  }

  function closeCanvas() {
    state.docId = null;
    $('#canvas').hidden = true;
    $('#app').classList.remove('canvas-open');
  }

  function syncCanvasFromDoc(streaming) {
    var d = getDoc(state.docId);
    if (!d) return;
    if (document.activeElement !== $('#cvTitle')) $('#cvTitle').value = d.title;
    if (editor.value !== d.content) {
      editor.value = d.content;
      if (streaming) editor.scrollTop = editor.scrollHeight;
    }
    if (state.cvMode === 'preview') $('#cvPreview').innerHTML = window.Markdown.render(d.content);
  }

  function setCvMode(mode) {
    state.cvMode = mode;
    $$('#cvMode button').forEach(function (b) { b.classList.toggle('on', b.dataset.mode === mode); });
    editor.hidden = mode !== 'edit';
    $('#cvPreview').hidden = mode !== 'preview';
    if (mode === 'preview') {
      var d = getDoc(state.docId);
      $('#cvPreview').innerHTML = window.Markdown.render(d ? d.content : '');
    }
  }

  function setCanvasBusy(busy, status) {
    $('#canvas').classList.toggle('busy', busy);
    editor.readOnly = busy;
    $('#cvAskInput').disabled = busy;
    $('#cvAskBtn').innerHTML = busy ? icon('stop', 16) : icon('up', 18);
    $('#cvAskBtn').setAttribute('aria-label', busy ? 'Stopp' : 'Senden');
    if (status != null) $('#cvStatus').textContent = status;
  }

  var docSaveTimer;
  function onEditorInput() {
    var d = getDoc(state.docId);
    if (!d) return;
    d.content = editor.value;
    d.updated = Date.now();
    $('#cvStatus').textContent = 'Wird gespeichert …';
    clearTimeout(docSaveTimer);
    docSaveTimer = setTimeout(function () { persist('docs', true); $('#cvStatus').textContent = 'Gespeichert'; refreshDocCards(d); }, 500);
  }

  function refreshDocCards(d) {
    $$('.msg').forEach(function (n) {
      var chat = currentChat();
      if (!chat) return;
      var m = chat.messages.find(function (x) { return x.id === n.dataset.id; });
      if (m && m.docId === d.id) { var b = n.querySelector('.doc-card b'); if (b) b.textContent = d.title; }
    });
  }

  async function askCanvas(e) {
    e.preventDefault();
    if (state.streaming) { stopStreaming(); return; }
    var d = getDoc(state.docId);
    var q = $('#cvAskInput').value.trim();
    if (!d || !q) return;
    if (window.Providers.active(state.settings) === 'offline') {
      toast('Dokumente mit KI überarbeiten braucht eine KI-Verbindung.');
      openSettings('ai');
      return;
    }
    var controller = new AbortController();
    state.streaming = { controller: controller, chatId: null, msgId: null };
    updateSend();
    d.prev = d.content;
    var original = d.content;
    var out = '';
    $('#cvAskInput').value = '';
    setCanvasBusy(true, 'KI überarbeitet …');
    try {
      await window.Providers.stream({
        settings: state.settings,
        system: buildSystemPrompt('edit-document'),
        messages: [{ role: 'user', content: 'Hier ist das aktuelle Dokument:\n\n' + original + '\n\n---\n\nÄnderungswunsch: ' + q }],
        signal: controller.signal,
        task: 'edit-document',
        currentDoc: original,
        onDelta: function (t) { out += t; d.content = out; syncCanvasFromDoc(true); }
      });
      out = out.replace(/^\s*```(?:markdown|md)?\s*\n([\s\S]*?)\n```\s*$/i, '$1');
      if (!out.trim()) { d.content = original; toast('Keine Änderung erhalten.'); }
      else d.content = out;
      $('#cvStatus').textContent = 'Überarbeitet';
    } catch (err) {
      d.content = original;
      if (err.name !== 'AbortError') toast('Fehler: ' + window.Providers.friendlyError(err), 5000);
      $('#cvStatus').textContent = '';
    } finally {
      var t = /^#\s+(.+)$/m.exec(d.content);
      if (t) d.title = t[1].trim().slice(0, 100);
      d.updated = Date.now();
      state.streaming = null;
      setCanvasBusy(false);
      syncCanvasFromDoc();
      $('#cvUndo').disabled = !d.prev;
      persist('docs', true);
      updateSend();
      refreshDocCards(d);
    }
  }

  function undoCanvas() {
    var d = getDoc(state.docId);
    if (!d || d.prev == null) return;
    var cur = d.content;
    d.content = d.prev;
    d.prev = cur;
    persist('docs', true);
    syncCanvasFromDoc();
    toast('Änderung rückgängig gemacht (erneut klicken zum Wiederherstellen)');
  }

  function docToHTML(d) {
    return '<!doctype html><html lang="de"><head><meta charset="utf-8"><title>' + esc(d.title) + '</title>' +
      '<style>body{font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:760px;margin:40px auto;padding:0 20px;line-height:1.6;color:#111}' +
      'table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:6px 10px}pre{background:#f5f5f5;padding:12px;border-radius:8px;overflow:auto}' +
      'code{font-family:Consolas,monospace}.code-head{display:none}blockquote{border-left:3px solid #ccc;margin:0;padding-left:12px;color:#555}</style></head><body>' +
      window.Markdown.render(d.content) + '</body></html>';
  }

  function exportDocMenu(anchor, d) {
    d = d || getDoc(state.docId);
    if (!d) return;
    var base = slug(d.title);
    var items = [
      { icon: 'doc', label: 'Markdown (.md)', onClick: function () { saveFile(base + '.md', d.content, 'text/markdown'); } },
      { icon: 'doc', label: 'Text (.txt)', onClick: function () { saveFile(base + '.txt', d.content, 'text/plain'); } },
      { icon: 'doc', label: 'Webseite (.html)', onClick: function () { saveFile(base + '.html', docToHTML(d), 'text/html'); } },
      { icon: 'doc', label: 'Word (.doc)', onClick: function () { saveFile(base + '.doc', docToHTML(d), 'application/msword'); } }
    ];
    if (!isNative) items.push({ sep: true }, { icon: 'printer', label: 'Drucken / als PDF speichern', onClick: function () { printDoc(d); } });
    openMenu(anchor, items, { align: 'right' });
  }

  function printDoc(d) {
    if (state.docId !== d.id) openCanvas(d.id);
    var prev = $('#cvPreview');
    prev.innerHTML = window.Markdown.render(d.content);
    var wasHidden = prev.hidden;
    prev.hidden = false;
    setTimeout(function () { window.print(); prev.hidden = wasHidden; }, 50);
  }

  // ======================================================================
  // Menüs
  // ======================================================================
  var activeMenu = null;
  function closeMenu() {
    if (!activeMenu) return;
    var m = activeMenu;
    activeMenu = null;
    m.node.remove();
    document.removeEventListener('mousedown', m.outside, true);
    document.removeEventListener('touchstart', m.outside, true);
    if (m.onClose) m.onClose();
  }

  function openMenu(anchor, items, opts) {
    opts = opts || {};
    closeMenu();
    var menu = el('div', { class: 'menu', role: 'menu' });
    if (opts.width) menu.style.minWidth = opts.width + 'px';
    items.forEach(function (it) {
      if (it.sep) { menu.appendChild(el('div', { class: 'menu-sep' })); return; }
      if (it.header) { menu.appendChild(el('div', { class: 'menu-label' }, esc(it.label))); return; }
      var b = el('button', { class: 'menu-item' + (it.danger ? ' danger' : ''), role: 'menuitem', type: 'button' },
        (it.icon ? icon(it.icon, 18) : '') +
        '<span class="mi-text">' + esc(it.label) + (it.desc ? '<small>' + esc(it.desc) + '</small>' : '') + '</span>' +
        (it.checked ? '<span class="mi-check">' + icon('check', 18) + '</span>' : ''));
      b.addEventListener('click', function () { closeMenu(); it.onClick && it.onClick(); });
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
  }

  // ======================================================================
  // Modale
  // ======================================================================
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

  // ---------- Suche ----------
  function openSearch() {
    closeMobileSidebar();
    var body = el('div', { style: 'display:flex;flex-direction:column;min-height:0;flex:1' });
    body.innerHTML = '<div class="search-input">' + icon('search') + '<input placeholder="Chats durchsuchen …" aria-label="Suche"></div><div class="result-list"></div>';
    var modal = openModal({ title: false, body: body, size: 'wide' });
    modal.style.height = 'min(560px, 80vh)';
    var q = body.querySelector('input'), list = body.querySelector('.result-list');
    var sel = 0, results = [];
    function hl(text, term) {
      var t = esc(text);
      if (!term) return t;
      var i = text.toLowerCase().indexOf(term.toLowerCase());
      if (i < 0) return t;
      return esc(text.slice(0, i)) + '<mark>' + esc(text.slice(i, i + term.length)) + '</mark>' + esc(text.slice(i + term.length));
    }
    function run() {
      var term = q.value.trim();
      var lo = term.toLowerCase();
      results = [];
      if (!term) {
        var nb = el('button', { class: 'result' }, icon('compose', 18) + '<span class="r-main"><b>Neuer Chat</b></span>');
        list.innerHTML = '';
        nb.addEventListener('click', function () { closeModal(); newChat(); });
        list.appendChild(nb);
      } else list.innerHTML = '';
      state.chats.slice().sort(function (a, b) { return b.updated - a.updated; }).forEach(function (c) {
        var snippet = '';
        if (lo) {
          var inTitle = (c.title || '').toLowerCase().indexOf(lo) >= 0;
          var hit = c.messages.find(function (m) { return (m.content || '').toLowerCase().indexOf(lo) >= 0; });
          if (!inTitle && !hit) return;
          if (hit) {
            var i = hit.content.toLowerCase().indexOf(lo);
            snippet = (i > 30 ? '…' : '') + hit.content.slice(Math.max(0, i - 30), i + 80).replace(/\s+/g, ' ');
          }
        } else {
          var lastMsg = c.messages[c.messages.length - 1];
          snippet = lastMsg ? (lastMsg.content || '').slice(0, 90).replace(/\s+/g, ' ') : '';
        }
        results.push(c);
        var b = el('button', { class: 'result' }, icon('compose', 18) + '<span class="r-main"><b>' + hl(c.title || 'Neuer Chat', term) + '</b><small>' + hl(snippet, term) + '</small></span>');
        b.addEventListener('click', function () { closeModal(); openChat(c.id); });
        list.appendChild(b);
      });
      state.docs.forEach(function (d) {
        if (lo && (d.title + ' ' + d.content).toLowerCase().indexOf(lo) < 0) return;
        if (!lo) return;
        var b = el('button', { class: 'result' }, icon('doc', 18) + '<span class="r-main"><b>' + hl(d.title, term) + '</b><small>Dokument</small></span>');
        b.addEventListener('click', function () { closeModal(); openCanvas(d.id); });
        list.appendChild(b);
      });
      if (!list.children.length) list.appendChild(el('div', { class: 'list-empty' }, 'Keine Treffer.'));
      sel = 0; mark();
    }
    function mark() { $$('.result', list).forEach(function (r, i) { r.classList.toggle('sel', i === sel); }); }
    q.addEventListener('input', run);
    q.addEventListener('keydown', function (e) {
      var items = $$('.result', list);
      if (e.key === 'ArrowDown') { sel = Math.min(items.length - 1, sel + 1); mark(); e.preventDefault(); }
      if (e.key === 'ArrowUp') { sel = Math.max(0, sel - 1); mark(); e.preventDefault(); }
      if (e.key === 'Enter' && items[sel]) items[sel].click();
    });
    run();
    setTimeout(function () { q.focus(); }, 30);
  }

  // ---------- Dokumente ----------
  function openDocs() {
    closeMobileSidebar();
    var body = el('div', { style: 'display:flex;flex-direction:column;min-height:0' });
    var top = el('div', { class: 'search-input' }, icon('search') + '<input placeholder="Dokumente durchsuchen …">');
    var nb = el('button', { class: 'btn small primary' }, icon('plus', 16) + 'Neu');
    top.appendChild(nb);
    var list = el('div', { class: 'result-list' });
    body.appendChild(top); body.appendChild(list);
    openModal({ title: 'Dokumente', body: body, size: 'wide' });
    var q = top.querySelector('input');
    function run() {
      var lo = q.value.trim().toLowerCase();
      list.innerHTML = '';
      var docs = state.docs.slice().sort(function (a, b) { return b.updated - a.updated; })
        .filter(function (d) { return !lo || (d.title + ' ' + d.content).toLowerCase().indexOf(lo) >= 0; });
      if (!docs.length) {
        list.appendChild(el('div', { class: 'list-empty' }, state.docs.length ? 'Keine Treffer.' : 'Noch keine Dokumente. Erstelle eins mit „Neu“ oder im Chat über + → Canvas.'));
        return;
      }
      docs.forEach(function (d) {
        var words = (d.content.match(/\S+/g) || []).length;
        var row = el('div', { class: 'result', role: 'button', tabindex: '0' },
          icon('doc', 18) + '<span class="r-main"><b>' + esc(d.title) + '</b><small>' +
          new Date(d.updated).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' }) + ' · ' + words + ' Wörter</small></span>');
        var more = el('button', { class: 'icon-btn r-act', 'aria-label': 'Optionen' }, icon('more', 18));
        more.addEventListener('click', function (e) {
          e.stopPropagation();
          openMenu(more, [
            { icon: 'download', label: 'Exportieren …', onClick: function () { exportDocMenu(more, d); } },
            { icon: 'copy', label: 'Duplizieren', onClick: function () { createDoc(d.title + ' (Kopie)', d.content, { silent: true }); run(); } },
            { sep: true },
            {
              icon: 'trash', label: 'Löschen', danger: true, onClick: function () {
                confirmDialog({ title: 'Dokument löschen?', text: '<b>' + esc(d.title) + '</b> wird dauerhaft gelöscht.', ok: 'Löschen', danger: true }).then(function (ok) {
                  if (!ok) return;
                  state.docs = state.docs.filter(function (x) { return x.id !== d.id; });
                  persist('docs', true);
                  if (state.docId === d.id) closeCanvas();
                  run();
                });
              }
            }
          ], { align: 'right' });
        });
        row.appendChild(more);
        row.addEventListener('click', function () { openCanvas(d.id); });
        row.addEventListener('keydown', function (e) { if (e.key === 'Enter') openCanvas(d.id); });
        list.appendChild(row);
      });
    }
    q.addEventListener('input', run);
    nb.addEventListener('click', function () { createDoc('Unbenanntes Dokument', ''); setCvMode('edit'); setTimeout(function () { editor.focus(); }, 50); });
    run();
  }

  // ---------- Profilmenü ----------
  function openProfileMenu() {
    var s = state.settings;
    var items = [
      { label: (s.userName || 'Du') + ' · ' + planName(s.plan), header: true },
      { icon: 'sparkles', label: s.plan === 'free' ? 'Plan upgraden' : 'Abo verwalten', onClick: s.plan === 'free' ? openPlans : function () { openSettings('plan'); } },
      { icon: 'user', label: 'Personalisierung', onClick: function () { openSettings('personal'); } },
      { icon: 'gear', label: 'Einstellungen', onClick: function () { openSettings('general'); } },
      { sep: true },
      {
        icon: document.documentElement.getAttribute('data-theme') === 'dark' ? 'sun' : 'moon',
        label: document.documentElement.getAttribute('data-theme') === 'dark' ? 'Helles Design' : 'Dunkles Design',
        onClick: function () {
          s.theme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
          saveSettings(); applyTheme();
        }
      },
      { icon: 'help', label: 'Hilfe & Tastenkürzel', onClick: openHelp }
    ];
    openMenu($('#profileBtn'), items, { above: true, width: 240 });
  }

  function openHelp() {
    var body = el('div', { class: 'modal-body' });
    body.innerHTML = '<div class="md">' + window.Markdown.render(
      '### Tastenkürzel\n\n| Aktion | Taste |\n|---|---|\n| Senden | Enter |\n| Neue Zeile | Umschalt + Enter |\n| Neuer Chat | Strg/⌘ + Umschalt + O |\n| Chats suchen | Strg/⌘ + K |\n| Seitenleiste | Strg/⌘ + Umschalt + S |\n| Schließen | Esc |\n\n' +
      '### Offline & online\n\n- **Online:** Unter *Einstellungen → KI-Verbindung* einen Anbieter eintragen (OpenAI-kompatibel wie OpenAI, OpenRouter, Groq; oder Anthropic). Der Schlüssel bleibt nur auf diesem Gerät.\n' +
      '- **Lokal ohne Internet:** [Ollama](https://ollama.com) oder LM Studio auf dem PC installieren und in den Einstellungen die Vorlage „Ollama“ wählen.\n' +
      '- **Offline (eingebaut):** Rechnen, Umrechnen, Datum/Uhrzeit, Textstatistik und Dokumentvorlagen – funktioniert immer.\n\n' +
      '### Dokumente (Canvas)\n\nÜber **+ → Canvas** schreibt die KI direkt ein Dokument. Im Editor kannst du selbst schreiben, die KI um Änderungen bitten und als Markdown, Text, HTML oder Word exportieren.\n\n' +
      '### Abo\n\nDas Abo ist eine **Demo**: Es werden keine Zahlungsdaten abgefragt und nichts berechnet.') + '</div>';
    openModal({ title: 'Hilfe', body: body });
  }

  // ---------- Einstellungen ----------
  function openSettings(tab) {
    closeMobileSidebar();
    var s = state.settings;
    var tabs = [
      { id: 'general', icon: 'gear', label: 'Allgemein' },
      { id: 'personal', icon: 'user', label: 'Personalisierung' },
      { id: 'ai', icon: 'plug', label: 'KI-Verbindung' },
      { id: 'data', icon: 'database', label: 'Datenkontrollen' },
      { id: 'plan', icon: 'card', label: 'Abo' }
    ];
    var body = el('div', { class: 'settings' });
    var nav = el('div', { class: 'settings-nav' });
    var pane = el('div', { class: 'settings-pane' });
    body.appendChild(nav); body.appendChild(pane);
    tabs.forEach(function (t) {
      var b = el('button', { type: 'button', 'data-tab': t.id }, icon(t.icon, 18) + '<span>' + t.label + '</span>');
      b.addEventListener('click', function () { show(t.id); });
      nav.appendChild(b);
    });
    var modal = openModal({ title: 'Einstellungen', body: body, size: 'wide', onClose: function () { renderTopbar(); renderSidebar(); } });
    modal.style.height = 'min(640px, 88vh)';

    function row(label, hint, control) {
      var r = el('div', { class: 'set-row' }, '<div class="lbl">' + label + (hint ? '<small>' + hint + '</small>' : '') + '</div>');
      r.appendChild(control);
      return r;
    }
    function toggle(checked, onChange) {
      var l = el('label', { class: 'switch' }, '<input type="checkbox"' + (checked ? ' checked' : '') + '><span></span>');
      l.querySelector('input').addEventListener('change', function (e) { onChange(e.target.checked); });
      return l;
    }
    function select(options, value, onChange) {
      var sel = el('select', { class: 'field inline' });
      options.forEach(function (o) { var op = el('option', { value: o[0] }); op.textContent = o[1]; if (o[0] === value) op.selected = true; sel.appendChild(op); });
      sel.addEventListener('change', function () { onChange(sel.value); });
      return sel;
    }
    function button(label, cls, fn) {
      var b = el('button', { class: 'btn small ' + (cls || ''), type: 'button' }, label);
      b.addEventListener('click', fn);
      return b;
    }
    function col(label, control, hint) {
      var c = el('div', { class: 'set-col' }, '<label>' + label + '</label>');
      c.appendChild(control);
      if (hint) c.appendChild(el('small', { class: 'hint' }, hint));
      return c;
    }
    function field(value, placeholder, onInput, type) {
      var f = el('input', { class: 'field', type: type || 'text', placeholder: placeholder || '', spellcheck: 'false', autocomplete: 'off' });
      f.value = value || '';
      f.addEventListener('input', function () { onInput(f.value); });
      return f;
    }

    function show(id) {
      $$('button', nav).forEach(function (b) { b.classList.toggle('on', b.dataset.tab === id); });
      pane.innerHTML = '';
      if (id === 'general') {
        pane.appendChild(row('Design', null, select([['system', 'System'], ['dark', 'Dunkel'], ['light', 'Hell']], s.theme, function (v) { s.theme = v; saveSettings(); applyTheme(); })));
        pane.appendChild(row('Mit Enter senden', 'Aus: Enter fügt eine neue Zeile ein, gesendet wird mit dem Pfeil.', toggle(s.enterToSend, function (v) { s.enterToSend = v; saveSettings(); })));
        pane.appendChild(row('Modus', 'Automatisch nutzt die KI-Verbindung, wenn Internet da ist, sonst den Offline-Assistenten.',
          select([['auto', 'Automatisch'], ['offline', 'Immer offline']], s.mode, function (v) { s.mode = v; saveSettings(); renderTopbar(); })));
        pane.appendChild(row('Alle Chats löschen', null, button('Alle löschen', 'danger', function () { deleteAllChats(); })));
        pane.appendChild(row('Version', null, el('span', { style: 'color:var(--text-3);font-size:13px' }, APP + ' 1.0.0 · ' + (isNative ? 'Android' : isElectron ? 'Desktop' : 'Web'))));
      }
      if (id === 'personal') {
        pane.appendChild(col('Wie soll ' + APP + ' dich nennen?', field(s.userName, 'Dein Name', function (v) { s.userName = v.trim(); saveSettings(); })));
        var about = el('textarea', { class: 'field', placeholder: 'z. B. Beruf, Interessen, Wohnort …' });
        about.value = s.aboutUser;
        about.addEventListener('input', function () { s.aboutUser = about.value; saveSettings(); });
        pane.appendChild(col('Was soll ' + APP + ' über dich wissen?', about));
        var style = el('textarea', { class: 'field', placeholder: 'z. B. kurz und direkt, mit Beispielen, per Du …' });
        style.value = s.responseStyle;
        style.addEventListener('input', function () { s.responseStyle = style.value; saveSettings(); });
        pane.appendChild(col('Wie soll ' + APP + ' antworten?', style, 'Diese Angaben werden bei jeder Anfrage an die KI mitgeschickt.'));
      }
      if (id === 'ai') renderAiTab();
      if (id === 'data') {
        pane.appendChild(row('Daten exportieren', 'Alle Chats, Dokumente und Einstellungen (ohne API-Schlüssel) als JSON-Datei.', button('Exportieren', '', exportAll)));
        pane.appendChild(row('Daten importieren', 'Eine zuvor exportierte JSON-Datei einlesen. Vorhandene Einträge bleiben erhalten.', button('Importieren', '', function () { $('#importInput').click(); })));
        pane.appendChild(row('Alle Chats löschen', state.chats.length + ' Chats', button('Löschen', 'danger', deleteAllChats)));
        pane.appendChild(row('Alle Dokumente löschen', state.docs.length + ' Dokumente', button('Löschen', 'danger', function () {
          confirmDialog({ title: 'Alle Dokumente löschen?', text: 'Alle ' + state.docs.length + ' Dokumente werden dauerhaft gelöscht.', ok: 'Löschen', danger: true }).then(function (ok) {
            if (!ok) return;
            state.docs = []; persist('docs', true); closeCanvas(); show('data'); toast('Dokumente gelöscht');
          });
        })));
        var used = 0;
        try { for (var k in localStorage) if (k.indexOf('novachat.') === 0) used += (localStorage.getItem(k) || '').length; } catch (e) { /* ignorieren */ }
        pane.appendChild(row('Speicher', 'Alle Daten liegen nur lokal auf diesem Gerät.', el('span', { style: 'color:var(--text-3);font-size:13px' }, (used / 1024).toFixed(0) + ' KB belegt')));
      }
      if (id === 'plan') {
        var paid = s.plan !== 'free';
        pane.appendChild(row('Aktueller Plan', paid && s.planSince ? 'Seit ' + new Date(s.planSince).toLocaleDateString('de-DE') + ' · Demo-Abo, es wird nichts berechnet' : 'Kostenlos',
          el('span', { class: 'plan-badge', style: 'font-size:13px;padding:3px 10px' }, planName(s.plan))));
        pane.appendChild(row(paid ? 'Plan ändern' : 'Upgrade', 'Plus und Pro sind in dieser App Demo-Abos ohne Zahlung.', button(paid ? 'Pläne ansehen' : 'Upgrade', 'primary', function () { closeModal(); openPlans(); })));
        if (paid) pane.appendChild(row('Abo kündigen', 'Wechselt sofort zurück zu Free.', button('Kündigen', 'danger', function () {
          confirmDialog({ title: 'Abo kündigen?', text: 'Dein ' + planName(s.plan) + '-Demo-Abo wird beendet.', ok: 'Kündigen', danger: true }).then(function (ok) {
            if (!ok) return;
            s.plan = 'free'; s.planSince = null; saveSettings(); renderSidebar(); renderTopbar(); show('plan'); toast('Abo gekündigt');
          });
        })));
      }
    }

    function renderAiTab() {
      var intro = el('div', { class: 'notice', style: 'margin:12px 0 4px' },
        'Verbinde ein KI-Modell für echte Antworten. Der API-Schlüssel wird <b>nur lokal auf diesem Gerät</b> gespeichert und direkt an den Anbieter gesendet. Ohne Verbindung antwortet der eingebaute Offline-Assistent.');
      pane.appendChild(intro);
      pane.appendChild(row('Anbieter', null, select([['openai', 'OpenAI-kompatibel'], ['anthropic', 'Anthropic']], s.provider, function (v) { s.provider = v; saveSettings(); show('ai'); })));
      var status = el('div', { class: 'status-line' });
      var modelInput, modelList = el('datalist', { id: 'modelOptions' });

      if (s.provider === 'openai') {
        var urlF = field(s.openai.baseUrl, 'https://api.openai.com/v1', function (v) { s.openai.baseUrl = v.trim(); saveSettings(); });
        var urlCol = col('Basis-URL', urlF);
        var presets = el('div', { class: 'preset-row' });
        [
          ['OpenAI', 'https://api.openai.com/v1'],
          ['OpenRouter', 'https://openrouter.ai/api/v1'],
          ['Groq', 'https://api.groq.com/openai/v1'],
          ['Ollama (lokal)', 'http://localhost:11434/v1'],
          ['LM Studio (lokal)', 'http://localhost:1234/v1']
        ].forEach(function (p) {
          var b = el('button', { type: 'button' }, p[0]);
          b.addEventListener('click', function () { s.openai.baseUrl = p[1]; urlF.value = p[1]; saveSettings(); });
          presets.appendChild(b);
        });
        urlCol.appendChild(presets);
        urlCol.appendChild(el('small', { class: 'hint' }, 'Lokale Modelle (Ollama, LM Studio) laufen ohne Internet – ideal für den Desktop. Kein API-Schlüssel nötig.'));
        pane.appendChild(urlCol);
        pane.appendChild(col('API-Schlüssel', field(s.openai.apiKey, 'sk-… (bei lokalen Modellen leer lassen)', function (v) { s.openai.apiKey = v.trim(); saveSettings(); }, 'password')));
        modelInput = field(s.openai.model, 'Modellname, z. B. über „Modelle laden“ auswählen', function (v) { s.openai.model = v.trim(); saveSettings(); });
      } else {
        pane.appendChild(col('API-Schlüssel', field(s.anthropic.apiKey, 'sk-ant-…', function (v) { s.anthropic.apiKey = v.trim(); saveSettings(); }, 'password'),
          'Schlüssel erhältst du in der Anthropic Console.'));
        modelInput = field(s.anthropic.model, 'claude-sonnet-5', function (v) { s.anthropic.model = v.trim(); saveSettings(); });
      }
      modelInput.setAttribute('list', 'modelOptions');
      var mwrap = el('div', { class: 'input-with-btn' });
      mwrap.appendChild(modelInput);
      mwrap.appendChild(button('Modelle laden', '', async function () {
        status.className = 'status-line'; status.textContent = 'Lade Modelle …';
        try {
          var models = await window.Providers.listModels(s);
          modelList.innerHTML = models.map(function (m) { return '<option value="' + esc(m) + '">'; }).join('');
          status.className = 'status-line ok';
          status.textContent = models.length + ' Modelle gefunden – ins Feld klicken, um eins auszuwählen.';
          if (!modelInput.value && models.length) { modelInput.value = models[0]; modelInput.dispatchEvent(new Event('input')); }
        } catch (e) { status.className = 'status-line err'; status.textContent = window.Providers.friendlyError(e); }
      }));
      var mcol = col('Modell', mwrap);
      mcol.appendChild(modelList);
      pane.appendChild(mcol);

      var test = el('div', { class: 'set-col' });
      test.appendChild(button(icon('check', 14) + 'Verbindung testen', 'primary', async function () {
        status.className = 'status-line'; status.textContent = 'Teste …';
        var probe = merge(s, { mode: 'auto' });
        if (window.Providers.active(probe) === 'offline') {
          status.className = 'status-line err';
          status.textContent = navigator.onLine ? 'Bitte Basis-URL/Schlüssel und Modell ausfüllen.' : 'Keine Internetverbindung.';
          return;
        }
        var out = '';
        try {
          await window.Providers.stream({ settings: probe, messages: [{ role: 'user', content: 'Antworte nur mit: OK' }], system: 'Antworte extrem kurz.', onDelta: function (d) { out += d; } });
          status.className = 'status-line ok';
          status.textContent = 'Verbindung funktioniert ✓ Antwort: „' + out.trim().slice(0, 60) + '“';
          if (s.mode === 'offline') { s.mode = 'auto'; saveSettings(); }
        } catch (e) { status.className = 'status-line err'; status.textContent = window.Providers.friendlyError(e); }
      }));
      test.appendChild(status);
      pane.appendChild(test);
    }

    show(tab || 'general');
  }

  function deleteAllChats() {
    confirmDialog({ title: 'Alle Chats löschen?', text: 'Alle ' + state.chats.length + ' Chats werden dauerhaft gelöscht.', ok: 'Alle löschen', danger: true }).then(function (ok) {
      if (!ok) return;
      stopStreaming();
      state.chats = []; persist('chats', true);
      closeModal();
      newChat();
      toast('Alle Chats gelöscht');
    });
  }

  function exportAll() {
    var s = JSON.parse(JSON.stringify(state.settings));
    s.openai.apiKey = ''; s.anthropic.apiKey = '';
    var data = { app: APP, version: 1, exported: new Date().toISOString(), chats: state.chats, docs: state.docs, settings: s };
    saveFile('novachat-export-' + new Date().toISOString().slice(0, 10) + '.json', JSON.stringify(data, null, 2), 'application/json');
  }

  async function importAll(file) {
    try {
      var data = JSON.parse(await readAsText(file));
      if (!data || !Array.isArray(data.chats)) throw new Error('Ungültiges Format');
      var ids = new Set(state.chats.map(function (c) { return c.id; }));
      var n = 0;
      data.chats.forEach(function (c) { if (c && c.id && Array.isArray(c.messages) && !ids.has(c.id)) { state.chats.push(c); n++; } });
      var dids = new Set(state.docs.map(function (d) { return d.id; }));
      var nd = 0;
      (data.docs || []).forEach(function (d) { if (d && d.id && !dids.has(d.id)) { state.docs.push(d); nd++; } });
      persist('chats', true); persist('docs', true);
      renderSidebar();
      toast(n + ' Chats und ' + nd + ' Dokumente importiert');
    } catch (e) { toast('Import fehlgeschlagen: ' + e.message); }
  }

  function exportChat(c) {
    c = c || currentChat();
    if (!c || !c.messages.length) { toast('Dieser Chat ist noch leer.'); return; }
    var md = '# ' + c.title + '\n\n_' + new Date(c.created).toLocaleString('de-DE') + '_\n\n';
    c.messages.forEach(function (m) {
      var content = m.content;
      if (m.docId) { var d = getDoc(m.docId); if (d) content = d.content; }
      md += '### ' + (m.role === 'user' ? (state.settings.userName || 'Du') : APP) + '\n\n' + (content || '') + '\n\n';
    });
    saveFile(slug(c.title) + '.md', md, 'text/markdown');
  }

  // ---------- Pläne (Demo-Abo) ----------
  var PLANS = [
    {
      id: 'free', name: 'Free', price: '0 €', per: 'EUR /<br>Monat', desc: 'Intelligenz für alltägliche Aufgaben',
      features: ['Offline-Assistent', 'Eigene KI-Verbindung', 'Dokumente mit Canvas', 'Dateien und Bilder hochladen']
    },
    {
      id: 'plus', name: 'Plus', price: '23 €', per: 'EUR /<br>Monat', desc: 'Mehr Zugriff auf erweiterte Intelligenz', featured: true, tag: 'BELIEBT',
      features: ['Alles aus Free', 'Plus-Abzeichen im Profil', 'Erweiterte Limits (Demo)', 'Früher Zugang zu neuen Funktionen (Demo)']
    },
    {
      id: 'pro', name: 'Pro', price: '229 €', per: 'EUR /<br>Monat', desc: 'Voller Zugriff auf das Beste von ' + APP,
      features: ['Alles aus Plus', 'Pro-Abzeichen im Profil', 'Unbegrenzte Nutzung (Demo)', 'Priorisierter Support (Demo)']
    }
  ];

  function openPlans() {
    closeMobileSidebar();
    var s = state.settings;
    var body = el('div', { class: 'modal-body' });
    body.innerHTML = '<div class="plans-head"><h2>Plan upgraden</h2><p>Demo-Abo – es werden keine Zahlungsdaten abgefragt und nichts berechnet.</p></div>';
    var grid = el('div', { class: 'plans' });
    PLANS.forEach(function (p) {
      var cur = s.plan === p.id;
      var card = el('div', { class: 'plan' + (p.featured ? ' featured' : '') });
      card.innerHTML = '<div class="p-top"><h3>' + p.name + '</h3>' + (p.tag ? '<span class="tag">' + p.tag + '</span>' : '') + '</div>' +
        '<div class="price">' + p.price + '<small>' + p.per + '</small></div><div class="p-desc">' + esc(p.desc) + '</div>';
      var btn = el('button', { class: 'btn ' + (cur ? '' : (p.featured ? 'primary' : '')), type: 'button' },
        cur ? 'Dein aktueller Plan' : (p.id === 'free' ? 'Zu Free wechseln' : p.name + ' holen'));
      btn.disabled = cur;
      btn.addEventListener('click', function () {
        if (p.id === 'free') {
          confirmDialog({ title: 'Zu Free wechseln?', text: 'Dein Demo-Abo wird beendet.', ok: 'Wechseln' }).then(function (ok) {
            if (!ok) return;
            s.plan = 'free'; s.planSince = null; saveSettings(); closeModal(); renderSidebar(); renderTopbar(); toast('Du nutzt jetzt Free');
          });
        } else openCheckout(p);
      });
      card.appendChild(btn);
      var ul = el('ul');
      ul.innerHTML = p.features.map(function (f) { return '<li>' + icon('check', 16) + '<span>' + esc(f) + '</span></li>'; }).join('');
      card.appendChild(ul);
      grid.appendChild(card);
    });
    body.appendChild(grid);
    body.appendChild(el('p', { class: 'plans-note' }, 'Preise dienen nur der Darstellung. Die Abo-Funktion ist eine Simulation.'));
    openModal({ title: '', body: body, size: 'full' });
  }

  function openCheckout(p) {
    var body = el('div', { class: 'modal-body' });
    body.innerHTML = '<div class="checkout-sum">' +
      '<div class="row"><span>' + APP + ' ' + p.name + ' (monatlich)</span><span>' + p.price + '</span></div>' +
      '<div class="row"><span>Demo-Rabatt</span><span>−' + p.price + '</span></div>' +
      '<div class="row total"><span>Heute fällig</span><span>0,00 €</span></div></div>' +
      '<div class="notice">Dies ist ein <b>Demo-Abo</b>. Es werden keine Zahlungsdaten abgefragt, keine Zahlung ausgeführt und nichts an Dritte gesendet. Das Abo wird nur lokal auf diesem Gerät aktiviert.</div>';
    var foot = el('div', { class: 'modal-foot' });
    var cancel = el('button', { class: 'btn' }, 'Abbrechen');
    var ok = el('button', { class: 'btn primary' }, 'Demo-Abo abschließen');
    foot.appendChild(cancel); foot.appendChild(ok);
    var wrap = el('div'); wrap.appendChild(body); wrap.appendChild(foot);
    openModal({ title: p.name + ' abonnieren', body: wrap });
    cancel.addEventListener('click', closeModal);
    ok.addEventListener('click', function () {
      ok.disabled = true; cancel.disabled = true;
      ok.innerHTML = '<span class="spinner"></span> Wird aktiviert …';
      setTimeout(function () {
        state.settings.plan = p.id;
        state.settings.planSince = Date.now();
        saveSettings();
        closeModal(); closeModal();
        renderSidebar(); renderTopbar();
        var b = el('div', { class: 'modal-body', style: 'text-align:center;padding:30px 24px' },
          '<div style="font-size:44px;line-height:1">✨</div><h2 style="margin:12px 0 6px">Willkommen bei ' + APP + ' ' + p.name + '!</h2>' +
          '<p style="color:var(--text-2);margin:0 0 18px">Dein Demo-Abo ist aktiv.</p>');
        var go = el('button', { class: 'btn primary' }, 'Los geht’s');
        go.addEventListener('click', closeModal);
        b.appendChild(go);
        openModal({ title: false, body: b });
      }, 1200);
    });
  }

  // ======================================================================
  // Spracheingabe
  // ======================================================================
  function toggleDictation() {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    if (state.recognition) { state.recognition.stop(); return; }
    var rec = new SR();
    rec.lang = 'de-DE';
    rec.interimResults = true;
    rec.continuous = true;
    var base = input.value ? input.value.replace(/\s*$/, ' ') : '';
    rec.onresult = function (e) {
      var finalText = '', interim = '';
      for (var i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalText += e.results[i][0].transcript;
        else interim += e.results[i][0].transcript;
      }
      input.value = base + finalText + interim;
      autosize(); updateSend();
    };
    rec.onerror = function (e) {
      toast(e.error === 'not-allowed' ? 'Mikrofonzugriff verweigert.' : e.error === 'network' ? 'Spracherkennung braucht Internet.' : 'Spracherkennung: ' + e.error);
    };
    rec.onend = function () { state.recognition = null; $('#micBtn').classList.remove('listening'); };
    try {
      rec.start();
      state.recognition = rec;
      $('#micBtn').classList.add('listening');
    } catch (e) { toast('Spracherkennung nicht verfügbar.'); }
  }

  // ======================================================================
  // Ereignisse
  // ======================================================================
  function bind() {
    $('#sbLogo').addEventListener('click', newChat);
    $('#sbClose').addEventListener('click', function () { setSidebarCollapsed(true); });
    $('#sbOpen').addEventListener('click', function () { setSidebarCollapsed(false); });
    $('#sbOpenMobile').addEventListener('click', openMobileSidebar);
    $('#scrim').addEventListener('click', closeMobileSidebar);
    $('#navNew').addEventListener('click', newChat);
    $('#topNew').addEventListener('click', newChat);
    $('#topNewDesk').addEventListener('click', newChat);
    $('#navSearch').addEventListener('click', openSearch);
    $('#navDocs').addEventListener('click', openDocs);
    $('#sbUpgrade').addEventListener('click', openPlans);
    $('#topUpgrade').addEventListener('click', openPlans);
    $('#profileBtn').addEventListener('click', openProfileMenu);
    $('#modelBtn').addEventListener('click', openModelMenu);
    $('#shareBtn').addEventListener('click', function () { exportChat(); });
    $('#plusBtn').addEventListener('click', openPlusMenu);
    $('#canvasChip').addEventListener('click', function () { setCanvasMode(false); });
    $('#micBtn').addEventListener('click', toggleDictation);
    $('#scrollDown').addEventListener('click', function () { stickToBottom = true; thread.scrollTo({ top: thread.scrollHeight, behavior: 'smooth' }); });

    $('#composer').addEventListener('submit', function (e) { e.preventDefault(); sendMessage(); });
    $('#composer').addEventListener('click', function (e) { if (e.target === e.currentTarget) input.focus(); });
    input.addEventListener('input', function () { autosize(); updateSend(); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && state.settings.enterToSend) {
        e.preventDefault();
        if (!state.streaming) sendMessage();
      }
    });
    input.addEventListener('paste', function (e) {
      var files = Array.prototype.slice.call((e.clipboardData && e.clipboardData.files) || []);
      if (files.length) { e.preventDefault(); addFiles(files); }
    });
    $('#attachments').addEventListener('click', function (e) {
      var b = e.target.closest('[data-rm]');
      if (!b) return;
      state.attachments.splice(+b.dataset.rm, 1);
      renderAttachments(); updateSend();
    });
    $('#fileInput').addEventListener('change', function (e) { addFiles(Array.prototype.slice.call(e.target.files)); e.target.value = ''; });
    $('#importInput').addEventListener('change', function (e) { if (e.target.files[0]) importAll(e.target.files[0]); e.target.value = ''; });

    // Drag & Drop
    var comp = $('#composer');
    ['dragenter', 'dragover'].forEach(function (ev) {
      document.addEventListener(ev, function (e) { if (e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types, 'Files') >= 0) { e.preventDefault(); comp.classList.add('drag'); } });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      document.addEventListener(ev, function (e) {
        if (ev === 'dragleave' && e.relatedTarget) return;
        comp.classList.remove('drag');
        if (ev === 'drop' && e.dataTransfer && e.dataTransfer.files.length) { e.preventDefault(); addFiles(Array.prototype.slice.call(e.dataTransfer.files)); }
      });
    });

    thread.addEventListener('scroll', function () { stickToBottom = isNearBottom(); updateScrollBtn(); }, { passive: true });

    // Codeblöcke kopieren
    document.addEventListener('click', function (e) {
      var b = e.target.closest('[data-copy-code]');
      if (!b) return;
      var code = b.closest('.code-block').querySelector('code').textContent;
      copyText(code);
      var span = b.querySelector('span');
      span.textContent = 'Kopiert!';
      setTimeout(function () { span.textContent = 'Kopieren'; }, 1500);
    });

    // Canvas
    $('#cvClose').addEventListener('click', closeCanvas);
    editor.addEventListener('input', onEditorInput);
    editor.addEventListener('keydown', function (e) {
      if (e.key === 'Tab') { e.preventDefault(); document.execCommand('insertText', false, '  '); }
    });
    $('#cvTitle').addEventListener('input', function () {
      var d = getDoc(state.docId); if (!d) return;
      d.title = $('#cvTitle').value || 'Unbenanntes Dokument'; d.updated = Date.now();
      persist('docs'); refreshDocCards(d);
    });
    $$('#cvMode button').forEach(function (b) { b.addEventListener('click', function () { setCvMode(b.dataset.mode); }); });
    $('#cvUndo').addEventListener('click', undoCanvas);
    $('#cvCopy').addEventListener('click', function () { var d = getDoc(state.docId); if (d) copyText(d.content); });
    $('#cvExport').addEventListener('click', function () { exportDocMenu($('#cvExport')); });
    $('#cvAsk').addEventListener('submit', askCanvas);

    // Tastenkürzel
    document.addEventListener('keydown', function (e) {
      var mod = e.ctrlKey || e.metaKey;
      if (e.key === 'Escape') {
        if (activeMenu) { closeMenu(); return; }
        if (closeModal()) return;
        if ($('#app').classList.contains('sb-mobile-open')) { closeMobileSidebar(); return; }
        if (state.streaming) { stopStreaming(); return; }
      }
      if (mod && e.shiftKey && (e.key === 'O' || e.key === 'o')) { e.preventDefault(); newChat(); }
      if (mod && !e.shiftKey && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); openSearch(); }
      if (mod && e.shiftKey && (e.key === 'S' || e.key === 's')) { e.preventDefault(); setSidebarCollapsed(!state.settings.sidebarCollapsed); }
    });

    window.addEventListener('online', renderTopbar);
    window.addEventListener('offline', renderTopbar);
    window.addEventListener('resize', function () { closeMenu(); autosize(); });
    mobileMQ.addEventListener && mobileMQ.addEventListener('change', closeMobileSidebar);

    // Andere Fenster/Tabs synchron halten
    window.addEventListener('storage', function (e) {
      if (!e.key || e.key.indexOf('novachat.') !== 0 || state.streaming) return;
      state.chats = Store.get('chats', []);
      state.docs = Store.get('docs', []);
      state.settings = merge(DEFAULT_SETTINGS, Store.get('settings', {}));
      applyTheme(); renderSidebar(); renderTopbar();
      if (!currentChat()) state.currentId = null;
      renderThread();
    });

    // Android-Zurück-Taste
    if (isNative && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
      window.Capacitor.Plugins.App.addListener('backButton', function () {
        if (activeMenu) return closeMenu();
        if (closeModal()) return;
        if ($('#app').classList.contains('sb-mobile-open')) return closeMobileSidebar();
        if (!$('#canvas').hidden) return closeCanvas();
        if (state.currentId) return newChat();
        window.Capacitor.Plugins.App.exitApp();
      });
    }
  }

  // ======================================================================
  // Start
  // ======================================================================
  function init() {
    // Unterbrochene Antworten aus einer früheren Sitzung aufräumen
    state.chats.forEach(function (c) { c.messages.forEach(function (m) { if (m.pending) { delete m.pending; if (!m.content) m.error = 'Antwort wurde unterbrochen.'; } }); });
    applyTheme();
    paintStatic();
    if (state.settings.sidebarCollapsed) $('#app').classList.add('sb-collapsed');
    bind();
    renderSidebar();
    renderTopbar();
    renderThread();
    updateSend();
    autosize();
    if (!coarse) input.focus();

    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !isNative && location.hostname !== 'localhost') {
      navigator.serviceWorker.register('sw.js').catch(function () { /* optional */ });
    }
  }

  init();
})();
