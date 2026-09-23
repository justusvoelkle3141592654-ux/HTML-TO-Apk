/* KI-Quellen
 *  - free:   kostenlose Online-KI ohne Anmeldung (Pollinations.ai, Modell GPT-OSS 20B)
 *  - custom: eigener API-Schlüssel (OpenAI-kompatibel: OpenAI, Gemini, Mistral, Groq, OpenRouter,
 *            DeepSeek, xAI, Ollama, LM Studio … oder Anthropic)
 *  - local:  Offline-KI direkt auf dem Gerät (llama.cpp / wllama)
 *  - basic:  eingebauter Notfall-Assistent ohne KI (Rechnen, Vorlagen …)
 *  - auto:   online → eigener Schlüssel oder kostenlos; offline → Offline-KI */
(function () {
  'use strict';

  var FREE = {
    name: 'Nova Online',
    detail: 'GPT-OSS 20B · kostenlos über Pollinations.ai',
    chatUrl: 'https://text.pollinations.ai/openai',
    model: 'openai',
    imageUrl: 'https://image.pollinations.ai/prompt/'
  };

  // Geprüft am 23.09.2026 (siehe .github/workflows/verify-endpoints.yml)
  var PRESETS = [
    { id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', keyUrl: 'https://platform.openai.com/api-keys' },
    { id: 'gemini', name: 'Google Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', keyUrl: 'https://aistudio.google.com/apikey' },
    { id: 'mistral', name: 'Mistral', baseUrl: 'https://api.mistral.ai/v1', keyUrl: 'https://console.mistral.ai/api-keys' },
    { id: 'groq', name: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', keyUrl: 'https://console.groq.com/keys' },
    { id: 'openrouter', name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', keyUrl: 'https://openrouter.ai/keys' },
    { id: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', keyUrl: 'https://platform.deepseek.com/api_keys' },
    { id: 'xai', name: 'xAI (Grok)', baseUrl: 'https://api.x.ai/v1', keyUrl: 'https://console.x.ai' },
    { id: 'ollama', name: 'Ollama (lokal)', baseUrl: 'http://localhost:11434/v1', keyUrl: 'https://ollama.com/download', local: true },
    { id: 'lmstudio', name: 'LM Studio (lokal)', baseUrl: 'http://localhost:1234/v1', keyUrl: 'https://lmstudio.ai', local: true }
  ];

  var LOCAL_HOST = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i;

  function isLocalEndpoint(s) {
    return s.provider === 'openai' && LOCAL_HOST.test(s.openai.baseUrl || '');
  }
  function customConfigured(s) {
    if (s.provider === 'anthropic') return !!(s.anthropic.apiKey && s.anthropic.model);
    return !!(s.openai.baseUrl && s.openai.model);
  }
  function localModelId(s) {
    var inst = window.LocalAI ? window.LocalAI.installed() : {};
    if (s.localModel && inst[s.localModel]) return s.localModel;
    var ids = Object.keys(inst);
    return ids.length ? ids[0] : null;
  }

  /** Welche Quelle wird für die nächste Anfrage tatsächlich verwendet? */
  function resolve(s) {
    var online = navigator.onLine;
    var customOk = customConfigured(s) && (online || isLocalEndpoint(s));
    var local = localModelId(s);
    var offlineFallback = local ? 'local' : 'basic';
    switch (s.engine) {
      case 'free': return online ? 'free' : offlineFallback;
      case 'custom': return customOk ? 'custom' : (online ? 'free' : offlineFallback);
      case 'local': return offlineFallback;
      case 'basic': return 'basic';
      default:
        if (customOk) return 'custom';
        if (online) return 'free';
        return offlineFallback;
    }
  }

  function customLabel(s) {
    return s.provider === 'anthropic' ? s.anthropic.model : s.openai.model;
  }

  function label(s, engine) {
    engine = engine || resolve(s);
    if (engine === 'free') return FREE.name;
    if (engine === 'custom') return customLabel(s);
    if (engine === 'local') {
      var m = window.ModelCatalog.get(localModelId(s));
      return m ? m.name + ' (offline)' : 'Offline-KI';
    }
    return 'Basis (ohne KI)';
  }

  // ---------- Hilfen ----------
  async function readSSE(res, onEvent, signal) {
    var reader = res.body.getReader();
    var dec = new TextDecoder();
    var buf = '';
    try {
      while (true) {
        if (signal && signal.aborted) break;
        var r = await reader.read();
        if (r.done) break;
        buf += dec.decode(r.value, { stream: true });
        var idx;
        while ((idx = buf.indexOf('\n')) >= 0) {
          var line = buf.slice(0, idx).replace(/\r$/, '');
          buf = buf.slice(idx + 1);
          if (line.indexOf('data:') !== 0) continue;
          var data = line.slice(5).trim();
          if (!data) continue;
          if (data === '[DONE]') return;
          var json;
          try { json = JSON.parse(data); } catch (e) { continue; }
          onEvent(json);
        }
      }
    } finally {
      try { reader.releaseLock(); } catch (e) { /* ignorieren */ }
    }
  }

  async function errorFromResponse(res) {
    var text = '';
    try { text = await res.text(); } catch (e) { /* ignorieren */ }
    var msg = text;
    try {
      var j = JSON.parse(text);
      var e0 = Array.isArray(j) ? j[0] : j;
      msg = (e0.error && (e0.error.message || e0.error.type || e0.error)) || e0.message || e0.detail || text;
      if (typeof msg !== 'string') msg = JSON.stringify(msg);
    } catch (e) { /* kein JSON */ }
    var hint = '';
    if (res.status === 401 || res.status === 403) hint = ' – API-Schlüssel prüfen.';
    else if (res.status === 404) hint = ' – Basis-URL oder Modellname prüfen.';
    else if (res.status === 429) hint = ' – Zu viele Anfragen oder Guthaben aufgebraucht. Bitte kurz warten.';
    var err = new Error('HTTP ' + res.status + ': ' + String(msg || res.statusText).slice(0, 400) + hint);
    err.status = res.status;
    return err;
  }

  function textWithFiles(m) {
    var out = m.content || '';
    (m.attachments || []).forEach(function (a) {
      if (a.kind === 'text') out += '\n\n[Datei: ' + a.name + ']\n```\n' + a.data + '\n```';
      else if (a.kind === 'file') out += '\n\n[Angehängte Datei: ' + a.name + ' (Inhalt nicht lesbar)]';
      else if (a.kind === 'image' && m._noVision) out += '\n\n[Bild angehängt: ' + a.name + ' – dieses Modell kann keine Bilder sehen]';
    });
    return out;
  }

  function toOpenAI(messages, system, vision) {
    var out = [];
    if (system) out.push({ role: 'system', content: system });
    messages.forEach(function (m) {
      var imgs = vision ? (m.attachments || []).filter(function (a) { return a.kind === 'image'; }) : [];
      var text = textWithFiles(vision ? m : Object.assign({}, m, { _noVision: true }));
      if (m.role === 'user' && imgs.length) {
        var parts = [{ type: 'text', text: text || 'Bitte sieh dir das Bild an.' }];
        imgs.forEach(function (a) { parts.push({ type: 'image_url', image_url: { url: a.data } }); });
        out.push({ role: 'user', content: parts });
      } else {
        out.push({ role: m.role, content: text });
      }
    });
    return out;
  }

  function toAnthropic(messages) {
    var out = [];
    messages.forEach(function (m) {
      var text = textWithFiles(m);
      var imgs = (m.attachments || []).filter(function (a) { return a.kind === 'image'; });
      var content;
      if (m.role === 'user' && imgs.length) {
        content = imgs.map(function (a) {
          var mm = /^data:([^;]+);base64,(.*)$/.exec(a.data) || [];
          return { type: 'image', source: { type: 'base64', media_type: mm[1] || 'image/jpeg', data: mm[2] || '' } };
        });
        content.push({ type: 'text', text: text || 'Bitte sieh dir das Bild an.' });
      } else {
        content = text || '…';
      }
      var prev = out[out.length - 1];
      if (prev && prev.role === m.role && typeof prev.content === 'string' && typeof content === 'string') {
        prev.content += '\n\n' + content;
      } else {
        out.push({ role: m.role, content: content });
      }
    });
    while (out.length && out[0].role !== 'user') out.shift();
    return out;
  }

  // ---------- Streaming: OpenAI-kompatibel ----------
  async function streamOpenAICompat(url, headers, body, opts) {
    var res = await fetch(url, { method: 'POST', headers: headers, body: JSON.stringify(body), signal: opts.signal });
    if (!res.ok) throw await errorFromResponse(res);
    var full = '';
    var ct = res.headers.get('content-type') || '';
    if (ct.indexOf('text/event-stream') < 0 && ct.indexOf('json') >= 0) {
      var j = await res.json();
      var msg = j.choices && j.choices[0] && j.choices[0].message;
      if (msg && (msg.reasoning || msg.reasoning_content) && opts.onReasoning) opts.onReasoning(msg.reasoning || msg.reasoning_content);
      full = (msg && msg.content) || '';
      opts.onDelta(full);
      return full;
    }
    await readSSE(res, function (ev) {
      if (ev.error) throw new Error(ev.error.message || JSON.stringify(ev.error));
      var d = ev.choices && ev.choices[0] && ev.choices[0].delta;
      if (!d) return;
      var r = d.reasoning || d.reasoning_content;
      if (r && opts.onReasoning) opts.onReasoning(r);
      if (typeof d.content === 'string' && d.content) { full += d.content; opts.onDelta(d.content); }
    }, opts.signal);
    return full;
  }

  function streamFree(opts) {
    return streamOpenAICompat(FREE.chatUrl, { 'Content-Type': 'application/json' }, {
      model: FREE.model,
      messages: toOpenAI(opts.messages, opts.system, false),
      stream: true
    }, opts);
  }

  function streamCustomOpenAI(opts) {
    var s = opts.settings.openai;
    var headers = { 'Content-Type': 'application/json' };
    if (s.apiKey) headers.Authorization = 'Bearer ' + s.apiKey;
    var body = { model: s.model, messages: toOpenAI(opts.messages, opts.system, s.vision !== false), stream: true };
    if (s.temperature !== '' && s.temperature != null && !isNaN(parseFloat(s.temperature))) body.temperature = parseFloat(s.temperature);
    return streamOpenAICompat(s.baseUrl.replace(/\/+$/, '') + '/chat/completions', headers, body, opts);
  }

  async function streamAnthropic(opts) {
    var s = opts.settings.anthropic;
    var res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': s.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: s.model,
        max_tokens: parseInt(s.maxTokens, 10) || 8192,
        system: opts.system || undefined,
        messages: toAnthropic(opts.messages),
        stream: true
      }),
      signal: opts.signal
    });
    if (!res.ok) throw await errorFromResponse(res);
    var full = '';
    await readSSE(res, function (ev) {
      if (ev.type === 'error') throw new Error((ev.error && ev.error.message) || 'Unbekannter Fehler');
      if (ev.type === 'content_block_delta' && ev.delta) {
        if (ev.delta.type === 'text_delta') { full += ev.delta.text; opts.onDelta(ev.delta.text); }
        else if (ev.delta.type === 'thinking_delta' && opts.onReasoning) opts.onReasoning(ev.delta.thinking);
      }
    }, opts.signal);
    return full;
  }

  function streamLocal(opts) {
    var s = opts.settings;
    return window.LocalAI.chat({
      modelId: localModelId(s),
      system: opts.system,
      messages: opts.messages.map(function (m) { return { role: m.role, content: textWithFiles(Object.assign({}, m, { _noVision: true })) }; }),
      signal: opts.signal,
      onDelta: opts.onDelta,
      onReasoning: opts.onReasoning,
      onStatus: opts.onStatus,
      maxTokens: opts.maxTokens || 1024,
      temperature: s.local && s.local.temperature,
      gpu: !(s.local && s.local.gpu === false)
    });
  }

  function sleep(ms, signal) {
    return new Promise(function (resolve) {
      var t = setTimeout(resolve, ms);
      if (signal) signal.addEventListener('abort', function () { clearTimeout(t); resolve(); }, { once: true });
    });
  }

  async function streamText(text, opts) {
    var i = 0;
    await sleep(300, opts.signal);
    while (i < text.length) {
      if (opts.signal && opts.signal.aborted) break;
      var step = Math.max(2, Math.min(12, Math.round(text.length / 120)));
      opts.onDelta(text.slice(i, i + step));
      i += step;
      await sleep(14, opts.signal);
    }
    return text;
  }

  async function streamBasic(opts) {
    var last = opts.messages[opts.messages.length - 1] || {};
    if (opts.task === 'edit-document') {
      throw new Error('Zum Überarbeiten von Dokumenten wird eine KI gebraucht. Wähle oben eine Online- oder Offline-KI.');
    }
    var text = opts.task === 'document'
      ? window.OfflineAI.makeDocument(last.content || '')
      : window.OfflineAI.answer(last.content || '', { userName: opts.settings.userName, hasAttachments: (last.attachments || []).length > 0 });
    return streamText(text, opts);
  }

  /**
   * opts: { settings, engine?, messages, system, signal, onDelta, onReasoning, onStatus, task, maxTokens }
   * Rückgabe: vollständiger Text
   */
  async function stream(opts) {
    var engine = opts.engine || resolve(opts.settings);
    if (engine === 'free') return streamFree(opts);
    if (engine === 'custom') return opts.settings.provider === 'anthropic' ? streamAnthropic(opts) : streamCustomOpenAI(opts);
    if (engine === 'local') return streamLocal(opts);
    return streamBasic(opts);
  }

  /** Kurze Antwort ohne Streaming-Anzeige (z. B. Titel, Bild-Prompts). */
  async function complete(settings, prompt, opts) {
    opts = opts || {};
    var out = '';
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, opts.timeout || 20000);
    try {
      await stream({
        settings: settings, engine: opts.engine, messages: [{ role: 'user', content: prompt }],
        system: opts.system || '', signal: ctrl.signal, maxTokens: opts.maxTokens || 200,
        onDelta: function (d) { out += d; }
      });
    } finally { clearTimeout(timer); }
    return out.trim();
  }

  async function listModels(settings) {
    if (settings.provider === 'anthropic') {
      var r = await fetch('https://api.anthropic.com/v1/models?limit=100', {
        headers: { 'x-api-key': settings.anthropic.apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' }
      });
      if (!r.ok) throw await errorFromResponse(r);
      var j = await r.json();
      return (j.data || []).map(function (m) { return m.id; });
    }
    var base = (settings.openai.baseUrl || '').replace(/\/+$/, '');
    var headers = {};
    if (settings.openai.apiKey) headers.Authorization = 'Bearer ' + settings.openai.apiKey;
    var res = await fetch(base + '/models', { headers: headers });
    if (!res.ok) throw await errorFromResponse(res);
    var data = await res.json();
    var list = data.data || data.models || [];
    return list.map(function (m) { return (m.id || m.name || '').replace(/^models\//, ''); }).filter(Boolean).sort();
  }

  /** Bild-URL für die kostenlose Bildgenerierung (Pollinations.ai). */
  function imageUrl(prompt, o) {
    o = o || {};
    var seed = o.seed || Math.floor(Math.random() * 1e9);
    return FREE.imageUrl + encodeURIComponent(prompt) + '?width=' + (o.width || 1024) + '&height=' + (o.height || 1024) + '&nologo=true&seed=' + seed;
  }

  function friendlyError(e) {
    if (!e) return 'Unbekannter Fehler';
    if (e.name === 'TypeError' && /fetch|network|load/i.test(e.message)) {
      return 'Keine Verbindung zum Server möglich. Prüfe die Internetverbindung, die Basis-URL und ob der Dienst Anfragen aus Apps erlaubt. Bei Ollama/LM Studio: Läuft das Programm?';
    }
    return e.message || String(e);
  }

  window.Providers = {
    FREE: FREE,
    PRESETS: PRESETS,
    resolve: resolve,
    label: label,
    customLabel: customLabel,
    customConfigured: customConfigured,
    localModelId: localModelId,
    isLocalEndpoint: isLocalEndpoint,
    stream: stream,
    complete: complete,
    listModels: listModels,
    imageUrl: imageUrl,
    friendlyError: friendlyError
  };
})();
