/* NovaChat – Chat-Kern: Zustand, Verlauf, Senden, Antworten, Canvas */
(function () {
  'use strict';

  var UI = window.UI;
  var $ = UI.$, $$ = UI.$$, el = UI.el, esc = UI.esc, icon = UI.icon, toast = UI.toast;
  var Providers = window.Providers;
  var uid = function () { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); };
  var APP = 'NovaChat';
  var N = window.Nova = { APP: APP };

  // ======================================================================
  // Zustand & Speicher
  // ======================================================================
  var DEFAULT_SETTINGS = {
    theme: 'system',
    userName: '',
    aboutUser: '',
    responseStyle: '',
    enterToSend: !UI.coarse,
    engine: 'auto',
    provider: 'openai',
    openai: { preset: 'openai', baseUrl: 'https://api.openai.com/v1', apiKey: '', model: '', temperature: '', vision: true },
    anthropic: { apiKey: '', model: 'claude-sonnet-5', maxTokens: 8192 },
    apiKeys: {},
    apiModels: {},
    localModel: null,
    local: { gpu: true, temperature: 0.2 },
    memoryEnabled: true,
    memories: [],
    speechRate: 1.0,
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

  function loadSettings() {
    var raw = Store.get('settings', {});
    // Übernahme aus Version 1.0: "mode: offline" -> Offline-KI
    if (raw.mode === 'offline' && !raw.engine) raw.engine = 'local';
    delete raw.mode;
    return merge(DEFAULT_SETTINGS, raw);
  }

  var state = N.state = {
    chats: Store.get('chats', []),
    docs: Store.get('docs', []),
    settings: loadSettings(),
    currentId: null,
    tempChat: null,
    temporary: false,
    attachments: [],
    tool: null,
    streaming: null,
    docId: null,
    cvMode: 'edit',
    dictation: null,
    downloads: {}
  };

  var saveTimers = {};
  function persist(key, now) {
    clearTimeout(saveTimers[key]);
    var run = function () { Store.set(key, state[key]); };
    if (now) run(); else saveTimers[key] = setTimeout(run, 400);
  }
  function saveSettings() { Store.set('settings', state.settings); }

  function currentChat() {
    if (state.tempChat && state.tempChat.id === state.currentId) return state.tempChat;
    return state.chats.find(function (c) { return c.id === state.currentId; }) || null;
  }
  function getDoc(id) { return state.docs.find(function (d) { return d.id === id; }) || null; }
  function saveChat(chat, now) { if (!chat.temp) persist('chats', now); }

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
  if (darkMQ.addEventListener) darkMQ.addEventListener('change', applyTheme);

  function paintStatic() {
    $('#sbLogo').innerHTML = UI.logo(24);
    $('#sbClose').innerHTML = icon('sidebar');
    $('#navNew').innerHTML = icon('compose', 18) + '<span>Neuer Chat</span><span class="kbd">' + (navigator.platform.indexOf('Mac') >= 0 ? '⇧⌘O' : 'Strg+⇧+O') + '</span>';
    $('#navSearch').innerHTML = icon('search', 18) + '<span>Chats suchen</span>';
    $('#navLibrary').innerHTML = icon('library', 18) + '<span>Bibliothek</span>';
    $('#navDocs').innerHTML = icon('doc', 18) + '<span>Dokumente</span>';
    $('#sbOpenMobile').innerHTML = icon('menu', 22);
    $('#sbOpen').innerHTML = icon('sidebar');
    $('#topNewDesk').innerHTML = icon('compose');
    $('#topNew').innerHTML = icon('compose');
    $('#shareBtn').innerHTML = icon('share', 18) + '<span>Teilen</span>';
    $('#tempBtn').innerHTML = icon('temp');
    $('#plusBtn').innerHTML = icon('plus');
    $('#micBtn').innerHTML = icon('mic');
    $('#scrollDown').innerHTML = icon('down', 18);
    $('#cvClose').innerHTML = icon('x');
    $('#cvUndo').innerHTML = icon('undo', 18);
    $('#cvCopy').innerHTML = icon('copy', 18);
    $('#cvExport').innerHTML = icon('download', 18);
    $('#cvAskBtn').innerHTML = icon('up', 18);
    $('#micBtn').hidden = !window.Speech.canListen();
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
    var chats = state.chats.filter(function (c) { return !c.archived; })
      .sort(function (a, b) { return (b.updated || 0) - (a.updated || 0); });
    if (!chats.length) list.appendChild(el('div', { class: 'sb-empty' }, 'Noch keine Chats. Starte einfach eine Unterhaltung.'));
    var groups = [];
    var pinned = chats.filter(function (c) { return c.pinned; });
    if (pinned.length) groups.push({ label: 'Angeheftet', items: pinned, pinned: true });
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
      UI.openMenu(more, [
        { icon: 'share', label: 'Teilen', onClick: function () { N.shareChat(c); } },
        { icon: 'pencil', label: 'Umbenennen', onClick: function () { renameInline(item, c); } },
        { icon: 'pin', label: c.pinned ? 'Loslösen' : 'Anheften', onClick: function () { c.pinned = !c.pinned; persist('chats'); renderSidebar(); } },
        { icon: 'archive', label: 'Archivieren', onClick: function () { archiveChat(c, true); } },
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

  function archiveChat(c, archived) {
    c.archived = archived;
    persist('chats', true);
    if (archived && state.currentId === c.id) newChat();
    else renderSidebar();
    toast(archived ? 'Chat archiviert' : 'Chat wiederhergestellt');
  }

  function confirmDeleteChat(c) {
    UI.confirmDialog({
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
  // Kopfzeile & Modellauswahl
  // ======================================================================
  function renderTopbar() {
    var s = state.settings;
    var engine = Providers.resolve(s);
    $('#modelBtn').innerHTML = '<span>' + APP + '</span>' +
      '<span class="sub">' + esc(Providers.label(s, engine)) + '</span>' + icon('chevron', 16);
    var net = $('#netPill');
    if (!navigator.onLine) { net.hidden = false; net.innerHTML = icon('wifiOff', 14) + '<span>Kein Internet</span>'; }
    else net.hidden = true;
    var tempActive = state.temporary || !!(currentChat() && currentChat().temp);
    $('#tempBtn').classList.toggle('active', tempActive);
    $('#tempBtn').title = tempActive ? 'Temporären Chat beenden' : 'Temporären Chat starten';
    $('#shareBtn').hidden = !currentChat() || !currentChat().messages.length;
    var d = { free: APP + ' kann Fehler machen. Kostenlose Online-KI über Pollinations.ai.',
      custom: APP + ' kann Fehler machen. Überprüfe wichtige Informationen.',
      local: 'Offline-KI auf deinem Gerät. Kleine Modelle machen öfter Fehler.',
      basic: 'Basis-Modus ohne KI: nur einfache Funktionen. Wähle oben eine KI.' };
    $('#disclaimer').textContent = d[engine];
  }

  function openModelMenu() {
    var s = state.settings;
    var active = Providers.resolve(s);
    var customOk = Providers.customConfigured(s);
    var installed = window.LocalAI.installed();
    var providerName = s.provider === 'anthropic' ? 'Anthropic' :
      ((Providers.PRESETS.find(function (p) { return p.id === s.openai.preset; }) || {}).name || 'Eigener Anbieter');
    var items = [
      { header: true, label: 'Modell' },
      {
        icon: 'auto', label: 'Automatisch', desc: window.LocalAI.supported() ? 'Online die beste verfügbare KI, ohne Internet die Offline-KI' : 'Die beste verfügbare Online-KI',
        checked: s.engine === 'auto', onClick: function () { setEngine('auto'); }
      },
      {
        icon: 'globe', label: Providers.FREE.name, desc: 'Kostenlos, ohne Anmeldung · ' + Providers.FREE.detail.split(' · ')[0],
        checked: s.engine === 'free', onClick: function () { setEngine('free'); }
      },
      customOk ? {
        icon: 'key', label: Providers.customLabel(s), desc: 'Eigener API-Schlüssel · ' + providerName,
        checked: s.engine === 'custom', onClick: function () { setEngine('custom'); }
      } : {
        icon: 'key', label: 'Eigenen API-Schlüssel verbinden', desc: 'OpenAI, Gemini, Claude, Mistral, Groq …',
        onClick: function () { N.openSettings('keys'); }
      },
    ];
    var offlineOk = window.LocalAI.supported();
    if (offlineOk) items.push({ header: true, label: 'Offline auf diesem Gerät' });
    var ids = Object.keys(installed);
    ids.forEach(function (id) {
      var m = window.ModelCatalog.get(id);
      if (!m) return;
      items.push({
        icon: 'cpu', label: m.name, desc: m.base + (installed[id].source === 'bundled' ? ' · mitgeliefert' : ''),
        checked: s.engine === 'local' && Providers.localModelId(s) === id,
        onClick: function () { s.localModel = id; setEngine('local'); }
      });
    });
    if (!ids.length && offlineOk) items.push({ icon: 'download', label: 'Offline-KI herunterladen', desc: 'Läuft danach ohne Internet', onClick: function () { N.openSettings('offline'); } });
    items.push(
      { icon: 'offline', label: 'Basis (ohne KI)', desc: 'Rechnen, Umrechnen, Vorlagen', checked: s.engine === 'basic', onClick: function () { setEngine('basic'); } },
      { sep: true },
      { icon: 'gear', label: 'KI-Einstellungen', onClick: function () { N.openSettings('ai'); } }
    );
    if (s.plan === 'free') items.push({ icon: 'sparkles', label: 'Upgrade auf Plus', desc: 'Demo-Abo', onClick: function () { N.openPlans(); } });
    UI.openMenu($('#modelBtn'), items, { align: 'left', width: 320, cls: 'model-menu' });
    if (active !== s.engine && s.engine !== 'auto') {
      toast(active === 'basic' ? 'Diese KI ist gerade nicht verfügbar – es wird der Basis-Modus genutzt.' : 'Gerade aktiv: ' + Providers.label(s, active));
    }
  }

  function setEngine(engine) {
    var s = state.settings;
    s.engine = engine;
    saveSettings();
    renderTopbar();
    var active = Providers.resolve(s);
    if (engine === 'free' && active !== 'free') toast('Kein Internet – solange wird die Offline-KI genutzt.');
    if (engine === 'local' && active === 'basic') { toast('Noch keine Offline-KI installiert.'); N.openSettings('offline'); }
    if (active === 'local') window.LocalAI.load(Providers.localModelId(s), { gpu: s.local.gpu !== false }).catch(function () {});
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
    var temp = state.temporary || (chat && chat.temp);
    $('#main').classList.toggle('is-empty', empty);
    $('#main').classList.toggle('is-temp', !!temp);
    if (empty) {
      if (temp) {
        $('#emptyTitle').textContent = 'Temporärer Chat';
        $('#emptySub').textContent = 'Dieser Chat wird nicht im Verlauf gespeichert und nicht für das Gedächtnis verwendet.';
        $('#emptySub').hidden = false;
      } else {
        var n = state.settings.userName;
        var greet = n ? ['Hallo ' + n + ', womit kann ich helfen?', 'Was steht heute an, ' + n + '?', 'Schön, dich zu sehen, ' + n + '.']
          : ['Womit kann ich helfen?', 'Was steht heute an?', 'Bereit, wenn du es bist.', 'Woran arbeitest du gerade?'];
        $('#emptyTitle').textContent = greet[Math.floor(Math.random() * greet.length)];
        $('#emptySub').hidden = true;
      }
      renderSuggestions();
      renderTopbar();
      $('#scrollDown').hidden = true;
      return;
    }
    chat.messages.forEach(function (m) { box.appendChild(renderMessage(chat, m)); });
    scrollToBottom(true);
    renderTopbar();
  }

  function renderSuggestions() {
    var sugg = [
      { icon: 'image', label: 'Bild erstellen', prompt: '', tool: 'image' },
      { icon: 'doc', label: 'Dokument schreiben', prompt: '', tool: 'canvas' },
      { icon: 'lightbulb', label: 'Ideen sammeln', prompt: 'Gib mir 10 kreative Ideen für ' },
      { icon: 'pencil', label: 'Text verbessern', prompt: 'Verbessere diesen Text:\n\n' },
      { icon: 'code', label: 'Code', prompt: 'Schreibe ein Python-Skript, das ' },
      { icon: 'help', label: 'Erkläre mir', prompt: 'Erkläre mir einfach, wie ' }
    ];
    var box = $('#suggestions');
    box.innerHTML = '';
    sugg.forEach(function (s) {
      var b = el('button', { type: 'button' }, icon(s.icon, 16) + '<span>' + esc(s.label) + '</span>');
      b.addEventListener('click', function () {
        if (s.tool) setTool(s.tool);
        input.value = s.prompt;
        autosize(); updateSend();
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      });
      box.appendChild(b);
    });
  }

  function attachmentHTML(a, removable, idx) {
    var rm = removable ? '<button type="button" class="rm" data-rm="' + idx + '" aria-label="Entfernen">' + icon('x', 12, 3) + '</button>' : '';
    if (a.kind === 'image') return '<div class="img-chip"><img src="' + a.data + '" alt="' + esc(a.name) + '">' + rm + '</div>';
    var ext = (a.name.split('.').pop() || '').toUpperCase().slice(0, 5);
    return '<div class="file-chip"><span class="fi ' + (ext === 'PDF' ? '' : 'doc') + '">' + icon('doc', 18) + '</span>' +
      '<span class="fn"><b>' + esc(a.name) + '</b><small>' + esc(ext || 'Datei') + (a.pages ? ' · ' + a.pages + ' Seiten' : '') + '</small></span>' + rm + '</div>';
  }

  function renderMessage(chat, m) {
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
      ua.appendChild(actionBtn('copy', 'Kopieren', function (b) { UI.copyText(m.content); flashCheck(b, 'copy'); }));
      ua.appendChild(actionBtn('pencil', 'Nachricht bearbeiten', function () { editMessage(chat, m, wrap); }));
      wrap.appendChild(ua);
      return wrap;
    }

    // Assistent
    if (m.memory) {
      wrap.appendChild(el('div', { class: 'memory-chip' }, icon('brain', 15) + '<span>' + (m.memory.type === 'remove' ? 'Erinnerung gelöscht' : 'Erinnerung gespeichert') + '</span>'));
    }
    if (m.reasoning || (m.pending && m.thinking)) {
      var secs = m.reasoningMs ? Math.max(1, Math.round(m.reasoningMs / 1000)) : 0;
      var det = el('details', { class: 'thinking' });
      if (m._thinkOpen) det.open = true;
      det.innerHTML = '<summary>' + (m.pending && !m.content ? '<span class="shimmer">Denkt nach …</span>' : 'Nachgedacht' + (secs ? ' für ' + secs + ' s' : '')) + icon('right', 14) + '</summary>' +
        '<div class="thinking-body"></div>';
      det.querySelector('.thinking-body').textContent = m.reasoning || '';
      det.addEventListener('toggle', function () { m._thinkOpen = det.open; });
      wrap.appendChild(det);
    }
    if (m.pending && m.status) wrap.appendChild(el('div', { class: 'msg-status shimmer' }, esc(m.status)));
    var content = el('div', { class: 'md content' });
    wrap.appendChild(content);
    if (m.docId) {
      content.hidden = true;
      var d = getDoc(m.docId);
      var card = el('button', { class: 'doc-card', type: 'button' },
        '<span class="di">' + icon('doc', 20) + '</span><span><b>' + esc(d ? d.title : 'Dokument (gelöscht)') + '</b><small>' + (m.pending ? 'Wird geschrieben …' : 'Dokument · Zum Öffnen klicken') + '</small></span>');
      card.addEventListener('click', function () { if (d) openCanvas(d.id); else toast('Dieses Dokument wurde gelöscht.'); });
      wrap.appendChild(card);
    } else if (m.pending && !m.content && !m.status && !m.thinking) {
      content.innerHTML = '<span class="typing-dot"></span>';
    } else {
      content.innerHTML = window.Markdown.render(m.content || '');
    }
    if (m.pending && m.images === 'loading') {
      wrap.appendChild(el('div', { class: 'img-skeleton' }, '<span class="shimmer">Bild wird erstellt …</span>'));
    } else if (Array.isArray(m.images) && m.images.length) {
      var grid = el('div', { class: 'gen-images' });
      m.images.forEach(function (im) {
        var fig = el('figure', { class: 'gen-image' }, '<img src="' + esc(im.url) + '" alt="' + esc(im.request || im.prompt) + '" loading="lazy">');
        var dl = el('button', { class: 'img-dl', type: 'button', title: 'Herunterladen', 'aria-label': 'Herunterladen' }, icon('download', 18));
        dl.addEventListener('click', function (e) { e.stopPropagation(); N.downloadImage(im); });
        fig.appendChild(dl);
        fig.querySelector('img').addEventListener('click', function () { N.viewImage(im); });
        grid.appendChild(fig);
      });
      wrap.appendChild(grid);
    }
    if (m.error) {
      var er = el('div', { class: 'msg-error' }, '<b>Fehler:</b> ' + esc(m.error) +
        '<div class="row"><button class="btn small" data-retry>' + icon('refresh', 14) + 'Erneut versuchen</button>' +
        '<button class="btn small" data-offline>' + icon('cpu', 14) + (window.LocalAI.installed() && Object.keys(window.LocalAI.installed()).length ? 'Mit Offline-KI' : 'Ohne KI antworten') + '</button>' +
        '<button class="btn small" data-settings>' + icon('gear', 14) + 'KI-Einstellungen</button></div>');
      er.querySelector('[data-retry]').addEventListener('click', function () { regenerate(chat, m); });
      er.querySelector('[data-settings]').addEventListener('click', function () { N.openSettings('ai'); });
      er.querySelector('[data-offline]').addEventListener('click', function () {
        regenerate(chat, m, { engine: Providers.localModelId(state.settings) ? 'local' : 'basic' });
      });
      wrap.appendChild(er);
    }
    var aa = el('div', { class: 'msg-actions' });
    aa.appendChild(actionBtn('copy', 'Kopieren', function (b) {
      var d2 = m.docId && getDoc(m.docId);
      UI.copyText(d2 ? d2.content : m.content); flashCheck(b, 'copy');
    }));
    var up = actionBtn('thumbUp', 'Gute Antwort', function () { setFeedback(chat, m, 'up'); });
    var down = actionBtn('thumbDown', 'Schlechte Antwort', function () { setFeedback(chat, m, 'down'); });
    if (m.feedback === 'up') up.classList.add('on');
    if (m.feedback === 'down') down.classList.add('on');
    if (m.feedback !== 'down') aa.appendChild(up);
    if (m.feedback !== 'up') aa.appendChild(down);
    if (window.Speech.canSpeak()) aa.appendChild(actionBtn('speaker', 'Vorlesen', function (b) { speakMessage(m, b); }));
    aa.appendChild(actionBtn('refresh', 'Neu generieren', function () { regenerate(chat, m); }));
    if (m.versions && m.versions.length > 1) {
      var nav = el('span', { class: 'versions' });
      var prev = actionBtn('left', 'Vorherige Antwort', function () { switchVersion(chat, m, -1); });
      var next = actionBtn('right', 'Nächste Antwort', function () { switchVersion(chat, m, 1); });
      prev.disabled = (m.vi || 0) === 0;
      next.disabled = (m.vi || 0) >= m.versions.length - 1;
      nav.appendChild(prev);
      nav.appendChild(el('span', null, ((m.vi || 0) + 1) + '/' + m.versions.length));
      nav.appendChild(next);
      aa.appendChild(nav);
    }
    if (m.model) aa.appendChild(el('span', { class: 'meta' }, esc(m.model)));
    wrap.appendChild(aa);
    return wrap;
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

  function setFeedback(chat, m, v) {
    m.feedback = m.feedback === v ? null : v;
    saveChat(chat);
    rerenderMessage(chat, m);
    if (m.feedback) toast('Danke für dein Feedback!');
  }

  function speakMessage(m, btn) {
    if (window.Speech.isSpeaking()) { window.Speech.stopSpeaking(); btn.classList.remove('active'); return; }
    var d = m.docId && getDoc(m.docId);
    btn.classList.add('active');
    window.Speech.speak(d ? d.content : m.content, { rate: state.settings.speechRate }).then(function () { btn.classList.remove('active'); });
  }

  function rerenderMessage(chat, m) {
    var old = document.querySelector('.msg[data-id="' + m.id + '"]');
    if (old && currentChat() === chat) old.replaceWith(renderMessage(chat, m));
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
      saveChat(chat);
      renderThread();
      generate(chat, { task: detectTask(v) });
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
  function newChat(opts) {
    opts = opts || {};
    if (state.streaming) stopStreaming();
    if (opts.temporary != null) state.temporary = opts.temporary;
    else if (!opts.keepTemp) state.temporary = false;
    state.currentId = null;
    state.tempChat = null;
    state.attachments = [];
    setTool(null);
    renderAttachments();
    renderThread();
    renderSidebar();
    closeMobileSidebar();
    if (!UI.coarse) input.focus();
  }

  function openChat(id) {
    if (state.streaming) stopStreaming();
    state.temporary = false;
    state.tempChat = null;
    state.currentId = id;
    renderThread();
    renderSidebar();
  }

  function toggleTemporary() {
    var chat = currentChat();
    var active = state.temporary || (chat && chat.temp);
    newChat({ temporary: !active });
    toast(active ? 'Temporärer Chat beendet' : 'Temporärer Chat – wird nicht gespeichert');
  }

  function ensureChat(firstText) {
    var chat = currentChat();
    if (!chat) {
      chat = { id: uid(), title: makeTitle(firstText), created: Date.now(), updated: Date.now(), messages: [] };
      if (state.temporary) { chat.temp = true; state.tempChat = chat; }
      else state.chats.push(chat);
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
    var empty = !input.value.trim() && !state.attachments.length;
    btn.classList.remove('voice');
    if (state.streaming) {
      btn.disabled = false;
      btn.innerHTML = icon('stop', 18);
      btn.setAttribute('aria-label', 'Stopp'); btn.title = 'Antwort stoppen';
    } else if (empty && window.Speech.canListen()) {
      btn.disabled = false;
      btn.classList.add('voice');
      btn.innerHTML = icon('wave', 18);
      btn.setAttribute('aria-label', 'Sprachmodus'); btn.title = 'Sprachmodus';
    } else {
      btn.disabled = empty;
      btn.innerHTML = icon('up', 20, 2.2);
      btn.setAttribute('aria-label', 'Senden'); btn.title = 'Senden';
    }
  }

  var TOOLS = {
    canvas: { icon: 'canvas', label: 'Canvas', placeholder: 'Beschreibe das Dokument, das ich schreiben soll …' },
    image: { icon: 'image', label: 'Bild', placeholder: 'Beschreibe das Bild …' }
  };
  function setTool(t) {
    state.tool = t;
    var chip = $('#toolChip');
    chip.hidden = !t;
    if (t) chip.innerHTML = '<span class="ic">' + icon(TOOLS[t].icon, 18) + '</span><span class="x">' + icon('x', 18) + '</span><span>' + TOOLS[t].label + '</span>';
    input.placeholder = t ? TOOLS[t].placeholder : 'Frag alles';
  }

  function openPlusMenu() {
    UI.openMenu($('#plusBtn'), [
      { icon: 'clip', label: 'Fotos & Dateien hinzufügen', desc: 'Bilder, PDF, Text- und Code-Dateien', onClick: function () { $('#fileInput').click(); } },
      { sep: true },
      { icon: 'image', label: 'Bild erstellen', desc: 'Kostenlos, braucht Internet', checked: state.tool === 'image', onClick: function () { setTool(state.tool === 'image' ? null : 'image'); input.focus(); } },
      { icon: 'canvas', label: 'Canvas', desc: 'Dokument mit KI schreiben', checked: state.tool === 'canvas', onClick: function () { setTool(state.tool === 'canvas' ? null : 'canvas'); input.focus(); } },
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
  N.readAsText = readAsText;
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

  var pdfjs = null;
  async function readPdf(file) {
    if (!pdfjs) {
      pdfjs = await import(new URL('vendor/pdfjs/pdf.min.js', location.href).href);
      pdfjs.GlobalWorkerOptions.workerSrc = new URL('vendor/pdfjs/pdf.worker.min.js', location.href).href;
    }
    var doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise;
    var n = Math.min(doc.numPages, 80);
    var pages = [];
    for (var i = 1; i <= n; i++) {
      var page = await doc.getPage(i);
      var tc = await page.getTextContent();
      pages.push(tc.items.map(function (it) { return (it.str || '') + (it.hasEOL ? '\n' : ' '); }).join(''));
    }
    var text = pages.join('\n\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    if (doc.numPages > n) text += '\n\n[… nur die ersten ' + n + ' von ' + doc.numPages + ' Seiten gelesen]';
    return { text: text, pages: doc.numPages };
  }

  async function addFiles(files) {
    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      if (state.attachments.length >= 10) { toast('Maximal 10 Dateien pro Nachricht.'); break; }
      try {
        if (/^image\//.test(f.type)) {
          var d = await shrinkImage(await readAsDataURL(f), 1280);
          state.attachments.push({ kind: 'image', name: f.name || 'Bild.jpg', data: d });
        } else if (f.type === 'application/pdf' || /\.pdf$/i.test(f.name)) {
          if (f.size > 30 * 1024 * 1024) { toast(f.name + ': PDF zu groß (max. 30 MB).'); continue; }
          toast('PDF wird gelesen …', 1500);
          var pdf = await readPdf(f);
          if (!pdf.text) toast(f.name + ': Kein Text gefunden (evtl. eingescanntes PDF).');
          state.attachments.push({ kind: pdf.text ? 'text' : 'file', name: f.name, data: pdf.text.slice(0, 300000), pages: pdf.pages });
        } else if (/^text\//.test(f.type) || TEXT_EXT.test(f.name) || /json|xml|javascript/.test(f.type)) {
          if (f.size > 1024 * 1024) { toast(f.name + ': Textdatei zu groß (max. 1 MB).'); continue; }
          state.attachments.push({ kind: 'text', name: f.name, data: await readAsText(f) });
        } else {
          state.attachments.push({ kind: 'file', name: f.name, data: '' });
          toast(f.name + ': Inhalt kann nicht gelesen werden – nur der Dateiname wird gesendet.');
        }
      } catch (e) {
        console.error(e);
        toast('Datei konnte nicht gelesen werden: ' + f.name);
      }
    }
    renderAttachments();
    updateSend();
  }

  function renderAttachments() {
    $('#attachments').innerHTML = state.attachments.map(function (a, i) { return attachmentHTML(a, true, i); }).join('');
  }

  // ======================================================================
  // Gedächtnis
  // ======================================================================
  function cleanMemory(t) {
    t = t.trim().replace(/[.!?\s]+$/, '');
    return t.charAt(0).toUpperCase() + t.slice(1);
  }
  function memoryAction(text) {
    var t = String(text || '').trim();
    var m = /^(?:bitte\s+)?(?:merk(?:e)?\s+dir|speicher(?:e)?(?:\s+dir)?|notier(?:e)?\s+dir|vergiss\s+nicht|remember(?:\s+that)?)\s*[,:]?\s*(?:bitte\s+)?(?:dass\s+)?([\s\S]{3,400})$/i.exec(t);
    if (m) return { type: 'add', text: cleanMemory(m[1]) };
    m = /^(?:bitte\s+)?(?:vergiss|lösche\s+(?:die\s+)?erinnerung)\s*[,:]?\s*(?:dass\s+|was\s+ich\s+(?:über|zu)\s+)?([\s\S]{3,300})$/i.exec(t);
    if (m && !/^nicht\b/i.test(m[1])) return { type: 'remove', text: cleanMemory(m[1]) };
    return null;
  }
  function applyMemory(action) {
    var s = state.settings;
    if (action.type === 'add') {
      var entry = { id: uid(), text: action.text, created: Date.now() };
      s.memories.push(entry);
      saveSettings();
      return { type: 'add', text: action.text, id: entry.id };
    }
    var words = action.text.toLowerCase().split(/\W+/).filter(function (w) { return w.length > 2; });
    var best = null, score = 0;
    s.memories.forEach(function (mem) {
      var lo = mem.text.toLowerCase();
      var sc = words.filter(function (w) { return lo.indexOf(w) >= 0; }).length;
      if (sc > score) { score = sc; best = mem; }
    });
    if (!best) return null;
    s.memories = s.memories.filter(function (x) { return x !== best; });
    saveSettings();
    return { type: 'remove', text: best.text };
  }

  // ======================================================================
  // Senden & Generieren
  // ======================================================================
  var IMAGE_RE = /^(?:bitte\s+)?(?:(?:erstell|generier|zeichne|zeichn|mal|mach|entwirf|kreier|design)\w*\s+(?:mir\s+)?(?:bitte\s+)?(?:ein(?:e|en)?\s+)?(?:[\wäöüß-]+\s+){0,3}?(?:bild|foto|grafik|illustration|zeichnung|gemälde|logo|poster|wallpaper|hintergrundbild|comic)\b|(?:generate|create|draw|make)\s+(?:me\s+)?an?\s+(?:[\w-]+\s+){0,2}?(?:image|picture|photo|drawing|logo)\b)/i;
  function detectTask(text) {
    if (IMAGE_RE.test(String(text || '').trim())) return 'image';
    return null;
  }

  function buildSystemPrompt(task, engine, chat) {
    var s = state.settings;
    var d = new Date();
    var small = engine === 'local';
    var parts = [
      'Du bist ' + APP + ', ein hilfreicher, präziser und freundlicher KI-Assistent.',
      small ? 'Antworte auf Deutsch, außer der Nutzer schreibt in einer anderen Sprache. Nutze Markdown.'
        : 'Antworte in der Sprache des Nutzers (standardmäßig Deutsch). Formatiere mit Markdown, wenn es die Lesbarkeit verbessert. Code immer in Codeblöcken mit Sprachangabe.',
      'Aktuelles Datum: ' + d.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) + '.'
    ];
    if (s.userName) parts.push('Der Nutzer heißt ' + s.userName + '.');
    if (s.aboutUser) parts.push('Informationen über den Nutzer:\n' + s.aboutUser);
    if (s.responseStyle) parts.push('Gewünschter Antwortstil:\n' + s.responseStyle);
    if (s.memoryEnabled && s.memories.length && !(chat && chat.temp)) {
      parts.push('Gespeicherte Erinnerungen über den Nutzer (nutze sie, wenn passend):\n' + s.memories.map(function (m) { return '- ' + m.text; }).join('\n'));
    }
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
      if (m.role === 'assistant' && Array.isArray(m.images) && m.images.length) {
        content = '[Bild erstellt: ' + (m.images[0].request || m.images[0].prompt) + ']' + (content ? '\n\n' + content : '');
      }
      return { role: m.role, content: content, attachments: m.attachments };
    }).filter(function (m) { return m.content || (m.attachments && m.attachments.length); });
  }

  function sendMessage() {
    if (state.streaming) { stopStreaming(); return; }
    var text = input.value.trim();
    if (!text && !state.attachments.length) {
      if (window.Speech.canListen()) N.openVoiceMode();
      return;
    }
    input.value = '';
    autosize();
    var tool = state.tool;
    if (tool) setTool(null);
    sendText(text, { tool: tool });
  }

  /** Nachricht senden (auch vom Sprachmodus genutzt). Gibt die Antwort-Nachricht zurück. */
  function sendText(text, opts) {
    opts = opts || {};
    var chat = ensureChat(text || (state.attachments[0] && state.attachments[0].name));
    chat.messages.push({ id: uid(), role: 'user', content: text, attachments: state.attachments.slice(), time: Date.now() });
    chat.updated = Date.now();
    state.attachments = [];
    renderAttachments();
    renderThread();
    renderSidebar();
    var task = opts.tool === 'canvas' ? 'document' : opts.tool === 'image' ? 'image' : detectTask(text);
    var mem = null;
    if (!chat.temp && state.settings.memoryEnabled && !task) {
      var action = memoryAction(text);
      if (action) mem = applyMemory(action);
    }
    var done = generate(chat, { task: task, memory: mem, voice: opts.voice });
    if (mem && mem.type === 'add') done.then(function () { refineMemory(mem); });
    return done;
  }

  /** Erinnerung wie bei ChatGPT als kurze Notiz formulieren (nur mit Online-KI). */
  async function refineMemory(mem) {
    var s = state.settings;
    var engine = Providers.resolve(s);
    if (engine !== 'free' && engine !== 'custom') return;
    try {
      var out = await Providers.complete(s, 'Formuliere die folgende Information über den Nutzer als kurze, sachliche Notiz in der dritten Person (höchstens 12 Wörter), ohne Anführungszeichen und ohne Einleitung.\nBeispiel: „ich gerne Kaffee trinke“ → Trinkt gerne Kaffee.\n\nInformation: „' + mem.text + '“',
        { engine: engine, timeout: 30000, maxTokens: 300 });
      out = String(out || '').split('\n')[0].replace(/^["'„“»]+|["'“”«]+$/g, '').trim();
      out = out.replace(/[*_`#]/g, '').trim();
      // Plausibilitätsprüfung: kurze Notiz, keine Wiederholung der Anweisung
      if (out.length < 3 || out.length > 140 || out.split(/\s+/).length > 16 || /formulier|information|notiz|nutzer:/i.test(out)) return;
      var entry = s.memories.find(function (m) { return m.id === mem.id; });
      if (entry) { entry.text = out; saveSettings(); }
    } catch (e) { /* Originaltext behalten */ }
  }

  function snapshot(m) {
    return { content: m.content, reasoning: m.reasoning, reasoningMs: m.reasoningMs, docId: m.docId, images: m.images, error: m.error, model: m.model, engine: m.engine, memory: m.memory, feedback: m.feedback };
  }

  function regenerate(chat, m, opts) {
    if (state.streaming) return;
    var idx = chat.messages.indexOf(m);
    if (idx < 0) return;
    var replace = m.error && !m.content;
    if (!replace) {
      if (!m.versions) m.versions = [snapshot(m)];
      else m.versions[m.vi || 0] = snapshot(m);
      m.versions.push({});
      m.vi = m.versions.length - 1;
    }
    chat.messages = chat.messages.slice(0, idx + 1);
    var task = Array.isArray(m.images) ? 'image' : m.docId ? 'document' : null;
    renderThread();
    generate(chat, Object.assign({ target: m, task: task }, opts || {}));
  }

  function switchVersion(chat, m, dir) {
    if (!m.versions || state.streaming) return;
    var n = (m.vi || 0) + dir;
    if (n < 0 || n >= m.versions.length) return;
    m.versions[m.vi || 0] = snapshot(m);
    m.vi = n;
    Object.assign(m, m.versions[n]);
    saveChat(chat);
    rerenderMessage(chat, m);
  }

  function preloadImage(url, signal, timeoutMs) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      var t = setTimeout(function () { img.src = ''; reject(new Error('Die Bilderstellung hat zu lange gedauert. Bitte erneut versuchen.')); }, timeoutMs || 120000);
      img.onload = function () { clearTimeout(t); resolve(); };
      img.onerror = function () { clearTimeout(t); reject(new Error('Das Bild konnte nicht erstellt werden. Bitte später erneut versuchen.')); };
      if (signal) signal.addEventListener('abort', function () { clearTimeout(t); img.src = ''; var e = new Error('abgebrochen'); e.name = 'AbortError'; reject(e); }, { once: true });
      img.src = url;
    });
  }

  async function runImage(msg, request, settings, engine, signal, repaint) {
    if (!navigator.onLine) throw new Error('Bilder erstellen braucht eine Internetverbindung.');
    msg.images = 'loading';
    repaint();
    var prompt = request;
    if (engine === 'free' || engine === 'custom') {
      try {
        var p = await Providers.complete(settings, 'Schreibe einen detaillierten englischen Prompt (höchstens 60 Wörter) für einen KI-Bildgenerator zu folgendem Wunsch. Antworte nur mit dem Prompt, ohne Anführungszeichen und ohne Erklärung.\n\nWunsch: ' + request,
          { engine: engine, timeout: 30000, maxTokens: 400 });
        if (p && p.length > 8) prompt = p.replace(/^["'„“]+|["'“”]+$/g, '').slice(0, 900);
      } catch (e) { /* ursprünglichen Text verwenden */ }
    }
    if (signal.aborted) return;
    var url = Providers.imageUrl(prompt);
    await preloadImage(url, signal, 150000);
    msg.images = [{ url: url, prompt: prompt, request: request, created: Date.now() }];
  }

  async function generate(chat, opts) {
    opts = opts || {};
    var settings = state.settings;
    var engine = opts.engine || Providers.resolve(settings);
    var target = opts.target || null;
    var msg = target || { id: uid(), role: 'assistant', time: Date.now() };
    var idx = target ? chat.messages.indexOf(target) : chat.messages.length;
    var history = historyFor(chat, idx);
    var lastUser = history[history.length - 1] || { content: '' };
    var task = opts.task || null;

    Object.assign(msg, {
      content: '', reasoning: '', reasoningMs: 0, error: null, images: null, docId: null, feedback: null,
      pending: true, status: null, thinking: engine === 'free', engine: engine, model: Providers.label(settings, engine), time: Date.now()
    });
    if (opts.memory) msg.memory = opts.memory;
    if (!target) chat.messages.push(msg);
    chat.updated = Date.now();

    var doc = null;
    if (task === 'document') {
      doc = createDoc(makeTitle(lastUser.content || 'Dokument'), '', { silent: true });
      msg.docId = doc.id;
      msg.thinking = false;
      openCanvas(doc.id);
      setCvMode('edit');
      setCanvasBusy(true, 'KI schreibt …');
    }
    if (task === 'image') msg.thinking = false;

    var box = $('#messages');
    var node = renderMessage(chat, msg);
    var old = box.querySelector('.msg[data-id="' + msg.id + '"]');
    if (old) old.replaceWith(node); else box.appendChild(node);
    $('#main').classList.remove('is-empty');
    stickToBottom = true;
    scrollToBottom(true);

    var controller = new AbortController();
    state.streaming = { controller: controller, chatId: chat.id, msgId: msg.id };
    updateSend();

    var raf = 0;
    function paint() {
      raf = 0;
      if (doc) {
        doc.content = msg.content;
        var t = /^#\s+(.+)$/m.exec(doc.content);
        if (t) doc.title = t[1].trim().slice(0, 100);
        if (state.docId === doc.id) syncCanvasFromDoc(true);
      }
      if (currentChat() === chat) {
        var cur = document.querySelector('.msg[data-id="' + msg.id + '"]');
        if (cur) cur.replaceWith(renderMessage(chat, msg));
      }
      scrollToBottom();
    }
    function schedule() { if (!raf) raf = requestAnimationFrame(paint); }

    var t0 = 0;
    try {
      if (task === 'image') {
        await runImage(msg, lastUser.content, settings, engine, controller.signal, schedule);
      } else if (msg.memory && engine === 'basic') {
        msg.content = msg.memory.type === 'add'
          ? 'Alles klar – das habe ich mir gemerkt: „' + msg.memory.text + '“.'
          : 'Erledigt – diese Erinnerung habe ich gelöscht: „' + msg.memory.text + '“.';
      } else {
        await Providers.stream({
          settings: settings,
          engine: engine,
          messages: history,
          system: buildSystemPrompt(task, engine, chat),
          signal: controller.signal,
          task: task,
          maxTokens: task === 'document' ? 2048 : undefined,
          onDelta: function (d) {
            if (!msg.content && msg.reasoning && !msg.reasoningMs) msg.reasoningMs = Date.now() - t0;
            msg.content += d;
            msg.status = null;
            schedule();
          },
          onReasoning: function (r) {
            if (!t0) t0 = Date.now();
            msg.reasoning += r;
            schedule();
          },
          onStatus: function (st) { msg.status = st; schedule(); }
        });
        if (msg.reasoning && !msg.reasoningMs && t0) msg.reasoningMs = Date.now() - t0;
        if (doc) msg.content = msg.content.replace(/^\s*```(?:markdown|md)?\s*\n([\s\S]*?)\n```\s*$/i, '$1');
      }
    } catch (e) {
      if (e.name !== 'AbortError' && !/abort/i.test(e.name || '')) msg.error = Providers.friendlyError(e);
      if (msg.images === 'loading') msg.images = null;
    } finally {
      if (raf) cancelAnimationFrame(raf);
      delete msg.pending;
      delete msg.status;
      delete msg.thinking;
      if (msg.images === 'loading') msg.images = null;
      if (doc) {
        doc.content = msg.content;
        var tt = /^#\s+(.+)$/m.exec(doc.content);
        if (tt) doc.title = tt[1].trim().slice(0, 100);
        doc.updated = Date.now();
        setCanvasBusy(false, 'Gespeichert');
        if (state.docId === doc.id) syncCanvasFromDoc();
        if (state.docId === doc.id && doc.content.trim()) { setCvMode('preview'); $('#canvas .canvas-body').scrollTop = 0; editor.scrollTop = 0; }
        if (!doc.content.trim()) {
          state.docs = state.docs.filter(function (x) { return x.id !== doc.id; });
          msg.docId = null;
          if (state.docId === doc.id) closeCanvas();
          if (!msg.error) msg.error = 'Es wurde kein Inhalt erzeugt.';
        }
        persist('docs', true);
      }
      if (!msg.content && !msg.error && !msg.docId && !(Array.isArray(msg.images) && msg.images.length) && !controller.signal.aborted) {
        msg.error = 'Es kam keine Antwort. Bitte erneut versuchen.';
      }
      if (msg.versions) msg.versions[msg.vi || 0] = snapshot(msg);
      state.streaming = null;
      chat.updated = Date.now();
      saveChat(chat, true);
      updateSend();
      rerenderMessage(chat, msg);
      renderSidebar();
      renderTopbar();
      scrollToBottom();
    }
    return msg;
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
    while (UI.modalOpen()) UI.closeModal();
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
    var chat = currentChat();
    if (!chat) return;
    $$('.msg').forEach(function (n) {
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
    var engine = Providers.resolve(state.settings);
    if (engine === 'basic') {
      toast('Zum Überarbeiten wird eine KI gebraucht. Wähle oben eine Online- oder Offline-KI.');
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
      await Providers.stream({
        settings: state.settings,
        engine: engine,
        system: buildSystemPrompt('edit-document', engine),
        messages: [{ role: 'user', content: 'Hier ist das aktuelle Dokument:\n\n' + original + '\n\n---\n\nÄnderungswunsch: ' + q }],
        signal: controller.signal,
        task: 'edit-document',
        maxTokens: 2048,
        onStatus: function (st) { if (st) $('#cvStatus').textContent = st; },
        onDelta: function (t) { out += t; d.content = out; syncCanvasFromDoc(true); }
      });
      out = out.replace(/^\s*```(?:markdown|md)?\s*\n([\s\S]*?)\n```\s*$/i, '$1');
      if (!out.trim()) { d.content = original; toast('Keine Änderung erhalten.'); }
      else d.content = out;
      $('#cvStatus').textContent = 'Überarbeitet';
    } catch (err) {
      d.content = original;
      if (err.name !== 'AbortError') toast('Fehler: ' + Providers.friendlyError(err), 5000);
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
    var base = UI.slug(d.title);
    var items = [
      { icon: 'doc', label: 'Markdown (.md)', onClick: function () { UI.saveFile(base + '.md', d.content, 'text/markdown'); } },
      { icon: 'doc', label: 'Text (.txt)', onClick: function () { UI.saveFile(base + '.txt', d.content, 'text/plain'); } },
      { icon: 'doc', label: 'Webseite (.html)', onClick: function () { UI.saveFile(base + '.html', docToHTML(d), 'text/html'); } },
      { icon: 'doc', label: 'Word (.doc)', onClick: function () { UI.saveFile(base + '.doc', docToHTML(d), 'application/msword'); } },
      { icon: 'share', label: 'Teilen', onClick: function () { UI.shareText(d.title, d.content); } }
    ];
    if (!UI.isNative) items.push({ sep: true }, { icon: 'printer', label: 'Drucken / als PDF speichern', onClick: function () { printDoc(d); } });
    UI.openMenu(anchor, items, { align: 'right' });
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
  // Diktieren
  // ======================================================================
  function toggleDictation() {
    if (state.dictation) { state.dictation.stop(); return; }
    var base = input.value ? input.value.replace(/\s*$/, ' ') : '';
    $('#micBtn').classList.add('listening');
    state.dictation = window.Speech.listen({
      continuous: true,
      onPartial: function (t) { input.value = base + t; autosize(); updateSend(); },
      onFinal: function (t) { input.value = base + t; autosize(); updateSend(); },
      onError: function (msg) { toast(msg); },
      onEnd: function () { state.dictation = null; $('#micBtn').classList.remove('listening'); }
    });
  }

  // ======================================================================
  // Ereignisse
  // ======================================================================
  function bind() {
    $('#sbLogo').addEventListener('click', function () { newChat(); });
    $('#sbClose').addEventListener('click', function () { setSidebarCollapsed(true); });
    $('#sbOpen').addEventListener('click', function () { setSidebarCollapsed(false); });
    $('#sbOpenMobile').addEventListener('click', openMobileSidebar);
    $('#scrim').addEventListener('click', closeMobileSidebar);
    $('#navNew').addEventListener('click', function () { newChat(); });
    $('#topNew').addEventListener('click', function () { newChat(); });
    $('#topNewDesk').addEventListener('click', function () { newChat(); });
    $('#navSearch').addEventListener('click', function () { N.openSearch(); });
    $('#navLibrary').addEventListener('click', function () { N.openLibrary(); });
    $('#navDocs').addEventListener('click', function () { N.openDocs(); });
    $('#sbUpgrade').addEventListener('click', function () { N.openPlans(); });
    $('#topUpgrade').addEventListener('click', function () { N.openPlans(); });
    $('#profileBtn').addEventListener('click', function () { N.openProfileMenu(); });
    $('#modelBtn').addEventListener('click', openModelMenu);
    $('#shareBtn').addEventListener('click', function () { N.shareChat(currentChat(), $('#shareBtn')); });
    $('#tempBtn').addEventListener('click', toggleTemporary);
    $('#plusBtn').addEventListener('click', openPlusMenu);
    $('#toolChip').addEventListener('click', function () { setTool(null); });
    $('#micBtn').addEventListener('click', toggleDictation);
    $('#scrollDown').addEventListener('click', function () { stickToBottom = true; thread.scrollTo({ top: thread.scrollHeight, behavior: 'smooth' }); });

    $('#composer').addEventListener('submit', function (e) { e.preventDefault(); sendMessage(); });
    $('#composer').addEventListener('click', function (e) { if (e.target === e.currentTarget) input.focus(); });
    input.addEventListener('input', function () { autosize(); updateSend(); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && state.settings.enterToSend) {
        e.preventDefault();
        if (!state.streaming && (input.value.trim() || state.attachments.length)) sendMessage();
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
    $('#importInput').addEventListener('change', function (e) { if (e.target.files[0]) N.importAll(e.target.files[0]); e.target.value = ''; });

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

    document.addEventListener('click', function (e) {
      var b = e.target.closest('[data-copy-code]');
      if (!b) return;
      UI.copyText(b.closest('.code-block').querySelector('code').textContent);
      var span = b.querySelector('span');
      span.textContent = 'Kopiert!';
      setTimeout(function () { span.textContent = 'Kopieren'; }, 1500);
    });

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
    $('#cvCopy').addEventListener('click', function () { var d = getDoc(state.docId); if (d) UI.copyText(d.content); });
    $('#cvExport').addEventListener('click', function () { exportDocMenu($('#cvExport')); });
    $('#cvAsk').addEventListener('submit', askCanvas);

    document.addEventListener('keydown', function (e) {
      var mod = e.ctrlKey || e.metaKey;
      if (e.key === 'Escape') {
        if (UI.closeMenu()) return;
        if (N.closeVoiceMode && N.closeVoiceMode()) return;
        if (UI.closeModal()) return;
        if ($('#app').classList.contains('sb-mobile-open')) { closeMobileSidebar(); return; }
        if (state.streaming) { stopStreaming(); return; }
      }
      if (mod && e.shiftKey && (e.key === 'O' || e.key === 'o')) { e.preventDefault(); newChat(); }
      if (mod && !e.shiftKey && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); N.openSearch(); }
      if (mod && e.shiftKey && (e.key === 'S' || e.key === 's')) { e.preventDefault(); setSidebarCollapsed(!state.settings.sidebarCollapsed); }
    });

    window.addEventListener('online', renderTopbar);
    window.addEventListener('offline', renderTopbar);
    window.addEventListener('resize', function () { UI.closeMenu(); autosize(); });
    var mobileMQ = window.matchMedia('(max-width: 767px)');
    if (mobileMQ.addEventListener) mobileMQ.addEventListener('change', closeMobileSidebar);

    window.addEventListener('storage', function (e) {
      if (!e.key || e.key.indexOf('novachat.') !== 0 || state.streaming) return;
      state.chats = Store.get('chats', []);
      state.docs = Store.get('docs', []);
      state.settings = loadSettings();
      applyTheme(); renderSidebar(); renderTopbar();
      if (!currentChat()) state.currentId = null;
      renderThread();
    });

    window.LocalAI.onChange(function () { renderTopbar(); });

    if (UI.isNative && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
      window.Capacitor.Plugins.App.addListener('backButton', function () {
        if (UI.closeMenu()) return;
        if (N.closeVoiceMode && N.closeVoiceMode()) return;
        if (UI.closeModal()) return;
        if ($('#app').classList.contains('sb-mobile-open')) return closeMobileSidebar();
        if (!$('#canvas').hidden) return closeCanvas();
        if (state.currentId) return newChat();
        window.Capacitor.Plugins.App.exitApp();
      });
    }
  }

  function init() {
    state.chats.forEach(function (c) {
      c.messages.forEach(function (m) {
        if (m.pending) { delete m.pending; delete m.status; delete m.thinking; if (!m.content) m.error = 'Antwort wurde unterbrochen.'; }
        if (m.images === 'loading') m.images = null;
      });
    });
    applyTheme();
    paintStatic();
    if (state.settings.sidebarCollapsed) $('#app').classList.add('sb-collapsed');
    bind();
    setTool(null);
    renderSidebar();
    renderThread();
    updateSend();
    autosize();
    if (!UI.coarse) input.focus();
    window.LocalAI.refresh().then(renderTopbar);

    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !UI.isNative && location.hostname !== 'localhost') {
      navigator.serviceWorker.register('sw.js').catch(function () { /* optional */ });
    }
  }

  // Für panels.js
  Object.assign(N, {
    persist: persist, saveSettings: saveSettings, currentChat: currentChat, getDoc: getDoc,
    applyTheme: applyTheme, planName: planName, renderSidebar: renderSidebar, renderTopbar: renderTopbar,
    renderThread: renderThread, newChat: newChat, openChat: openChat, archiveChat: archiveChat,
    openCanvas: openCanvas, closeCanvas: closeCanvas, createDoc: createDoc, setCvMode: setCvMode,
    exportDocMenu: exportDocMenu, sendText: sendText, stopStreaming: stopStreaming, setEngine: setEngine,
    closeMobileSidebar: closeMobileSidebar, editorFocus: function () { editor.focus(); },
    init: init
  });
})();
