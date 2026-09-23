/* NovaChat – Fenster & Bereiche: Einstellungen, Offline-KI, API-Schlüssel, Gedächtnis, Archiv,
 * Bibliothek, Suche, Dokumente, Demo-Abo, Teilen, Sprachmodus */
(function () {
  'use strict';

  var UI = window.UI;
  var N = window.Nova;
  var $ = UI.$, $$ = UI.$$, el = UI.el, esc = UI.esc, icon = UI.icon, toast = UI.toast;
  var Providers = window.Providers;
  var Catalog = window.ModelCatalog;
  var state = N.state;
  var APP = N.APP;

  // ======================================================================
  // Kleine Formular-Bausteine
  // ======================================================================
  function row(label, hint, control) {
    var r = el('div', { class: 'set-row' }, '<div class="lbl">' + label + (hint ? '<small>' + hint + '</small>' : '') + '</div>');
    if (control) r.appendChild(control);
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
    var c = el('div', { class: 'set-col' }, label ? '<label>' + label + '</label>' : '');
    if (control) c.appendChild(control);
    if (hint) c.appendChild(el('small', { class: 'hint' }, hint));
    return c;
  }
  function field(value, placeholder, onInput, type) {
    var f = el('input', { class: 'field', type: type || 'text', placeholder: placeholder || '', spellcheck: 'false', autocomplete: 'off' });
    f.value = value || '';
    f.addEventListener('input', function () { onInput(f.value); });
    return f;
  }
  function link(label, url) {
    var a = el('a', { href: url, class: 'ext-link', target: '_blank', rel: 'noopener noreferrer' }, esc(label) + icon('external', 13));
    a.addEventListener('click', function (e) { e.preventDefault(); UI.openExternal(url); });
    return a;
  }

  // ======================================================================
  // Einstellungen
  // ======================================================================
  var settingsPane = null;
  var settingsTab = null;

  function openSettings(tab) {
    N.closeMobileSidebar();
    var tabs = [
      { id: 'general', icon: 'gear', label: 'Allgemein' },
      { id: 'ai', icon: 'sparkles', label: 'KI-Quelle' },
      { id: 'offline', icon: 'cpu', label: 'Offline-KI' },
      { id: 'keys', icon: 'key', label: 'API-Schlüssel' },
      { id: 'personal', icon: 'user', label: 'Personalisierung' },
      { id: 'data', icon: 'database', label: 'Datenkontrollen' },
      { id: 'plan', icon: 'card', label: 'Abo' }
    ];
    if (!window.LocalAI.supported()) tabs = tabs.filter(function (t) { return t.id !== 'offline'; });
    if (tab === 'offline' && !window.LocalAI.supported()) tab = 'ai';
    var body = el('div', { class: 'settings' });
    var nav = el('div', { class: 'settings-nav' });
    var pane = el('div', { class: 'settings-pane' });
    body.appendChild(nav); body.appendChild(pane);
    tabs.forEach(function (t) {
      var b = el('button', { type: 'button', 'data-tab': t.id }, icon(t.icon, 18) + '<span>' + t.label + '</span>');
      b.addEventListener('click', function () { show(t.id); });
      nav.appendChild(b);
    });
    var modal = UI.openModal({
      title: 'Einstellungen', body: body, size: 'wide',
      onClose: function () { settingsPane = null; settingsTab = null; N.renderTopbar(); N.renderSidebar(); }
    });
    modal.style.height = 'min(680px, 90vh)';
    settingsPane = pane;

    function show(id) {
      settingsTab = id;
      $$('button', nav).forEach(function (b) { b.classList.toggle('on', b.dataset.tab === id); });
      var active = nav.querySelector('.on');
      if (active && active.scrollIntoView) active.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      pane.innerHTML = '';
      pane.scrollTop = 0;
      ({ general: tabGeneral, ai: tabAi, offline: tabOffline, keys: tabKeys, personal: tabPersonal, data: tabData, plan: tabPlan })[id](pane, show);
    }
    show(tab || 'general');
  }

  function tabGeneral(pane) {
    var s = state.settings;
    pane.appendChild(row('Design', null, select([['system', 'System'], ['dark', 'Dunkel'], ['light', 'Hell']], s.theme, function (v) { s.theme = v; N.saveSettings(); N.applyTheme(); })));
    pane.appendChild(row('Mit Enter senden', 'Aus: Enter fügt eine neue Zeile ein, gesendet wird mit dem Pfeil.', toggle(s.enterToSend, function (v) { s.enterToSend = v; N.saveSettings(); })));
    if (window.Speech.canSpeak()) {
      pane.appendChild(row('Sprechgeschwindigkeit', 'Für Vorlesen und Sprachmodus', select([['0.8', 'Langsam'], ['1', 'Normal'], ['1.2', 'Schnell'], ['1.4', 'Sehr schnell']], String(s.speechRate || 1), function (v) { s.speechRate = parseFloat(v); N.saveSettings(); })));
    }
    pane.appendChild(row('Temporärer Chat', 'Chats werden nicht gespeichert und nicht fürs Gedächtnis genutzt.', button('Starten', '', function () { UI.closeModal(); N.newChat({ temporary: true }); })));
    pane.appendChild(row('Version', null, el('span', { class: 'muted-small' }, APP + ' 3.0 · ' + (UI.isNative ? 'Android' : UI.isElectron ? 'Desktop' : 'Web'))));
  }

  // ---------- KI-Quelle ----------
  function tabAi(pane, show) {
    var s = state.settings;
    var installed = window.LocalAI.installed();
    var localCount = Object.keys(installed).length;
    var customOk = Providers.customConfigured(s);
    pane.appendChild(el('p', { class: 'pane-intro' }, 'Wähle, welche KI antwortet. Du kannst jederzeit oben über den Modellnamen wechseln.'));
    var opts = [
      { id: 'auto', icon: 'auto', title: 'Automatisch', tag: 'Empfohlen', desc: 'Mit Internet: dein API-Schlüssel oder die kostenlose Online-KI. Ohne Internet: die Offline-KI auf dem Gerät.' },
      { id: 'free', icon: 'globe', title: 'Kostenlose Online-KI', desc: Providers.FREE.name + ' (GPT-OSS 20B) über Pollinations.ai – ohne Anmeldung und ohne Schlüssel. Deine Nachrichten werden an Pollinations.ai gesendet. Verfügbarkeit und Limits bestimmt der Anbieter.' },
      { id: 'custom', icon: 'key', title: 'Eigener API-Schlüssel', desc: customOk ? 'Aktuell: ' + Providers.customLabel(s) : 'Noch nicht eingerichtet – OpenAI, Gemini, Claude, Mistral, Groq, OpenRouter, DeepSeek, xAI, Ollama …', action: ['API-Schlüssel einrichten', 'keys'] },
      { id: 'local', icon: 'cpu', title: 'Offline-KI auf dem Gerät', desc: localCount ? localCount + ' Modell(e) installiert. Läuft komplett ohne Internet, deine Daten verlassen das Gerät nicht.' : 'Noch kein Modell installiert.', action: ['Modelle verwalten', 'offline'] },
      { id: 'basic', icon: 'offline', title: 'Basis (ohne KI)', desc: 'Nur einfache Funktionen: Rechnen, Umrechnen, Datum, Dokumentvorlagen.' }
    ];
    if (!window.LocalAI.supported()) {
      opts = opts.filter(function (o) { return o.id !== 'local'; });
      opts[0].desc = 'Mit Internet: dein API-Schlüssel oder die kostenlose Online-KI. Ohne Internet: Basis-Modus. (Die Offline-KI gibt es in der Computer-Version.)';
    }
    var list = el('div', { class: 'choice-list' });
    opts.forEach(function (o) {
      var c = el('label', { class: 'choice' + (s.engine === o.id ? ' on' : '') },
        '<input type="radio" name="engine" value="' + o.id + '"' + (s.engine === o.id ? ' checked' : '') + '>' +
        '<span class="ch-ic">' + icon(o.icon, 20) + '</span><span class="ch-main"><b>' + esc(o.title) + (o.tag ? ' <span class="tag-small">' + o.tag + '</span>' : '') + '</b><small>' + esc(o.desc) + '</small></span>');
      if (o.action) {
        var b = button(o.action[0], '', function (e) { e.preventDefault(); show(o.action[1]); });
        c.querySelector('.ch-main').appendChild(b);
      }
      c.querySelector('input').addEventListener('change', function () { N.setEngine(o.id); show('ai'); });
      list.appendChild(c);
    });
    pane.appendChild(list);
    var active = Providers.resolve(s);
    pane.appendChild(el('div', { class: 'notice', style: 'margin-top:14px' }, 'Gerade aktiv: <b>' + esc(Providers.label(s, active)) + '</b>' +
      (active !== s.engine && s.engine !== 'auto' ? ' – die gewählte Quelle ist momentan nicht verfügbar.' : '')));
  }

  // ---------- Offline-KI ----------
  var offlineRerender = null;
  function tabOffline(pane, show) {
    var s = state.settings;
    function render() {
      if (settingsTab !== 'offline' || settingsPane !== pane) return;
      pane.innerHTML = '';
      var installed = window.LocalAI.installed();
      var info = window.LocalAI.info();
      pane.appendChild(el('p', { class: 'pane-intro' },
        'Die Offline-KI läuft direkt auf deinem Gerät (llama.cpp). Nach dem Herunterladen funktioniert sie ohne Internet und deine Nachrichten verlassen das Gerät nicht. Größere Modelle antworten besser, brauchen aber mehr Speicher und Zeit.'));
      if (!window.LocalAI.supported()) {
        pane.appendChild(el('div', { class: 'notice' }, 'Dieses Gerät unterstützt die Offline-KI leider nicht (WebAssembly fehlt).'));
        return;
      }
      var status = info.loadedId
        ? 'Geladen: <b>' + esc((Catalog.get(info.loadedId) || {}).name || info.loadedId) + '</b> · ' + (info.gpu ? 'Grafikkarte (WebGPU)' : 'Prozessor') + (info.threads ? ' · ' + info.threads + ' Thread(s)' : '')
        : 'Noch kein Modell geladen – es wird beim ersten Chat automatisch geladen.';
      pane.appendChild(el('div', { class: 'notice' }, status));
      if (!installed['qwen2.5-1.5b'] && installed['qwen2.5-0.5b']) {
        pane.appendChild(el('div', { class: 'notice tip' }, icon('lightbulb', 16) + '<span><b>Tipp:</b> Das mitgelieferte Mini-Modell ist klein und macht öfter Fehler. Für deutlich bessere Offline-Antworten lade einmalig <b>Nova</b> (1,1 GB) herunter.</span>'));
      }

      Catalog.list.forEach(function (m) {
        var inst = installed[m.id];
        var dl = state.downloads[m.id];
        var card = el('div', { class: 'model-card' + (inst && Providers.localModelId(s) === m.id ? ' on' : '') });
        var badges = (m.bundled && inst ? '<span class="tag-small">Mitgeliefert</span>' : '') + (inst && inst.source === 'download' ? '<span class="tag-small ok">Installiert</span>' : '');
        card.innerHTML = '<div class="mc-head"><span class="ch-ic">' + icon('cpu', 20) + '</span><div class="mc-title"><b>' + esc(m.name) + '</b> ' + badges +
          '<small>' + esc(m.base) + ' · ' + Catalog.formatSize(m.bytes) + '</small></div></div><p>' + esc(m.desc) + '</p>';
        var actions = el('div', { class: 'mc-actions' });
        if (dl) {
          var pct = dl.total ? Math.round(dl.loaded / dl.total * 100) : 0;
          actions.appendChild(el('div', { class: 'progress' }, '<span style="width:' + pct + '%"></span>'));
          actions.appendChild(el('span', { class: 'muted-small' }, pct + ' % · ' + Catalog.formatSize(dl.loaded) + ' von ' + Catalog.formatSize(dl.total || m.bytes)));
          actions.appendChild(button('Abbrechen', '', function () { dl.ctrl.abort(); }));
        } else if (inst) {
          var using = Providers.localModelId(s) === m.id;
          actions.appendChild(button(using ? icon('check', 14) + 'Wird verwendet' : 'Verwenden', using ? 'primary' : '', function () {
            s.localModel = m.id; N.saveSettings(); if (s.engine === 'basic') N.setEngine('local'); N.renderTopbar(); render();
          }));
          actions.appendChild(button('Testen', '', function (e) { testLocal(m.id, e.currentTarget); }));
          if (inst.source === 'download') actions.appendChild(button('Löschen', 'danger', function () {
            UI.confirmDialog({ title: 'Modell löschen?', text: '<b>' + esc(m.name) + '</b> (' + Catalog.formatSize(m.bytes) + ') wird vom Gerät entfernt.', ok: 'Löschen', danger: true })
              .then(function (ok) { if (ok) window.LocalAI.remove(m.id).then(render); });
          }));
        } else {
          actions.appendChild(button(icon('download', 14) + 'Herunterladen (' + Catalog.formatSize(m.bytes) + ')', 'primary', function () { startDownload(m); }));
        }
        card.appendChild(actions);
        pane.appendChild(card);
      });

      pane.appendChild(row('Grafikkarte nutzen (WebGPU)', 'Deutlich schneller, wenn verfügbar. Bei Problemen ausschalten.' + (info.webgpu ? '' : ' (Auf diesem Gerät nicht verfügbar – es wird der Prozessor genutzt.)'),
        toggle(s.local.gpu !== false, function (v) { s.local.gpu = v; N.saveSettings(); window.LocalAI.unload(); render(); })));
      pane.appendChild(row('Antwortstil', 'Präzise liefert bei kleinen Modellen die zuverlässigsten Antworten.', select([['0.2', 'Präzise (empfohlen)'], ['0.5', 'Ausgewogen'], ['0.9', 'Kreativ']], String(s.local.temperature != null ? s.local.temperature : 0.2), function (v) { s.local.temperature = parseFloat(v); N.saveSettings(); })));
    }
    offlineRerender = render;
    render();
  }

  function startDownload(m) {
    if (!navigator.onLine) { toast('Zum Herunterladen wird Internet gebraucht.'); return; }
    var ctrl = new AbortController();
    var d = state.downloads[m.id] = { loaded: 0, total: m.bytes, ctrl: ctrl };
    var last = 0;
    if (offlineRerender) offlineRerender();
    window.LocalAI.download(m.id, function (loaded, total) {
      d.loaded = loaded; d.total = total || m.bytes;
      var now = Date.now();
      if (now - last > 400 && offlineRerender) { last = now; offlineRerender(); }
    }, ctrl.signal).then(function () {
      delete state.downloads[m.id];
      toast(m.name + ' ist installiert und funktioniert jetzt offline.');
      if (!state.settings.localModel) { state.settings.localModel = m.id; N.saveSettings(); }
      N.renderTopbar();
      if (offlineRerender) offlineRerender();
    }).catch(function (e) {
      delete state.downloads[m.id];
      if (!ctrl.signal.aborted) toast('Download fehlgeschlagen: ' + (e.message || e), 5000);
      if (offlineRerender) offlineRerender();
    });
  }

  async function testLocal(id, btn) {
    if (state.streaming) { toast('Bitte warte, bis die aktuelle Antwort fertig ist.'); return; }
    var orig = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Lädt …';
    var out = '', n = 0, t0 = 0;
    try {
      await window.LocalAI.chat({
        modelId: id, messages: [{ role: 'user', content: 'Stell dich in einem Satz vor.' }], system: 'Du bist ' + APP + '. Antworte auf Deutsch, kurz.',
        maxTokens: 60, gpu: state.settings.local.gpu !== false,
        onStatus: function (st) { if (st) btn.innerHTML = '<span class="spinner"></span> ' + esc(st.replace(' …', '')); },
        onDelta: function (d) { if (!t0) t0 = performance.now(); out += d; n++; btn.innerHTML = '<span class="spinner"></span> Antwortet …'; }
      });
      var secs = t0 ? (performance.now() - t0) / 1000 : 0;
      var speed = secs > 0 ? (n / secs).toFixed(1).replace('.', ',') : '–';
      UI.confirmDialog({ title: 'Offline-KI funktioniert', text: '„' + esc(out.trim()) + '“<br><br><small>Geschwindigkeit: ca. ' + speed + ' Token/s</small>', ok: 'OK', cancel: 'Schließen' });
    } catch (e) {
      toast('Fehler: ' + (e.message || e), 6000);
    } finally {
      btn.disabled = false;
      btn.innerHTML = orig;
      if (offlineRerender) offlineRerender();
    }
  }

  // ---------- API-Schlüssel ----------
  function currentPresetId(s) {
    return s.provider === 'anthropic' ? 'anthropic' : (s.openai.preset || 'custom');
  }
  function switchPreset(s, id) {
    var cur = currentPresetId(s);
    if (cur === 'anthropic') { s.apiKeys.anthropic = s.anthropic.apiKey; s.apiModels.anthropic = s.anthropic.model; }
    else {
      s.apiKeys[cur] = s.openai.apiKey; s.apiModels[cur] = s.openai.model;
      if (cur === 'custom') s.apiModels._customUrl = s.openai.baseUrl;
    }
    if (id === 'anthropic') {
      s.provider = 'anthropic';
      s.anthropic.apiKey = s.apiKeys.anthropic || s.anthropic.apiKey || '';
      s.anthropic.model = s.apiModels.anthropic || s.anthropic.model || 'claude-sonnet-5';
    } else {
      var p = Providers.PRESETS.find(function (x) { return x.id === id; });
      s.provider = 'openai';
      s.openai.preset = id;
      s.openai.baseUrl = p ? p.baseUrl : (s.apiModels._customUrl || '');
      s.openai.apiKey = s.apiKeys[id] || '';
      s.openai.model = s.apiModels[id] || '';
    }
    N.saveSettings();
  }

  function tabKeys(pane, show) {
    var s = state.settings;
    pane.appendChild(el('p', { class: 'pane-intro' }, 'Verbinde deinen eigenen KI-Anbieter. Der Schlüssel wird <b>nur auf diesem Gerät</b> gespeichert und direkt an den Anbieter gesendet. Kosten rechnet der Anbieter mit dir ab.'));
    var presetId = currentPresetId(s);
    var opts = Providers.PRESETS.map(function (p) { return [p.id, p.name]; });
    opts.splice(1, 0, ['anthropic', 'Anthropic (Claude)']);
    opts.push(['custom', 'Andere (eigene Adresse)']);
    pane.appendChild(row('Anbieter', null, select(opts, presetId, function (v) { switchPreset(s, v); show('keys'); })));
    var preset = Providers.PRESETS.find(function (p) { return p.id === presetId; });
    var status = el('div', { class: 'status-line' });
    var modelInput, modelList = el('datalist', { id: 'modelOptions' });

    if (presetId === 'anthropic') {
      var kc = col('API-Schlüssel', field(s.anthropic.apiKey, 'sk-ant-…', function (v) { s.anthropic.apiKey = v.trim(); N.saveSettings(); }, 'password'));
      kc.appendChild(link('Schlüssel erstellen', 'https://console.anthropic.com/settings/keys'));
      pane.appendChild(kc);
      modelInput = field(s.anthropic.model, 'z. B. claude-sonnet-5', function (v) { s.anthropic.model = v.trim(); N.saveSettings(); });
    } else {
      var local = preset && preset.local;
      var urlF = field(s.openai.baseUrl, 'https://…/v1', function (v) { s.openai.baseUrl = v.trim(); N.saveSettings(); });
      if (!preset || local) {
        pane.appendChild(col('Adresse (Basis-URL)', urlF, local
          ? 'Das Programm muss auf diesem Computer laufen. Vom Handy aus: statt „localhost“ die IP-Adresse des PCs im WLAN eintragen (Ollama dafür mit OLLAMA_HOST=0.0.0.0 starten).'
          : 'OpenAI-kompatible Adresse, endet meist auf /v1.'));
      }
      if (!local) {
        var kc2 = col('API-Schlüssel', field(s.openai.apiKey, 'Schlüssel einfügen', function (v) { s.openai.apiKey = v.trim(); N.saveSettings(); }, 'password'));
        if (preset && preset.keyUrl) kc2.appendChild(link('Schlüssel erstellen', preset.keyUrl));
        pane.appendChild(kc2);
      } else {
        var dlc = col('', null);
        dlc.appendChild(link(preset.name.replace(' (lokal)', '') + ' herunterladen', preset.keyUrl));
        pane.appendChild(dlc);
      }
      if (preset && !local) {
        var adv = el('details', { class: 'adv' }, '<summary>Erweitert: Adresse ändern</summary>');
        adv.appendChild(col('Basis-URL', urlF));
        pane.appendChild(adv);
      }
      modelInput = field(s.openai.model, 'Modellname – am einfachsten über „Modelle laden“', function (v) { s.openai.model = v.trim(); N.saveSettings(); });
    }
    modelInput.setAttribute('list', 'modelOptions');
    var mwrap = el('div', { class: 'input-with-btn' });
    mwrap.appendChild(modelInput);
    mwrap.appendChild(button('Modelle laden', '', async function () {
      status.className = 'status-line'; status.textContent = 'Lade Modelle …';
      try {
        var models = await Providers.listModels(s);
        modelList.innerHTML = models.map(function (m) { return '<option value="' + esc(m) + '">'; }).join('');
        status.className = 'status-line ok';
        status.textContent = models.length + ' Modelle gefunden – ins Feld tippen, um eins auszuwählen.';
        if (!modelInput.value && models.length) { modelInput.value = models[0]; modelInput.dispatchEvent(new Event('input')); }
      } catch (e) { status.className = 'status-line err'; status.textContent = Providers.friendlyError(e); }
    }));
    var mcol = col('Modell', mwrap);
    mcol.appendChild(modelList);
    pane.appendChild(mcol);

    var test = el('div', { class: 'set-col btn-row' });
    test.appendChild(button(icon('check', 14) + 'Verbindung testen', 'primary', async function () {
      if (!Providers.customConfigured(s)) { status.className = 'status-line err'; status.textContent = 'Bitte Schlüssel und Modell ausfüllen.'; return; }
      status.className = 'status-line'; status.textContent = 'Teste …';
      var out = '';
      try {
        await Providers.stream({ settings: s, engine: 'custom', messages: [{ role: 'user', content: 'Antworte nur mit: OK' }], system: 'Antworte extrem kurz.', maxTokens: 20, onDelta: function (d) { out += d; } });
        status.className = 'status-line ok';
        status.textContent = 'Verbindung funktioniert ✓ Antwort: „' + out.trim().slice(0, 60) + '“';
      } catch (e) { status.className = 'status-line err'; status.textContent = Providers.friendlyError(e); }
    }));
    test.appendChild(button('Als KI verwenden', '', function () {
      if (!Providers.customConfigured(s)) { toast('Bitte zuerst Schlüssel und Modell eintragen.'); return; }
      N.setEngine('custom'); toast('Eigener API-Schlüssel ist jetzt aktiv.');
    }));
    test.appendChild(status);
    pane.appendChild(test);
  }

  // ---------- Personalisierung & Gedächtnis ----------
  function tabPersonal(pane, show) {
    var s = state.settings;
    pane.appendChild(col('Wie soll ' + APP + ' dich nennen?', field(s.userName, 'Dein Name', function (v) { s.userName = v.trim(); N.saveSettings(); })));
    var about = el('textarea', { class: 'field', placeholder: 'z. B. Beruf, Interessen, Wohnort …' });
    about.value = s.aboutUser;
    about.addEventListener('input', function () { s.aboutUser = about.value; N.saveSettings(); });
    pane.appendChild(col('Was soll ' + APP + ' über dich wissen?', about));
    var style = el('textarea', { class: 'field', placeholder: 'z. B. kurz und direkt, mit Beispielen, per Du …' });
    style.value = s.responseStyle;
    style.addEventListener('input', function () { s.responseStyle = style.value; N.saveSettings(); });
    pane.appendChild(col('Wie soll ' + APP + ' antworten?', style, 'Diese Angaben werden bei jeder Anfrage an die KI mitgeschickt.'));

    pane.appendChild(el('h3', { class: 'pane-h' }, icon('brain', 18) + 'Gedächtnis'));
    pane.appendChild(row('Gespeicherte Erinnerungen verwenden', 'Sag z. B. „Merk dir, dass ich Vegetarier bin“ oder „Vergiss meinen Wohnort“.', toggle(s.memoryEnabled, function (v) { s.memoryEnabled = v; N.saveSettings(); })));
    var list = el('div', { class: 'memory-list' });
    if (!s.memories.length) list.appendChild(el('div', { class: 'list-empty small' }, 'Noch keine Erinnerungen gespeichert.'));
    s.memories.forEach(function (m) {
      var r = el('div', { class: 'memory-item' }, '<span>' + esc(m.text) + '</span>');
      var del = el('button', { class: 'icon-btn', title: 'Löschen', 'aria-label': 'Löschen' }, icon('trash', 16));
      del.addEventListener('click', function () { s.memories = s.memories.filter(function (x) { return x !== m; }); N.saveSettings(); show('personal'); });
      r.appendChild(del);
      list.appendChild(r);
    });
    pane.appendChild(list);
    var addWrap = el('div', { class: 'input-with-btn' });
    var addF = field('', 'Neue Erinnerung hinzufügen …', function () {});
    addWrap.appendChild(addF);
    addWrap.appendChild(button('Hinzufügen', '', function () {
      var t = addF.value.trim(); if (!t) return;
      s.memories.push({ id: Date.now().toString(36), text: t, created: Date.now() }); N.saveSettings(); show('personal');
    }));
    pane.appendChild(col('', addWrap));
    if (s.memories.length) pane.appendChild(row('Alle Erinnerungen löschen', null, button('Alle löschen', 'danger', function () {
      UI.confirmDialog({ title: 'Alle Erinnerungen löschen?', text: s.memories.length + ' Erinnerungen werden gelöscht.', ok: 'Löschen', danger: true }).then(function (ok) {
        if (ok) { s.memories = []; N.saveSettings(); show('personal'); }
      });
    })));
  }

  // ---------- Daten ----------
  function tabData(pane, show) {
    var archived = state.chats.filter(function (c) { return c.archived; });
    pane.appendChild(row('Archivierte Chats', archived.length + ' archiviert', button('Verwalten', '', openArchive)));
    pane.appendChild(row('Alle Chats archivieren', null, button('Alle archivieren', '', function () {
      UI.confirmDialog({ title: 'Alle Chats archivieren?', text: 'Die Chats verschwinden aus der Seitenleiste und bleiben unter „Archivierte Chats“ erhalten.', ok: 'Archivieren' }).then(function (ok) {
        if (!ok) return;
        state.chats.forEach(function (c) { c.archived = true; }); N.persist('chats', true); N.newChat(); show('data');
      });
    })));
    pane.appendChild(row('Daten exportieren', 'Chats, Dokumente, Erinnerungen und Einstellungen (ohne API-Schlüssel) als JSON-Datei.', button('Exportieren', '', exportAll)));
    pane.appendChild(row('Daten importieren', 'Eine zuvor exportierte Datei einlesen. Vorhandenes bleibt erhalten.', button('Importieren', '', function () { $('#importInput').click(); })));
    pane.appendChild(row('Alle Chats löschen', state.chats.length + ' Chats', button('Löschen', 'danger', deleteAllChats)));
    pane.appendChild(row('Alle Dokumente löschen', state.docs.length + ' Dokumente', button('Löschen', 'danger', function () {
      UI.confirmDialog({ title: 'Alle Dokumente löschen?', text: 'Alle ' + state.docs.length + ' Dokumente werden dauerhaft gelöscht.', ok: 'Löschen', danger: true }).then(function (ok) {
        if (!ok) return;
        state.docs = []; N.persist('docs', true); N.closeCanvas(); show('data'); toast('Dokumente gelöscht');
      });
    })));
    var used = 0;
    try { for (var k in localStorage) if (k.indexOf('novachat.') === 0) used += (localStorage.getItem(k) || '').length; } catch (e) { /* ignorieren */ }
    var usage = el('span', { class: 'muted-small' }, (used / 1024).toFixed(0) + ' KB Chats & Einstellungen');
    pane.appendChild(row('Speicher', 'Alle Daten liegen nur lokal auf diesem Gerät.', usage));
    if (navigator.storage && navigator.storage.estimate) {
      navigator.storage.estimate().then(function (e) { usage.textContent += ' · ' + Catalog.formatSize(e.usage || 0) + ' gesamt (inkl. Offline-Modelle)'; });
    }
  }

  function tabPlan(pane, show) {
    var s = state.settings;
    var paid = s.plan !== 'free';
    pane.appendChild(row('Aktueller Plan', paid && s.planSince ? 'Seit ' + new Date(s.planSince).toLocaleDateString('de-DE') + ' · Demo-Abo, es wird nichts berechnet' : 'Kostenlos',
      el('span', { class: 'plan-badge', style: 'font-size:13px;padding:3px 10px' }, N.planName(s.plan))));
    pane.appendChild(row(paid ? 'Plan ändern' : 'Upgrade', 'Plus und Pro sind in dieser App Demo-Abos ohne Zahlung.', button(paid ? 'Pläne ansehen' : 'Upgrade', 'primary', function () { UI.closeModal(); openPlans(); })));
    if (paid) pane.appendChild(row('Abo kündigen', 'Wechselt sofort zurück zu Free.', button('Kündigen', 'danger', function () {
      UI.confirmDialog({ title: 'Abo kündigen?', text: 'Dein ' + N.planName(s.plan) + '-Demo-Abo wird beendet.', ok: 'Kündigen', danger: true }).then(function (ok) {
        if (!ok) return;
        s.plan = 'free'; s.planSince = null; N.saveSettings(); N.renderSidebar(); N.renderTopbar(); show('plan'); toast('Abo gekündigt');
      });
    })));
  }

  function deleteAllChats() {
    UI.confirmDialog({ title: 'Alle Chats löschen?', text: 'Alle ' + state.chats.length + ' Chats werden dauerhaft gelöscht.', ok: 'Alle löschen', danger: true }).then(function (ok) {
      if (!ok) return;
      N.stopStreaming();
      state.chats = []; N.persist('chats', true);
      UI.closeModal();
      N.newChat();
      toast('Alle Chats gelöscht');
    });
  }

  function openArchive() {
    var body = el('div', { class: 'result-list', style: 'min-height:200px' });
    function render() {
      body.innerHTML = '';
      var list = state.chats.filter(function (c) { return c.archived; }).sort(function (a, b) { return b.updated - a.updated; });
      if (!list.length) { body.appendChild(el('div', { class: 'list-empty' }, 'Keine archivierten Chats.')); return; }
      list.forEach(function (c) {
        var r = el('div', { class: 'result' }, icon('archive', 18) + '<span class="r-main"><b>' + esc(c.title) + '</b><small>' + new Date(c.updated).toLocaleDateString('de-DE') + '</small></span>');
        r.appendChild(button('Öffnen', '', function () { c.archived = false; N.persist('chats', true); while (UI.modalOpen()) UI.closeModal(); N.openChat(c.id); }));
        r.appendChild(button('Wiederherstellen', '', function () { c.archived = false; N.persist('chats', true); N.renderSidebar(); render(); }));
        var del = el('button', { class: 'icon-btn', title: 'Löschen', 'aria-label': 'Löschen' }, icon('trash', 16));
        del.addEventListener('click', function () { state.chats = state.chats.filter(function (x) { return x !== c; }); N.persist('chats', true); render(); });
        r.appendChild(del);
        body.appendChild(r);
      });
    }
    render();
    UI.openModal({ title: 'Archivierte Chats', body: body, size: 'wide' });
  }

  function exportAll() {
    var s = JSON.parse(JSON.stringify(state.settings));
    s.openai.apiKey = ''; s.anthropic.apiKey = ''; s.apiKeys = {};
    var data = { app: APP, version: 2, exported: new Date().toISOString(), chats: state.chats, docs: state.docs, settings: s };
    UI.saveFile('novachat-export-' + new Date().toISOString().slice(0, 10) + '.json', JSON.stringify(data, null, 2), 'application/json');
  }

  async function importAll(file) {
    try {
      var data = JSON.parse(await N.readAsText(file));
      if (!data || !Array.isArray(data.chats)) throw new Error('Ungültiges Format');
      var ids = new Set(state.chats.map(function (c) { return c.id; }));
      var n = 0;
      data.chats.forEach(function (c) { if (c && c.id && Array.isArray(c.messages) && !ids.has(c.id)) { state.chats.push(c); n++; } });
      var dids = new Set(state.docs.map(function (d) { return d.id; }));
      var nd = 0;
      (data.docs || []).forEach(function (d) { if (d && d.id && !dids.has(d.id)) { state.docs.push(d); nd++; } });
      if (data.settings && Array.isArray(data.settings.memories)) {
        var known = new Set(state.settings.memories.map(function (m) { return m.text; }));
        data.settings.memories.forEach(function (m) { if (m && m.text && !known.has(m.text)) state.settings.memories.push(m); });
        N.saveSettings();
      }
      N.persist('chats', true); N.persist('docs', true);
      N.renderSidebar();
      toast(n + ' Chats und ' + nd + ' Dokumente importiert');
    } catch (e) { toast('Import fehlgeschlagen: ' + e.message); }
  }

  // ======================================================================
  // Teilen & Export
  // ======================================================================
  function chatMarkdown(c) {
    var md = '# ' + c.title + '\n\n_' + new Date(c.created).toLocaleString('de-DE') + '_\n\n';
    c.messages.forEach(function (m) {
      var content = m.content;
      if (m.docId) { var d = N.getDoc(m.docId); if (d) content = d.content; }
      if (Array.isArray(m.images)) content = m.images.map(function (im) { return '![' + (im.request || '') + '](' + im.url + ')'; }).join('\n') + (content ? '\n\n' + content : '');
      md += '### ' + (m.role === 'user' ? (state.settings.userName || 'Du') : APP) + '\n\n' + (content || '') + '\n\n';
    });
    return md;
  }
  function shareChat(c, anchor) {
    if (!c || !c.messages.length) { toast('Dieser Chat ist noch leer.'); return; }
    var items = [
      { icon: 'share', label: 'Teilen …', desc: 'Über andere Apps senden', onClick: function () { UI.shareText(c.title, chatMarkdown(c)); } },
      { icon: 'copy', label: 'Als Text kopieren', onClick: function () { UI.copyText(chatMarkdown(c)); } },
      { icon: 'download', label: 'Als Markdown speichern', onClick: function () { UI.saveFile(UI.slug(c.title) + '.md', chatMarkdown(c), 'text/markdown'); } }
    ];
    if (anchor) { UI.openMenu(anchor, items, { align: 'right' }); return; }
    var body = el('div', { class: 'modal-body share-list' });
    items.forEach(function (it) {
      var b = el('button', { class: 'result', type: 'button' }, icon(it.icon, 18) + '<span class="r-main"><b>' + esc(it.label) + '</b>' + (it.desc ? '<small>' + esc(it.desc) + '</small>' : '') + '</span>');
      b.addEventListener('click', function () { UI.closeModal(); it.onClick(); });
      body.appendChild(b);
    });
    UI.openModal({ title: 'Chat teilen', body: body });
  }

  // ======================================================================
  // Bibliothek (erstellte Bilder)
  // ======================================================================
  function allImages() {
    var out = [];
    state.chats.forEach(function (c) {
      c.messages.forEach(function (m) {
        var sets = [m.images].concat((m.versions || []).map(function (v) { return v.images; }));
        sets.forEach(function (arr) {
          if (Array.isArray(arr)) arr.forEach(function (im) { if (!out.some(function (o) { return o.im.url === im.url; })) out.push({ im: im, chat: c }); });
        });
      });
    });
    return out.sort(function (a, b) { return (b.im.created || 0) - (a.im.created || 0); });
  }

  function openLibrary() {
    N.closeMobileSidebar();
    var body = el('div', { class: 'modal-body' });
    var list = allImages();
    if (!list.length) {
      body.innerHTML = '<div class="list-empty">Noch keine Bilder. Wähle im Chat <b>+ → Bild erstellen</b> oder schreibe z. B. „Erstelle ein Bild von einem Leuchtturm bei Sonnenuntergang“.</div>';
    } else {
      var grid = el('div', { class: 'library-grid' });
      list.forEach(function (x) {
        var fig = el('button', { class: 'lib-item', type: 'button', title: x.im.request || x.im.prompt }, '<img src="' + esc(x.im.url) + '" alt="" loading="lazy">');
        fig.addEventListener('click', function () { viewImage(x.im, x.chat); });
        grid.appendChild(fig);
      });
      body.appendChild(grid);
    }
    UI.openModal({ title: 'Bibliothek', body: body, size: 'full' });
  }

  function viewImage(im, chat) {
    var body = el('div', { class: 'image-view' }, '<img src="' + esc(im.url) + '" alt=""><p>' + esc(im.request || im.prompt || '') + '</p>');
    var row2 = el('div', { class: 'btn-row' });
    row2.appendChild(button(icon('download', 14) + 'Herunterladen', 'primary', function () { downloadImage(im); }));
    row2.appendChild(button(icon('copy', 14) + 'Prompt kopieren', '', function () { UI.copyText(im.prompt || im.request || ''); }));
    if (chat) row2.appendChild(button('Zum Chat', '', function () { while (UI.modalOpen()) UI.closeModal(); N.openChat(chat.id); }));
    body.appendChild(row2);
    UI.openModal({ title: false, body: body, size: 'wide' });
  }

  async function downloadImage(im) {
    try {
      var r = await fetch(im.url);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      var blob = await r.blob();
      await UI.saveFile('nova-bild-' + new Date(im.created || Date.now()).toISOString().slice(0, 19).replace(/[:T]/g, '-') + '.jpg', blob, blob.type);
    } catch (e) {
      UI.openExternal(im.url);
    }
  }

  // ======================================================================
  // Suche
  // ======================================================================
  function openSearch() {
    N.closeMobileSidebar();
    var body = el('div', { style: 'display:flex;flex-direction:column;min-height:0;flex:1' });
    body.innerHTML = '<div class="search-input">' + icon('search') + '<input placeholder="Chats durchsuchen …" aria-label="Suche"></div><div class="result-list"></div>';
    var modal = UI.openModal({ title: false, body: body, size: 'wide' });
    modal.style.height = 'min(560px, 80vh)';
    var q = body.querySelector('input'), list = body.querySelector('.result-list');
    var sel = 0;
    function hl(text, term) {
      if (!term) return esc(text);
      var i = text.toLowerCase().indexOf(term.toLowerCase());
      if (i < 0) return esc(text);
      return esc(text.slice(0, i)) + '<mark>' + esc(text.slice(i, i + term.length)) + '</mark>' + esc(text.slice(i + term.length));
    }
    function run() {
      var term = q.value.trim();
      var lo = term.toLowerCase();
      list.innerHTML = '';
      if (!term) {
        var nb = el('button', { class: 'result' }, icon('compose', 18) + '<span class="r-main"><b>Neuer Chat</b></span>');
        nb.addEventListener('click', function () { UI.closeModal(); N.newChat(); });
        list.appendChild(nb);
      }
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
        var b = el('button', { class: 'result' }, icon(c.archived ? 'archive' : 'compose', 18) + '<span class="r-main"><b>' + hl(c.title || 'Neuer Chat', term) + '</b><small>' + hl(snippet, term) + '</small></span>');
        b.addEventListener('click', function () { UI.closeModal(); if (c.archived) { c.archived = false; N.persist('chats', true); } N.openChat(c.id); });
        list.appendChild(b);
      });
      if (lo) state.docs.forEach(function (d) {
        if ((d.title + ' ' + d.content).toLowerCase().indexOf(lo) < 0) return;
        var b = el('button', { class: 'result' }, icon('doc', 18) + '<span class="r-main"><b>' + hl(d.title, term) + '</b><small>Dokument</small></span>');
        b.addEventListener('click', function () { UI.closeModal(); N.openCanvas(d.id); });
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

  // ======================================================================
  // Dokumente
  // ======================================================================
  function openDocs() {
    N.closeMobileSidebar();
    var body = el('div', { style: 'display:flex;flex-direction:column;min-height:0' });
    var top = el('div', { class: 'search-input' }, icon('search') + '<input placeholder="Dokumente durchsuchen …">');
    var nb = el('button', { class: 'btn small primary' }, icon('plus', 16) + 'Neu');
    top.appendChild(nb);
    var list = el('div', { class: 'result-list' });
    body.appendChild(top); body.appendChild(list);
    UI.openModal({ title: 'Dokumente', body: body, size: 'wide' });
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
        var r = el('div', { class: 'result', role: 'button', tabindex: '0' },
          icon('doc', 18) + '<span class="r-main"><b>' + esc(d.title) + '</b><small>' +
          new Date(d.updated).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' }) + ' · ' + words + ' Wörter</small></span>');
        var more = el('button', { class: 'icon-btn r-act', 'aria-label': 'Optionen' }, icon('more', 18));
        more.addEventListener('click', function (e) {
          e.stopPropagation();
          UI.openMenu(more, [
            { icon: 'download', label: 'Exportieren …', onClick: function () { N.exportDocMenu(more, d); } },
            { icon: 'copy', label: 'Duplizieren', onClick: function () { N.createDoc(d.title + ' (Kopie)', d.content, { silent: true }); run(); } },
            { sep: true },
            {
              icon: 'trash', label: 'Löschen', danger: true, onClick: function () {
                UI.confirmDialog({ title: 'Dokument löschen?', text: '<b>' + esc(d.title) + '</b> wird dauerhaft gelöscht.', ok: 'Löschen', danger: true }).then(function (ok) {
                  if (!ok) return;
                  state.docs = state.docs.filter(function (x) { return x.id !== d.id; });
                  N.persist('docs', true);
                  if (state.docId === d.id) N.closeCanvas();
                  run();
                });
              }
            }
          ], { align: 'right' });
        });
        r.appendChild(more);
        r.addEventListener('click', function () { N.openCanvas(d.id); });
        r.addEventListener('keydown', function (e) { if (e.key === 'Enter') N.openCanvas(d.id); });
        list.appendChild(r);
      });
    }
    q.addEventListener('input', run);
    nb.addEventListener('click', function () { N.createDoc('Unbenanntes Dokument', ''); N.setCvMode('edit'); setTimeout(N.editorFocus, 50); });
    run();
  }

  // ======================================================================
  // Profilmenü & Hilfe
  // ======================================================================
  function openProfileMenu() {
    var s = state.settings;
    var dark = document.documentElement.getAttribute('data-theme') === 'dark';
    UI.openMenu($('#profileBtn'), [
      { header: true, label: (s.userName || 'Du') + ' · ' + N.planName(s.plan) },
      { icon: 'sparkles', label: s.plan === 'free' ? 'Plan upgraden' : 'Abo verwalten', onClick: s.plan === 'free' ? openPlans : function () { openSettings('plan'); } },
      { icon: 'user', label: 'Personalisierung', onClick: function () { openSettings('personal'); } },
      window.LocalAI.supported() ? { icon: 'cpu', label: 'Offline-KI', onClick: function () { openSettings('offline'); } } : null,
      { icon: 'gear', label: 'Einstellungen', onClick: function () { openSettings('general'); } },
      { sep: true },
      { icon: dark ? 'sun' : 'moon', label: dark ? 'Helles Design' : 'Dunkles Design', onClick: function () { s.theme = dark ? 'light' : 'dark'; N.saveSettings(); N.applyTheme(); } },
      { icon: 'help', label: 'Hilfe & Tastenkürzel', onClick: openHelp }
    ], { above: true, width: 250 });
  }

  function openHelp() {
    var body = el('div', { class: 'modal-body' });
    body.innerHTML = '<div class="md">' + window.Markdown.render(
      '### KI-Quellen\n\n' +
      '- **Automatisch:** mit Internet online, ohne Internet die Offline-KI.\n' +
      '- **Kostenlose Online-KI:** ' + Providers.FREE.name + ' (GPT-OSS 20B über Pollinations.ai), ohne Anmeldung.\n' +
      '- **Eigener API-Schlüssel:** OpenAI, Anthropic, Google Gemini, Mistral, Groq, OpenRouter, DeepSeek, xAI oder lokal Ollama/LM Studio.\n' +
      '- **Offline-KI:** läuft auf dem Gerät, auch im Flugmodus. Weitere Modelle unter *Einstellungen → Offline-KI*.\n\n' +
      '### Work (Agent)\n\n' +
      'In der Seitenleiste **Work** öffnen, Modell wählen (ChatGPT, Claude, Nova Online oder Offline-KI) und eine Aufgabe eingeben. Die KI plant, arbeitet Schritt für Schritt und liefert fertige PowerPoint-, Word- und Excel-Dateien. ChatGPT und Claude brauchen einen eigenen API-Schlüssel des Anbieters.\n\n' +
      '### Projekte & eigene KIs\n\n' +
      '- **Projekte:** Chats mit gemeinsamen Anweisungen und Dateien bündeln (Seitenleiste → Neues Projekt)\n' +
      '- **KIs:** eigene KIs mit festen Anweisungen und Gesprächsstartern erstellen oder Vorlagen nutzen\n\n' +
      '### Funktionen\n\n' +
      '- **PowerPoint, Word, Excel:** + → „PowerPoint erstellen“ usw. oder einfach „Erstelle eine PowerPoint über …“\n' +
      '- **Bilder erstellen:** + → Bild erstellen, oder „Erstelle ein Bild von …“ (braucht Internet)\n' +
      '- **Canvas:** + → Canvas schreibt Dokumente, die du bearbeiten und exportieren kannst\n' +
      '- **Dateien:** Bilder, PDFs, Text- und Code-Dateien anhängen\n' +
      '- **Sprachmodus:** runder Knopf rechts im Eingabefeld (wenn das Feld leer ist)\n' +
      '- **Gedächtnis:** „Merk dir, dass …“ – verwalten unter *Personalisierung*\n' +
      '- **Temporärer Chat:** Symbol oben rechts – wird nicht gespeichert\n' +
      '- **Antwortversionen:** nach „Neu generieren“ mit ‹ › wechseln\n\n' +
      '### Tastenkürzel\n\n| Aktion | Taste |\n|---|---|\n| Senden | Enter |\n| Neue Zeile | Umschalt + Enter |\n| Neuer Chat | Strg/⌘ + Umschalt + O |\n| Chats suchen | Strg/⌘ + K |\n| Seitenleiste | Strg/⌘ + Umschalt + S |\n| Schließen / Stopp | Esc |\n\n' +
      '### Abo\n\nDas Abo ist eine **Demo**: Es werden keine Zahlungsdaten abgefragt und nichts berechnet.') + '</div>';
    UI.openModal({ title: 'Hilfe', body: body });
  }

  // ======================================================================
  // Demo-Abo
  // ======================================================================
  var PLANS = [
    { id: 'free', name: 'Free', price: '0 €', desc: 'Intelligenz für alltägliche Aufgaben', features: ['Kostenlose Online-KI', 'Offline-KI auf dem Gerät', 'Eigene API-Schlüssel', 'Bilder, Canvas, Dateien, Sprachmodus'] },
    { id: 'plus', name: 'Plus', price: '23 €', desc: 'Mehr Zugriff auf erweiterte Intelligenz', featured: true, tag: 'BELIEBT', features: ['Alles aus Free', 'Plus-Abzeichen im Profil', 'Erweiterte Limits (Demo)', 'Früher Zugang zu neuen Funktionen (Demo)'] },
    { id: 'pro', name: 'Pro', price: '229 €', desc: 'Voller Zugriff auf das Beste von ' + APP, features: ['Alles aus Plus', 'Pro-Abzeichen im Profil', 'Unbegrenzte Nutzung (Demo)', 'Priorisierter Support (Demo)'] }
  ];

  function openPlans() {
    N.closeMobileSidebar();
    var s = state.settings;
    var body = el('div', { class: 'modal-body' });
    body.innerHTML = '<div class="plans-head"><h2>Plan upgraden</h2><p>Demo-Abo – es werden keine Zahlungsdaten abgefragt und nichts berechnet.</p></div>';
    var grid = el('div', { class: 'plans' });
    PLANS.forEach(function (p) {
      var cur = s.plan === p.id;
      var card = el('div', { class: 'plan' + (p.featured ? ' featured' : '') });
      card.innerHTML = '<div class="p-top"><h3>' + p.name + '</h3>' + (p.tag ? '<span class="tag">' + p.tag + '</span>' : '') + '</div>' +
        '<div class="price">' + p.price + '<small>EUR /<br>Monat</small></div><div class="p-desc">' + esc(p.desc) + '</div>';
      var btn = el('button', { class: 'btn ' + (cur ? '' : (p.featured ? 'primary' : '')), type: 'button' }, cur ? 'Dein aktueller Plan' : (p.id === 'free' ? 'Zu Free wechseln' : p.name + ' holen'));
      btn.disabled = cur;
      btn.addEventListener('click', function () {
        if (p.id === 'free') {
          UI.confirmDialog({ title: 'Zu Free wechseln?', text: 'Dein Demo-Abo wird beendet.', ok: 'Wechseln' }).then(function (ok) {
            if (!ok) return;
            s.plan = 'free'; s.planSince = null; N.saveSettings(); UI.closeModal(); N.renderSidebar(); N.renderTopbar(); toast('Du nutzt jetzt Free');
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
    UI.openModal({ title: '', body: body, size: 'full' });
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
    UI.openModal({ title: p.name + ' abonnieren', body: wrap });
    cancel.addEventListener('click', UI.closeModal);
    ok.addEventListener('click', function () {
      ok.disabled = true; cancel.disabled = true;
      ok.innerHTML = '<span class="spinner"></span> Wird aktiviert …';
      setTimeout(function () {
        state.settings.plan = p.id;
        state.settings.planSince = Date.now();
        N.saveSettings();
        UI.closeModal(); UI.closeModal();
        N.renderSidebar(); N.renderTopbar();
        var b = el('div', { class: 'modal-body', style: 'text-align:center;padding:30px 24px' },
          '<div style="font-size:44px;line-height:1">✨</div><h2 style="margin:12px 0 6px">Willkommen bei ' + APP + ' ' + p.name + '!</h2>' +
          '<p style="color:var(--text-2);margin:0 0 18px">Dein Demo-Abo ist aktiv.</p>');
        var go = el('button', { class: 'btn primary' }, 'Los geht’s');
        go.addEventListener('click', UI.closeModal);
        b.appendChild(go);
        UI.openModal({ title: false, body: b });
      }, 1200);
    });
  }

  // ======================================================================
  // Sprachmodus
  // ======================================================================
  var voice = null;

  function openVoiceMode() {
    if (!window.Speech.canListen()) { toast('Spracheingabe wird auf diesem Gerät nicht unterstützt.'); return; }
    if (voice) return;
    var node = el('div', { class: 'voice-overlay', role: 'dialog', 'aria-label': 'Sprachmodus' },
      '<div class="voice-top"><span class="voice-model"></span></div>' +
      '<div class="voice-center"><div class="voice-orb"></div><div class="voice-status"></div><div class="voice-text"></div></div>' +
      '<div class="voice-controls"><button class="voice-btn" data-mic aria-label="Mikrofon">' + icon('mic', 24) + '</button>' +
      '<button class="voice-btn end" data-end aria-label="Beenden">' + icon('x', 26) + '</button></div>');
    document.body.appendChild(node);
    node.querySelector('.voice-model').textContent = Providers.label(state.settings);
    voice = { active: true, paused: false, node: node, rec: null, resume: null };
    node.querySelector('[data-end]').addEventListener('click', closeVoiceMode);
    node.querySelector('[data-mic]').addEventListener('click', function () {
      if (!voice) return;
      voice.paused = !voice.paused;
      node.querySelector('[data-mic]').classList.toggle('off', voice.paused);
      if (voice.paused) { if (voice.rec) voice.rec.stop(); window.Speech.stopSpeaking(); setVState('idle', 'Pausiert – tippe auf das Mikrofon'); }
      else if (voice.resume) { var r = voice.resume; voice.resume = null; r(); }
    });
    voiceLoop();
  }

  function setVState(st, text) {
    if (!voice) return;
    voice.node.querySelector('.voice-orb').className = 'voice-orb ' + st;
    voice.node.querySelector('.voice-status').textContent = text || '';
  }
  function setVText(t) {
    if (!voice) return;
    var s = String(t || '');
    voice.node.querySelector('.voice-text').textContent = s.length > 220 ? '…' + s.slice(-220) : s;
  }
  function waitResume() { return new Promise(function (resolve) { if (voice) voice.resume = resolve; else resolve(); }); }
  function listenOnce() {
    return new Promise(function (resolve) {
      var finalText = '';
      voice.rec = window.Speech.listen({
        continuous: false,
        onPartial: function (t) { setVText(t); },
        onFinal: function (t) { finalText = t; },
        onError: function (m) { toast(m, 3500); },
        onEnd: function () { if (voice) voice.rec = null; resolve(finalText.trim()); }
      });
    });
  }

  async function voiceLoop() {
    var empty = 0;
    while (voice && voice.active) {
      if (voice.paused) { await waitResume(); continue; }
      setVState('listening', 'Hört zu …');
      setVText('');
      var text = await listenOnce();
      if (!voice || !voice.active) break;
      if (voice.paused) continue;
      if (!text) {
        empty++;
        if (empty >= 2) {
          voice.paused = true;
          voice.node.querySelector('[data-mic]').classList.add('off');
          setVState('idle', 'Tippe auf das Mikrofon, um weiterzusprechen');
        }
        continue;
      }
      empty = 0;
      setVText(text);
      setVState('thinking', 'Denkt nach …');
      var msg = await N.sendText(text, { voice: true });
      if (!voice || !voice.active) break;
      if (msg && msg.error) { setVState('idle', msg.error); await new Promise(function (r) { setTimeout(r, 2500); }); continue; }
      var say = msg && msg.docId ? 'Ich habe das Dokument erstellt. Du findest es im Chat.' :
        msg && Array.isArray(msg.images) ? 'Hier ist dein Bild.' : (msg && msg.content) || '';
      if (say && !voice.paused) {
        setVState('speaking', 'Spricht …');
        setVText(window.Speech.plain(say));
        await window.Speech.speak(say, { rate: state.settings.speechRate });
      }
    }
  }

  function closeVoiceMode() {
    if (!voice) return false;
    voice.active = false;
    if (voice.rec) voice.rec.stop();
    if (voice.resume) voice.resume();
    window.Speech.stopSpeaking();
    voice.node.remove();
    voice = null;
    return true;
  }


  // ======================================================================
  // Dateien (PowerPoint, Word, Excel): Vorschau & Download
  // ======================================================================
  function previewFile(f) {
    var body = el('div', { class: 'modal-body file-preview' }, window.Office.preview(f));
    var foot = el('div', { class: 'modal-foot' });
    var dl = button(icon('download', 14) + 'Herunterladen (' + window.Office.META[f.kind].ext + ')', 'primary', function () { downloadFile(f, dl); });
    foot.appendChild(dl);
    var wrap = el('div', { style: 'display:flex;flex-direction:column;min-height:0' });
    wrap.appendChild(body); wrap.appendChild(foot);
    UI.openModal({ title: esc(window.Office.fileName(f)), body: wrap, size: 'wide' });
  }

  async function downloadFile(f, btn) {
    var orig = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Wird erstellt …'; }
    try {
      var blob = await window.Office.build(f);
      await UI.saveFile(window.Office.fileName(f), blob, window.Office.META[f.kind].mime);
    } catch (e) {
      toast('Datei konnte nicht erstellt werden: ' + (e.message || e), 5000);
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = orig; }
    }
  }

  // ======================================================================
  // Projekte
  // ======================================================================
  var PROJECT_COLORS = [['#7b8cff', 'Blau'], ['#34d399', 'Grün'], ['#f59e0b', 'Orange'], ['#f472b6', 'Pink'], ['#a78bfa', 'Lila'], ['#f87171', 'Rot']];
  function getProject(id) { return id ? state.projects.find(function (p) { return p.id === id; }) || null : null; }

  function editProject(pr) {
    var isNew = !pr;
    var draft = pr ? JSON.parse(JSON.stringify(pr)) : { id: N.uid(), name: '', instructions: '', files: [], color: PROJECT_COLORS[0][0], created: Date.now() };
    var body = el('div', { class: 'modal-body' });
    body.appendChild(col('Name', field(draft.name, 'z. B. Umzug 2026, Bachelorarbeit …', function (v) { draft.name = v; })));
    body.appendChild(row('Farbe', null, select(PROJECT_COLORS, draft.color, function (v) { draft.color = v; })));
    var ins = el('textarea', { class: 'field', placeholder: 'Wie soll die KI in diesem Projekt antworten? Was ist wichtig? (z. B. „Antworte als Projektleiter, kurz und mit To-dos“)' });
    ins.value = draft.instructions;
    ins.addEventListener('input', function () { draft.instructions = ins.value; });
    body.appendChild(col('Anweisungen', ins, 'Gelten für alle Chats in diesem Projekt.'));
    var files = el('div', { class: 'memory-list' });
    function renderFiles() {
      files.innerHTML = '';
      if (!draft.files.length) files.appendChild(el('div', { class: 'list-empty small' }, 'Noch keine Dateien. Text-, Code- und PDF-Dateien werden als Wissen genutzt.'));
      draft.files.forEach(function (f) {
        var r = el('div', { class: 'memory-item' }, icon('doc', 16) + '<span>' + esc(f.name) + ' <small class="muted-small">(' + Math.round(f.data.length / 1000) + ' Tsd. Zeichen)</small></span>');
        var del = el('button', { class: 'icon-btn', 'aria-label': 'Entfernen' }, icon('trash', 16));
        del.addEventListener('click', function () { draft.files = draft.files.filter(function (x) { return x !== f; }); renderFiles(); });
        r.appendChild(del);
        files.appendChild(r);
      });
    }
    renderFiles();
    var fileInput = el('input', { type: 'file', multiple: true, hidden: true });
    fileInput.addEventListener('change', async function () {
      for (var i = 0; i < fileInput.files.length; i++) {
        var f = fileInput.files[i];
        try { draft.files.push({ name: f.name, data: String(await N.readFileText(f)).slice(0, 200000) }); }
        catch (e) { toast('Konnte nicht gelesen werden: ' + f.name); }
      }
      fileInput.value = '';
      renderFiles();
    });
    var fc = col('Dateien (Wissen)', files);
    fc.appendChild(fileInput);
    fc.appendChild(button(icon('plus', 14) + 'Datei hinzufügen', '', function () { fileInput.click(); }));
    body.appendChild(fc);
    var foot = el('div', { class: 'modal-foot' });
    foot.appendChild(button('Abbrechen', '', function () { UI.closeModal(); }));
    foot.appendChild(button(isNew ? 'Projekt erstellen' : 'Speichern', 'primary', function () {
      if (!draft.name.trim()) { toast('Bitte einen Namen eingeben.'); return; }
      draft.name = draft.name.trim().slice(0, 80);
      draft.updated = Date.now();
      if (isNew) state.projects.push(draft);
      else Object.assign(pr, draft);
      N.persist('projects', true);
      UI.closeModal();
      N.openProject(draft.id);
    }));
    var wrap = el('div', { style: 'display:flex;flex-direction:column;min-height:0' });
    wrap.appendChild(body); wrap.appendChild(foot);
    UI.openModal({ title: isNew ? 'Neues Projekt' : 'Projekt bearbeiten', body: wrap });
  }

  function deleteProject(pr) {
    var chats = state.chats.filter(function (c) { return c.projectId === pr.id; });
    UI.confirmDialog({ title: 'Projekt löschen?', text: '<b>' + esc(pr.name) + '</b> und ' + chats.length + ' Chat(s) darin werden gelöscht.', ok: 'Löschen', danger: true }).then(function (ok) {
      if (!ok) return;
      state.projects = state.projects.filter(function (x) { return x !== pr; });
      state.chats = state.chats.filter(function (c) { return c.projectId !== pr.id; });
      N.persist('projects', true); N.persist('chats', true);
      N.newChat();
    });
  }

  function renderProjectPanel(pr) {
    var box = $('#projectPanel');
    box.innerHTML = '';
    var top = el('div', { class: 'pp-actions' });
    top.appendChild(button(icon('pencil', 14) + 'Anweisungen & Dateien', '', function () { editProject(pr); }));
    (pr.files || []).slice(0, 4).forEach(function (f) { top.appendChild(el('span', { class: 'pp-file' }, icon('doc', 14) + esc(f.name))); });
    box.appendChild(top);
    var chats = state.chats.filter(function (c) { return c.projectId === pr.id && !c.archived; }).sort(function (a, b) { return b.updated - a.updated; });
    box.appendChild(el('h4', null, 'Chats in diesem Projekt'));
    if (!chats.length) box.appendChild(el('div', { class: 'list-empty small' }, 'Noch keine Chats – schreib oben die erste Nachricht.'));
    chats.forEach(function (c) {
      var last = c.messages[c.messages.length - 1];
      var r = el('button', { class: 'result', type: 'button' }, icon('compose', 18) + '<span class="r-main"><b>' + esc(c.title) + '</b><small>' + esc(last ? String(last.content || '').slice(0, 90) : '') + '</small></span><small class="muted-small">' + new Date(c.updated).toLocaleDateString('de-DE') + '</small>');
      r.addEventListener('click', function () { N.openChat(c.id); });
      box.appendChild(r);
    });
  }

  // ======================================================================
  // Eigene KIs (wie „GPTs“)
  // ======================================================================
  var BUILTIN_ASSISTANTS = [
    { id: 'tpl-translate', emoji: '🌍', name: 'Übersetzer', desc: 'Übersetzt Texte natürlich und stilsicher in jede Sprache.', instructions: 'Du bist ein professioneller Übersetzer. Erkenne die Ausgangssprache. Wenn der Nutzer nichts anderes sagt: Deutsch → Englisch, andere Sprachen → Deutsch. Gib nur die Übersetzung aus, danach bei Bedarf kurze Hinweise zu Redewendungen.', starters: ['Übersetze ins Englische: ', 'Was heißt „Feierabend“ auf Spanisch?', 'Übersetze diese E-Mail ins Französische:'] },
    { id: 'tpl-job', emoji: '💼', name: 'Bewerbungs-Coach', desc: 'Hilft bei Anschreiben, Lebenslauf und Vorstellungsgespräch.', instructions: 'Du bist ein erfahrener Bewerbungs-Coach in Deutschland. Stelle gezielte Rückfragen (Stelle, Erfahrung, Stärken), bevor du Texte schreibst. Gib konkrete, ehrliche Verbesserungsvorschläge.', starters: ['Hilf mir bei einem Anschreiben', 'Übe mit mir ein Vorstellungsgespräch', 'Prüfe meinen Lebenslauf'] },
    { id: 'tpl-math', emoji: '📐', name: 'Mathe-Nachhilfe', desc: 'Erklärt Mathe Schritt für Schritt – geduldig und verständlich.', instructions: 'Du bist ein geduldiger Mathe-Nachhilfelehrer. Erkläre Schritt für Schritt, verwende einfache Worte und Beispiele. Verrate Lösungen nicht sofort, sondern führe mit Fragen hin, außer der Nutzer will die Lösung.', starters: ['Erkläre mir den Satz des Pythagoras', 'Wie löse ich 3x + 5 = 20?', 'Was ist eine Ableitung?'] },
    { id: 'tpl-cook', emoji: '🍳', name: 'Koch-Assistent', desc: 'Rezepte aus dem, was du im Kühlschrank hast.', instructions: 'Du bist ein kreativer Koch. Schlage alltagstaugliche Rezepte mit Zutatenliste (Mengen für 2 Personen) und nummerierten Schritten vor. Frage nach Allergien oder Vorlieben, wenn unklar.', starters: ['Ich habe Nudeln, Tomaten und Feta', 'Ein schnelles vegetarisches Abendessen', 'Plane meine Wochenmahlzeiten'] },
    { id: 'tpl-editor', emoji: '✍️', name: 'Text-Lektor', desc: 'Korrigiert Rechtschreibung, Grammatik und Stil.', instructions: 'Du bist ein Lektor. Korrigiere Rechtschreibung, Grammatik und Zeichensetzung. Gib zuerst den korrigierten Text aus, dann eine kurze Liste der wichtigsten Änderungen. Erhalte Ton und Inhalt.', starters: ['Korrigiere diesen Text:', 'Mach diese E-Mail freundlicher:', 'Kürze diesen Absatz:'] },
    { id: 'tpl-travel', emoji: '🧳', name: 'Reiseplaner', desc: 'Plant Reisen mit Tagesablauf, Budget und Tipps.', instructions: 'Du bist ein Reiseplaner. Erstelle übersichtliche Tagespläne mit Uhrzeiten, geschätzten Kosten und Insider-Tipps. Frage nach Budget, Reisezeitraum und Interessen, wenn unklar.', starters: ['Plane 3 Tage in Rom', 'Wochenendtrip in Deutschland unter 300 €', 'Packliste für Skiurlaub'] }
  ];
  function getAssistant(id) {
    if (!id) return null;
    return state.assistants.find(function (a) { return a.id === id; }) || BUILTIN_ASSISTANTS.find(function (a) { return a.id === id; }) || null;
  }

  function openAssistants() {
    N.closeMobileSidebar();
    var body = el('div', { class: 'modal-body' });
    function render() {
      body.innerHTML = '<div class="plans-head"><h2>KIs</h2><p>Eigene KIs mit festen Anweisungen erstellen – z. B. für Bewerbungen, Nachhilfe oder deine Firma.</p></div>';
      var create = el('button', { class: 'as-card create', type: 'button' }, '<span class="as-emoji big">＋</span><span><b>Eigene KI erstellen</b><small>Name, Anweisungen und Gesprächsstarter festlegen</small></span>');
      create.addEventListener('click', function () { editAssistant(null); });
      var grid = el('div', { class: 'as-grid' });
      grid.appendChild(create);
      state.assistants.forEach(function (a) { grid.appendChild(card(a, true)); });
      body.appendChild(el('h4', { class: 'as-h' }, 'Meine KIs'));
      body.appendChild(grid);
      body.appendChild(el('h4', { class: 'as-h' }, 'Vorlagen'));
      var g2 = el('div', { class: 'as-grid' });
      BUILTIN_ASSISTANTS.forEach(function (a) { g2.appendChild(card(a, false)); });
      body.appendChild(g2);
    }
    function card(a, own) {
      var c = el('div', { class: 'as-card', role: 'button', tabindex: '0' }, '<span class="as-emoji big">' + esc(a.emoji || '🤖') + '</span><span><b>' + esc(a.name) + '</b><small>' + esc(a.desc || '') + '</small></span>');
      c.addEventListener('click', function () { while (UI.modalOpen()) UI.closeModal(); N.startAssistant(a.id); });
      var more = el('button', { class: 'icon-btn r-act', 'aria-label': 'Optionen' }, icon('more', 18));
      more.addEventListener('click', function (e) {
        e.stopPropagation();
        UI.openMenu(more, own ? [
          { icon: 'pencil', label: 'Bearbeiten', onClick: function () { editAssistant(a); } },
          { icon: 'trash', label: 'Löschen', danger: true, onClick: function () { state.assistants = state.assistants.filter(function (x) { return x !== a; }); N.persist('assistants', true); render(); N.renderSidebar(); } }
        ] : [
          { icon: 'copy', label: 'Als eigene KI anpassen', onClick: function () { var copy = JSON.parse(JSON.stringify(a)); copy.id = null; copy.name += ' (angepasst)'; editAssistant(copy); } }
        ], { align: 'right' });
      });
      c.appendChild(more);
      return c;
    }
    render();
    UI.openModal({ title: '', body: body, size: 'wide', onClose: function () { N.renderSidebar(); } });
  }

  function editAssistant(a) {
    var isNew = !a || !a.id;
    var draft = a ? JSON.parse(JSON.stringify(a)) : { emoji: '🤖', name: '', desc: '', instructions: '', starters: ['', '', ''] };
    if (isNew) draft.id = N.uid();
    while ((draft.starters || []).length < 3) (draft.starters = draft.starters || []).push('');
    var body = el('div', { class: 'modal-body' });
    var top = el('div', { class: 'input-with-btn' });
    var emo = field(draft.emoji, '🤖', function (v) { draft.emoji = v.trim().slice(0, 4) || '🤖'; });
    emo.style.maxWidth = '70px'; emo.style.textAlign = 'center';
    top.appendChild(emo);
    top.appendChild(field(draft.name, 'Name, z. B. „Steuer-Helfer“', function (v) { draft.name = v; }));
    body.appendChild(col('Symbol & Name', top));
    body.appendChild(col('Beschreibung', field(draft.desc, 'Was kann diese KI?', function (v) { draft.desc = v; })));
    var ins = el('textarea', { class: 'field', placeholder: 'Was macht die KI? Wie soll sie sich verhalten? Was soll sie vermeiden?' });
    ins.style.minHeight = '140px';
    ins.value = draft.instructions;
    ins.addEventListener('input', function () { draft.instructions = ins.value; });
    body.appendChild(col('Anweisungen', ins));
    var st = el('div', { class: 'starter-list' });
    draft.starters.slice(0, 4).forEach(function (sv, i) { st.appendChild(field(sv, 'Gesprächsstarter ' + (i + 1), function (v) { draft.starters[i] = v; })); });
    body.appendChild(col('Gesprächsstarter', st));
    var foot = el('div', { class: 'modal-foot' });
    foot.appendChild(button('Abbrechen', '', function () { UI.closeModal(); }));
    foot.appendChild(button(isNew ? 'Erstellen' : 'Speichern', 'primary', function () {
      if (!draft.name.trim() || !draft.instructions.trim()) { toast('Bitte Name und Anweisungen ausfüllen.'); return; }
      draft.name = draft.name.trim().slice(0, 60);
      draft.starters = draft.starters.map(function (x) { return x.trim(); }).filter(Boolean);
      var existing = state.assistants.find(function (x) { return x.id === draft.id; });
      if (existing) Object.assign(existing, draft); else state.assistants.push(draft);
      N.persist('assistants', true);
      while (UI.modalOpen()) UI.closeModal();
      N.startAssistant(draft.id);
      toast('KI „' + draft.name + '“ gespeichert');
    }));
    var wrap = el('div', { style: 'display:flex;flex-direction:column;min-height:0' });
    wrap.appendChild(body); wrap.appendChild(foot);
    UI.openModal({ title: isNew ? 'Eigene KI erstellen' : 'KI bearbeiten', body: wrap });
  }

  // ---------- Schlüssel je Anbieter (für Work) ----------
  function getPresetKey(id) {
    var s = state.settings;
    if (currentPresetId(s) === id) return id === 'anthropic' ? s.anthropic.apiKey : s.openai.apiKey;
    return s.apiKeys[id] || '';
  }
  function setPresetKey(id, key) {
    var s = state.settings;
    s.apiKeys[id] = key;
    if (currentPresetId(s) === id) { if (id === 'anthropic') s.anthropic.apiKey = key; else s.openai.apiKey = key; }
    N.saveSettings();
  }
  function getPresetModel(id) {
    var s = state.settings;
    if (currentPresetId(s) === id) return id === 'anthropic' ? s.anthropic.model : s.openai.model;
    return s.apiModels[id] || '';
  }
  function setPresetModel(id, model) {
    var s = state.settings;
    s.apiModels[id] = model;
    if (currentPresetId(s) === id) { if (id === 'anthropic') s.anthropic.model = model; else s.openai.model = model; }
    N.saveSettings();
  }

  Object.assign(N, {
    openSettings: openSettings, openPlans: openPlans, openSearch: openSearch, openDocs: openDocs,
    openLibrary: openLibrary, viewImage: viewImage, downloadImage: downloadImage,
    openProfileMenu: openProfileMenu, openHelp: openHelp, shareChat: shareChat,
    importAll: importAll, openVoiceMode: openVoiceMode, closeVoiceMode: closeVoiceMode,
    previewFile: previewFile, downloadFile: downloadFile,
    getProject: getProject, editProject: editProject, deleteProject: deleteProject, renderProjectPanel: renderProjectPanel,
    getAssistant: getAssistant, openAssistants: openAssistants, editAssistant: editAssistant,
    getPresetKey: getPresetKey, setPresetKey: setPresetKey, getPresetModel: getPresetModel, setPresetModel: setPresetModel,
    UIparts: { row: row, toggle: toggle, select: select, button: button, col: col, field: field, link: link }
  });

  N.init();
})();
