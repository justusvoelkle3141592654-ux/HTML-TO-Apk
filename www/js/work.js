/* NovaChat – „Work“: KI-Agent für mehrstufige Aufgaben (ähnlich ChatGPT-Agent / Claude Cowork).
 * Die KI plant die Aufgabe, bearbeitet Schritt für Schritt und liefert fertige Dateien
 * (PowerPoint, Word, Excel). Modell wählbar: ChatGPT (OpenAI), Claude (Anthropic),
 * Nova Online (kostenlos) oder Offline-KI (nur Computer). */
(function () {
  'use strict';

  var UI = window.UI;
  var N = window.Nova;
  var $ = UI.$, el = UI.el, esc = UI.esc, icon = UI.icon, toast = UI.toast;
  var Providers = window.Providers;
  var Office = window.Office;
  var state = N.state;
  var running = {};

  var MODELS = [
    { id: 'openai', name: 'ChatGPT', by: 'OpenAI', icon: 'sparkles' },
    { id: 'anthropic', name: 'Claude', by: 'Anthropic', icon: 'sparkles' },
    { id: 'free', name: 'Nova Online', by: 'kostenlos', icon: 'globe' },
    { id: 'local', name: 'Offline-KI', by: 'nur Computer', icon: 'cpu' }
  ];
  var KIND_OF = { document: 'docx', presentation: 'pptx', spreadsheet: 'xlsx' };
  var ACTION_LABEL = { think: 'Ausarbeiten', document: 'Word-Dokument', presentation: 'PowerPoint', spreadsheet: 'Excel-Tabelle' };
  var EXAMPLES = [
    'Erstelle eine PowerPoint über erneuerbare Energien für die Schule',
    'Plane meinen Monatshaushalt als Excel-Tabelle mit Einnahmen und Ausgaben',
    'Schreibe ein Bewerbungsanschreiben als Webentwickler als Word-Dokument',
    'Recherchiere die Vor- und Nachteile von E-Autos und erstelle eine Präsentation und eine Vergleichstabelle'
  ];

  function workModel() {
    var m = state.settings.workModel;
    if (m === 'local' && !window.LocalAI.supported()) m = null;
    return m || 'free';
  }

  function modelInfo(id) {
    var s = state.settings;
    if (id === 'openai') {
      var k = N.getPresetKey('openai'), mo = N.getPresetModel('openai');
      return { ok: !!(k && mo), label: 'ChatGPT' + (mo ? ' · ' + mo : ''), need: !k ? 'OpenAI-API-Schlüssel fehlt' : !mo ? 'Modell auswählen' : '' };
    }
    if (id === 'anthropic') {
      var ka = N.getPresetKey('anthropic'), ma = N.getPresetModel('anthropic') || 'claude-sonnet-5';
      return { ok: !!ka, label: 'Claude · ' + ma, need: ka ? '' : 'Anthropic-API-Schlüssel fehlt' };
    }
    if (id === 'local') {
      var lid = Providers.localModelId(s);
      var cm = lid && window.ModelCatalog.get(lid);
      return { ok: !!cm, label: cm ? cm.name + ' (offline)' : 'Offline-KI', need: cm ? '' : 'Kein Offline-Modell installiert', warn: 'Kleine Offline-Modelle schaffen komplexe Aufgaben oft nicht zuverlässig.' };
    }
    return { ok: navigator.onLine, label: 'Nova Online (GPT-OSS 20B)', need: navigator.onLine ? '' : 'Keine Internetverbindung' };
  }

  /** Einstellungen für einen Lauf mit dem gewählten Modell. */
  function runConfig(id) {
    var s = JSON.parse(JSON.stringify(state.settings));
    if (id === 'openai') {
      var p = Providers.PRESETS.find(function (x) { return x.id === 'openai'; });
      s.provider = 'openai';
      s.openai = Object.assign(s.openai, { preset: 'openai', baseUrl: p.baseUrl, apiKey: N.getPresetKey('openai'), model: N.getPresetModel('openai') });
      return { settings: s, engine: 'custom' };
    }
    if (id === 'anthropic') {
      s.provider = 'anthropic';
      s.anthropic = Object.assign(s.anthropic, { apiKey: N.getPresetKey('anthropic'), model: N.getPresetModel('anthropic') || 'claude-sonnet-5', maxTokens: 8192 });
      return { settings: s, engine: 'custom' };
    }
    return { settings: s, engine: id };
  }

  // ======================================================================
  // Einrichtung ChatGPT / Claude
  // ======================================================================
  function setupModel(id, done) {
    var P = N.UIparts;
    var isClaude = id === 'anthropic';
    var body = el('div', { class: 'modal-body' });
    body.appendChild(el('p', { class: 'pane-intro', style: 'margin-top:0' }, (isClaude ? 'Claude' : 'ChatGPT') + ' wird über die offizielle API von ' + (isClaude ? 'Anthropic' : 'OpenAI') +
      ' genutzt. Dafür brauchst du einen eigenen API-Schlüssel; die Kosten rechnet der Anbieter direkt mit dir ab. Der Schlüssel bleibt nur auf diesem Gerät.'));
    var key = N.getPresetKey(id);
    var model = N.getPresetModel(id) || (isClaude ? 'claude-sonnet-5' : '');
    var kc = P.col('API-Schlüssel', P.field(key, isClaude ? 'sk-ant-…' : 'sk-…', function (v) { key = v.trim(); }, 'password'));
    kc.appendChild(P.link('Schlüssel erstellen', isClaude ? 'https://console.anthropic.com/settings/keys' : 'https://platform.openai.com/api-keys'));
    body.appendChild(kc);
    var list = el('datalist', { id: 'workModelList' });
    var mf = P.field(model, isClaude ? 'claude-sonnet-5' : 'Modell über „Modelle laden“ auswählen', function (v) { model = v.trim(); });
    mf.setAttribute('list', 'workModelList');
    var status = el('div', { class: 'status-line' });
    var mw = el('div', { class: 'input-with-btn' });
    mw.appendChild(mf);
    mw.appendChild(P.button('Modelle laden', '', async function () {
      if (!key) { status.className = 'status-line err'; status.textContent = 'Bitte zuerst den Schlüssel eintragen.'; return; }
      status.className = 'status-line'; status.textContent = 'Lade Modelle …';
      var s = JSON.parse(JSON.stringify(state.settings));
      if (isClaude) { s.provider = 'anthropic'; s.anthropic.apiKey = key; }
      else { s.provider = 'openai'; s.openai.baseUrl = 'https://api.openai.com/v1'; s.openai.apiKey = key; }
      try {
        var models = await Providers.listModels(s);
        if (!isClaude) models = models.filter(function (m) { return /^(gpt|o\d|chatgpt)/i.test(m) && !/audio|realtime|tts|transcribe|image|search|embedding/i.test(m); });
        list.innerHTML = models.map(function (m) { return '<option value="' + esc(m) + '">'; }).join('');
        status.className = 'status-line ok';
        status.textContent = models.length + ' Modelle gefunden – ins Feld tippen, um eins auszuwählen.';
        if (!mf.value && models.length) { mf.value = models[0]; model = models[0]; }
      } catch (e) { status.className = 'status-line err'; status.textContent = Providers.friendlyError(e); }
    }));
    var mc = P.col('Modell', mw);
    mc.appendChild(list);
    mc.appendChild(status);
    body.appendChild(mc);
    var foot = el('div', { class: 'modal-foot' });
    foot.appendChild(P.button('Abbrechen', '', function () { UI.closeModal(); }));
    foot.appendChild(P.button('Speichern', 'primary', function () {
      if (!key || !model) { toast('Bitte Schlüssel und Modell eintragen.'); return; }
      N.setPresetKey(id, key);
      N.setPresetModel(id, model);
      UI.closeModal();
      if (done) done();
    }));
    var wrap = el('div', { style: 'display:flex;flex-direction:column;min-height:0' });
    wrap.appendChild(body); wrap.appendChild(foot);
    UI.openModal({ title: (isClaude ? 'Claude' : 'ChatGPT') + ' verbinden', body: wrap });
  }

  // ======================================================================
  // Ansicht
  // ======================================================================
  function renderWork() {
    var box = $('#workView');
    if (state.view !== 'work') return;
    var w = state.workId && state.works.find(function (x) { return x.id === state.workId; });
    box.innerHTML = '';
    box.appendChild(w ? detailView(w) : homeView());
  }

  function homeView() {
    var root = el('div', { class: 'work-home' });
    root.appendChild(el('div', { class: 'work-hero' },
      '<span class="work-logo">' + icon('briefcase', 26) + '</span><h1>Work</h1>' +
      '<p>Gib eine Aufgabe. Die KI plant, arbeitet Schritt für Schritt und liefert fertige Dateien – PowerPoint, Word und Excel.</p>'));

    var current = workModel();
    var seg = el('div', { class: 'work-models', role: 'radiogroup', 'aria-label': 'Modell' });
    MODELS.forEach(function (m) {
      if (m.id === 'local' && !window.LocalAI.supported()) return;
      var b = el('button', { type: 'button', class: 'wm' + (current === m.id ? ' on' : ''), role: 'radio', 'aria-checked': current === m.id ? 'true' : 'false' },
        '<b>' + esc(m.name) + '</b><small>' + esc(m.by) + '</small>');
      b.addEventListener('click', function () {
        state.settings.workModel = m.id; N.saveSettings();
        var info = modelInfo(m.id);
        if (!info.ok && (m.id === 'openai' || m.id === 'anthropic')) setupModel(m.id, renderWork);
        renderWork();
      });
      seg.appendChild(b);
    });
    root.appendChild(seg);

    var info = modelInfo(current);
    var st = el('div', { class: 'work-model-status' + (info.ok ? '' : ' warn') },
      (info.ok ? icon('checkCircle', 15) + '<span>' + esc(info.label) + '</span>' : icon('alert', 15) + '<span>' + esc(info.need) + '</span>'));
    if (current === 'openai' || current === 'anthropic') {
      var ch = el('button', { type: 'button', class: 'link-btn' }, info.ok ? 'Ändern' : 'Jetzt einrichten');
      ch.addEventListener('click', function () { setupModel(current, renderWork); });
      st.appendChild(ch);
    } else if (current === 'local' && !info.ok) {
      var ol = el('button', { type: 'button', class: 'link-btn' }, 'Modell herunterladen');
      ol.addEventListener('click', function () { N.openSettings('offline'); });
      st.appendChild(ol);
    }
    root.appendChild(st);
    if (info.warn && info.ok) root.appendChild(el('div', { class: 'work-model-status warn' }, icon('alert', 15) + '<span>' + esc(info.warn) + '</span>'));

    var form = el('form', { class: 'composer work-composer', autocomplete: 'off' });
    var ta = el('textarea', { rows: '3', placeholder: 'Was soll erledigt werden? z. B. „Erstelle eine Präsentation über …“' });
    ta.value = state.workDraft || '';
    ta.addEventListener('input', function () { state.workDraft = ta.value; });
    var rowEl = el('div', { class: 'composer-row' });
    rowEl.appendChild(el('span', { class: 'muted-small' }, 'Ergebnisse: PowerPoint · Word · Excel · Text'));
    rowEl.appendChild(el('div', { class: 'spacer' }));
    var go = el('button', { type: 'submit', class: 'btn primary' }, icon('play', 14) + 'Starten');
    rowEl.appendChild(go);
    form.appendChild(ta); form.appendChild(rowEl);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var task = ta.value.trim();
      if (!task) { ta.focus(); return; }
      var mi = modelInfo(workModel());
      if (!mi.ok) {
        if (workModel() === 'openai' || workModel() === 'anthropic') setupModel(workModel(), function () { form.requestSubmit(); });
        else toast(mi.need);
        return;
      }
      state.workDraft = '';
      startWork(task, workModel());
    });
    ta.addEventListener('keydown', function (e) { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) form.requestSubmit(); });
    root.appendChild(form);

    var ex = el('div', { class: 'suggestions work-examples' });
    EXAMPLES.forEach(function (t) {
      var b = el('button', { type: 'button' }, '<span>' + esc(t) + '</span>');
      b.addEventListener('click', function () { ta.value = t; state.workDraft = t; ta.focus(); });
      ex.appendChild(b);
    });
    root.appendChild(ex);

    var list = state.works.slice().sort(function (a, b) { return b.created - a.created; });
    if (list.length) {
      root.appendChild(el('h3', { class: 'work-h' }, 'Letzte Aufgaben'));
      var lb = el('div', { class: 'work-list' });
      list.forEach(function (w) {
        var files = allFiles(w).length;
        var r = el('button', { type: 'button', class: 'result' }, statusIcon(w.status) +
          '<span class="r-main"><b>' + esc((w.plan && w.plan.title) || w.task) + '</b><small>' + esc(statusText(w)) + ' · ' + esc(modelName(w.model)) + (files ? ' · ' + files + ' Datei(en)' : '') + '</small></span>' +
          '<small class="muted-small">' + new Date(w.created).toLocaleDateString('de-DE') + '</small>');
        r.addEventListener('click', function () { state.workId = w.id; renderWork(); });
        lb.appendChild(r);
      });
      root.appendChild(lb);
    }
    setTimeout(function () { if (!UI.coarse) ta.focus(); });
    return root;
  }

  function modelName(id) { var m = MODELS.find(function (x) { return x.id === id; }); return m ? m.name : id; }
  function statusText(w) {
    return { planning: 'Plant …', running: 'Arbeitet …', done: 'Fertig', error: 'Fehler', stopped: 'Gestoppt' }[w.status] || w.status;
  }
  function statusIcon(st) {
    if (st === 'running' || st === 'planning') return '<span class="spinner step-spin"></span>';
    if (st === 'done') return '<span class="st-ok">' + icon('checkCircle', 18) + '</span>';
    if (st === 'error') return '<span class="st-err">' + icon('alert', 18) + '</span>';
    if (st === 'stopped') return '<span class="st-muted">' + icon('stop', 18) + '</span>';
    return '<span class="st-muted">' + icon('circle', 18) + '</span>';
  }
  function allFiles(w) {
    return ((w.plan && w.plan.steps) || []).filter(function (s) { return s.file; }).map(function (s) { return s.file; });
  }

  function fileCard(f) {
    var meta = Office.META[f.kind];
    var card = el('div', { class: 'file-card' },
      '<span class="fc-ic" style="background:' + meta.color + '">' + icon(f.kind === 'pptx' ? 'slides' : f.kind === 'xlsx' ? 'table' : 'fileWord', 20) + '</span>' +
      '<span class="fc-main"><b>' + esc(Office.fileName(f)) + '</b><small>' + meta.label + ' · ' + esc(Office.summary(f)) + '</small></span>');
    var act = el('span', { class: 'fc-act' });
    var pv = el('button', { class: 'btn small', type: 'button' }, 'Vorschau');
    pv.addEventListener('click', function () { N.previewFile(f); });
    var dl = el('button', { class: 'btn small primary', type: 'button' }, icon('download', 14) + 'Herunterladen');
    dl.addEventListener('click', function () { N.downloadFile(f, dl); });
    act.appendChild(pv); act.appendChild(dl);
    card.appendChild(act);
    return card;
  }

  function detailView(w) {
    var root = el('div', { class: 'work-detail' });
    var head = el('div', { class: 'work-head' });
    var back = el('button', { type: 'button', class: 'btn small' }, icon('left', 14) + 'Work');
    back.addEventListener('click', function () { state.workId = null; renderWork(); });
    head.appendChild(back);
    head.appendChild(el('span', { class: 'work-badge' }, esc(w.modelLabel || modelName(w.model))));
    head.appendChild(el('div', { class: 'spacer' }));
    if (running[w.id]) {
      var stop = el('button', { type: 'button', class: 'btn small danger' }, icon('stop', 14) + 'Stopp');
      stop.addEventListener('click', function () { running[w.id].abort(); });
      head.appendChild(stop);
    } else {
      var again = el('button', { type: 'button', class: 'btn small' }, icon('refresh', 14) + 'Erneut ausführen');
      again.addEventListener('click', function () { startWork(w.task, w.model); });
      head.appendChild(again);
      var del = el('button', { type: 'button', class: 'icon-btn', title: 'Löschen', 'aria-label': 'Löschen' }, icon('trash', 18));
      del.addEventListener('click', function () {
        state.works = state.works.filter(function (x) { return x !== w; });
        N.persist('works', true);
        state.workId = null; renderWork();
      });
      head.appendChild(del);
    }
    root.appendChild(head);
    root.appendChild(el('h2', { class: 'work-title' }, esc((w.plan && w.plan.title) || 'Aufgabe')));
    root.appendChild(el('div', { class: 'work-task' }, esc(w.task)));

    var steps = el('div', { class: 'work-steps' });
    var planRow = el('div', { class: 'work-step ' + (w.status === 'planning' ? 'running' : 'done') },
      statusIcon(w.status === 'planning' ? 'running' : (w.plan ? 'done' : w.status)) +
      '<div class="ws-main"><b>Plan erstellen</b>' + (w.status === 'planning' && w.live ? '<div class="ws-live">' + esc(w.live.slice(-220)) + '</div>' : '') + '</div>');
    steps.appendChild(planRow);
    ((w.plan && w.plan.steps) || []).forEach(function (s, i) {
      var r = el('div', { class: 'work-step ' + (s.status || 'wait') });
      r.innerHTML = statusIcon(s.status || 'wait') +
        '<div class="ws-main"><b>' + (i + 1) + '. ' + esc(s.title) + '</b> <span class="tag-small">' + esc(ACTION_LABEL[s.action] || 'Ausarbeiten') + '</span>' +
        (s.details ? '<small>' + esc(s.details) + '</small>' : '') +
        (s.status === 'running' && w.live ? '<div class="ws-live">' + esc(w.live.slice(-260)) + '</div>' : '') +
        (s.error ? '<div class="msg-error">' + esc(s.error) + '</div>' : '') + '</div>';
      var main = r.querySelector('.ws-main');
      if (s.result && !s.file) {
        var det = el('details', { class: 'ws-result' }, '<summary>Ergebnis anzeigen</summary><div class="md"></div>');
        det.querySelector('.md').innerHTML = window.Markdown.render(s.result);
        main.appendChild(det);
      }
      if (s.file) main.appendChild(fileCard(s.file));
      steps.appendChild(r);
    });
    if (w.plan && (w.status === 'done' || w.summary)) {
      steps.appendChild(el('div', { class: 'work-step ' + (w.summary ? 'done' : 'running') }, statusIcon(w.summary ? 'done' : 'running') + '<div class="ws-main"><b>Zusammenfassung</b></div>'));
    }
    root.appendChild(steps);

    if (w.error) root.appendChild(el('div', { class: 'msg-error' }, '<b>Fehler:</b> ' + esc(w.error)));
    if (w.summary) root.appendChild(el('div', { class: 'md work-summary' }, window.Markdown.render(w.summary)));
    var files = allFiles(w);
    if (files.length) {
      root.appendChild(el('h3', { class: 'work-h' }, 'Ergebnisse'));
      files.forEach(function (f) { root.appendChild(fileCard(f)); });
    }
    return root;
  }

  var paintTimer = 0;
  function paint(w, now) {
    if (state.view !== 'work' || state.workId !== w.id) return;
    if (now) { clearTimeout(paintTimer); paintTimer = 0; renderWork(); return; }
    if (paintTimer) return;
    paintTimer = setTimeout(function () { paintTimer = 0; renderWork(); }, 250);
  }

  // ======================================================================
  // Agent
  // ======================================================================
  var PLAN_SYSTEM = 'Du bist „Work“, ein KI-Agent, der Aufgaben selbstständig und gründlich erledigt. ' +
    'Zerlege die Aufgabe in 2 bis 6 sinnvolle Schritte. Verfügbare Aktionen:\n' +
    '- "think": recherchieren, nachdenken, analysieren oder Text ausarbeiten (Ergebnis als Text)\n' +
    '- "document": ein Word-Dokument (.docx) erstellen\n' +
    '- "presentation": eine PowerPoint-Präsentation (.pptx) erstellen\n' +
    '- "spreadsheet": eine Excel-Tabelle (.xlsx) erstellen\n' +
    'Erstelle Dateien nur, wenn sie zur Aufgabe passen – meist am Ende, nachdem der Inhalt ausgearbeitet ist. ' +
    'Antworte AUSSCHLIESSLICH mit JSON in diesem Format: {"title":"Kurzer Titel der Aufgabe","steps":[{"title":"Schritt","action":"think","details":"Was genau zu tun ist"}]}';

  function parsePlan(text, task) {
    try {
      var t = String(text || '');
      var f = /```(?:json)?\s*([\s\S]*?)```/i.exec(t);
      if (f) t = f[1];
      var j = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1).replace(/,\s*([}\]])/g, '$1'));
      var steps = (j.steps || []).map(function (s) {
        var a = String(s.action || 'think').toLowerCase();
        if (!ACTION_LABEL[a]) a = /pr[äa]sent|folie|pptx|power/.test(a) ? 'presentation' : /tabell|excel|xlsx|sheet/.test(a) ? 'spreadsheet' : /doc|word|dokument/.test(a) ? 'document' : 'think';
        return { title: String(s.title || 'Schritt').slice(0, 120), action: a, details: String(s.details || '').slice(0, 400), status: 'wait' };
      }).slice(0, 7);
      if (!steps.length) throw new Error('leer');
      return { title: String(j.title || task).slice(0, 100), steps: steps };
    } catch (e) {
      var kind = Office.detect(task) || Office.detect('erstelle ' + task);
      var steps2 = [{ title: 'Aufgabe ausarbeiten', action: 'think', details: task, status: 'wait' }];
      if (kind) steps2.push({ title: 'Datei erstellen', action: { pptx: 'presentation', docx: 'document', xlsx: 'spreadsheet' }[kind], details: task, status: 'wait' });
      return { title: task.slice(0, 80), steps: steps2 };
    }
  }

  function startWork(task, model) {
    var w = { id: N.uid(), task: task, model: model, modelLabel: modelInfo(model).label, status: 'planning', created: Date.now(), plan: null };
    state.works.push(w);
    N.persist('works', true);
    state.workId = w.id;
    renderWork();
    runWork(w);
  }

  async function runWork(w) {
    var ctrl = new AbortController();
    running[w.id] = ctrl;
    var cfg = runConfig(w.model);
    var base = N.buildSystemPrompt(null, cfg.engine, null);
    async function ask(system, user, maxTokens) {
      var out = '';
      w.live = '';
      await Providers.stream({
        settings: cfg.settings, engine: cfg.engine, messages: [{ role: 'user', content: user }], system: system,
        signal: ctrl.signal, maxTokens: maxTokens,
        onDelta: function (d) { out += d; w.live = out; paint(w); },
        onReasoning: function (r) { w.live = (w.live || '') + r; paint(w); },
        onStatus: function (st) { if (st) { w.live = st; paint(w); } }
      });
      if (ctrl.signal.aborted) throw Object.assign(new Error('Gestoppt'), { name: 'AbortError' });
      w.live = '';
      return out;
    }
    var current = null;
    try {
      var planText = await ask(base + '\n\n' + PLAN_SYSTEM, 'Aufgabe: ' + w.task, 1500);
      w.plan = parsePlan(planText, w.task);
      w.status = 'running';
      N.persist('works', true);
      paint(w, true);
      var context = [];
      for (var i = 0; i < w.plan.steps.length; i++) {
        var s = current = w.plan.steps[i];
        s.status = 'running';
        paint(w, true);
        var prior = context.length ? '\n\nBisherige Ergebnisse:\n' + context.join('\n\n').slice(-12000) : '';
        var stepMsg = 'Gesamtaufgabe: ' + w.task + prior + '\n\nAktueller Schritt ' + (i + 1) + ' von ' + w.plan.steps.length + ': ' + s.title + (s.details ? ' – ' + s.details : '');
        var kind = KIND_OF[s.action];
        if (kind) {
          var raw = await ask(base + '\n\n' + Office.PROMPTS[kind], stepMsg + '\n\nNutze die bisherigen Ergebnisse als Inhalt.', 3500);
          var spec = Office.parse(kind, raw, s.title);
          s.file = { id: N.uid(), kind: kind, spec: spec, created: Date.now() };
          s.result = '';
          context.push('## ' + s.title + '\n[' + Office.META[kind].label + ' erstellt: ' + spec.title + ']\n' + Office.asText(s.file).slice(0, 3000));
        } else {
          s.result = await ask(base + '\n\nBearbeite genau diesen Schritt gründlich und konkret. Antworte in Markdown, ohne Vorrede.', stepMsg, 2000);
          context.push('## ' + s.title + '\n' + s.result);
        }
        s.status = 'done';
        N.persist('works', true);
        paint(w, true);
      }
      current = null;
      var files = allFiles(w).map(function (f) { return Office.fileName(f); });
      w.summary = await ask(base, 'Du hast diese Aufgabe erledigt: ' + w.task + '\n\nErgebnisse:\n' + context.join('\n\n').slice(-8000) +
        '\n\nSchreibe eine kurze Zusammenfassung (3 bis 6 Sätze oder Stichpunkte) für den Nutzer, was erledigt wurde' +
        (files.length ? ' und nenne die erstellten Dateien: ' + files.join(', ') : '') + '. Keine Rückfragen.', 700);
      w.status = 'done';
      if (state.view !== 'work' || state.workId !== w.id) toast('Work: „' + (w.plan.title || w.task).slice(0, 40) + '“ ist fertig.');
    } catch (e) {
      if (e.name === 'AbortError' || /abort/i.test(e.name || '')) {
        w.status = 'stopped';
        if (current) current.status = 'stopped';
      } else {
        w.status = 'error';
        w.error = Providers.friendlyError(e);
        if (current) { current.status = 'error'; current.error = w.error; }
      }
    } finally {
      delete running[w.id];
      w.live = '';
      N.persist('works', true);
      paint(w, true);
    }
  }

  Object.assign(N, { renderWork: renderWork, startWork: startWork });
})();
