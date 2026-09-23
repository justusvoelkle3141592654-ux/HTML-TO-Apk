/* KI-Anbieter: OpenAI-kompatible APIs (OpenAI, OpenRouter, Groq, Ollama, LM Studio …),
 * Anthropic und der eingebaute Offline-Assistent. Alle Antworten werden gestreamt. */
(function () {
  'use strict';

  var LOCAL_HOST = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i;

  function isLocalEndpoint(settings) {
    return settings.provider === 'openai' && LOCAL_HOST.test(settings.openai.baseUrl || '');
  }

  /** Welcher Anbieter wird gerade tatsächlich verwendet? */
  function active(settings) {
    if (settings.mode === 'offline') return 'offline';
    if (!navigator.onLine && !isLocalEndpoint(settings)) return 'offline';
    if (settings.provider === 'anthropic' && settings.anthropic.apiKey && settings.anthropic.model) return 'anthropic';
    if (settings.provider === 'openai' && settings.openai.baseUrl && settings.openai.model) return 'openai';
    return 'offline';
  }

  function label(settings) {
    var p = active(settings);
    if (p === 'anthropic') return settings.anthropic.model;
    if (p === 'openai') return settings.openai.model;
    return 'Offline';
  }

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
      msg = (j.error && (j.error.message || j.error.type || j.error)) || j.message || text;
      if (typeof msg !== 'string') msg = JSON.stringify(msg);
    } catch (e) { /* kein JSON */ }
    var hint = '';
    if (res.status === 401 || res.status === 403) hint = ' – API-Schlüssel prüfen.';
    else if (res.status === 404) hint = ' – Basis-URL oder Modellname prüfen.';
    else if (res.status === 429) hint = ' – Limit erreicht oder Guthaben aufgebraucht.';
    var err = new Error('HTTP ' + res.status + ': ' + (msg || res.statusText).slice(0, 400) + hint);
    err.status = res.status;
    return err;
  }

  // ---------- Nachrichten umwandeln ----------
  function textWithFiles(m) {
    var out = m.content || '';
    (m.attachments || []).forEach(function (a) {
      if (a.kind === 'text') out += '\n\n[Datei: ' + a.name + ']\n```\n' + a.data + '\n```';
      else if (a.kind === 'file') out += '\n\n[Angehängte Datei: ' + a.name + ' (Inhalt nicht lesbar)]';
    });
    return out;
  }

  function toOpenAI(messages, system) {
    var out = [];
    if (system) out.push({ role: 'system', content: system });
    messages.forEach(function (m) {
      var imgs = (m.attachments || []).filter(function (a) { return a.kind === 'image'; });
      var text = textWithFiles(m);
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
      // Aufeinanderfolgende gleiche Rollen zusammenführen (API verlangt Wechsel)
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

  // ---------- Anbieter ----------
  async function streamOpenAI(opts) {
    var s = opts.settings.openai;
    var base = s.baseUrl.replace(/\/+$/, '');
    var headers = { 'Content-Type': 'application/json' };
    if (s.apiKey) headers.Authorization = 'Bearer ' + s.apiKey;
    var body = { model: s.model, messages: toOpenAI(opts.messages, opts.system), stream: true };
    if (s.temperature !== '' && s.temperature != null && !isNaN(parseFloat(s.temperature))) body.temperature = parseFloat(s.temperature);
    var res = await fetch(base + '/chat/completions', { method: 'POST', headers: headers, body: JSON.stringify(body), signal: opts.signal });
    if (!res.ok) throw await errorFromResponse(res);
    var full = '';
    var ct = res.headers.get('content-type') || '';
    if (ct.indexOf('text/event-stream') < 0 && ct.indexOf('json') >= 0) {
      var j = await res.json();
      full = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '';
      opts.onDelta(full);
      return full;
    }
    await readSSE(res, function (ev) {
      if (ev.error) throw new Error(ev.error.message || JSON.stringify(ev.error));
      var d = ev.choices && ev.choices[0] && ev.choices[0].delta;
      if (d && typeof d.content === 'string' && d.content) { full += d.content; opts.onDelta(d.content); }
    }, opts.signal);
    return full;
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
      if (ev.type === 'content_block_delta' && ev.delta && ev.delta.type === 'text_delta') {
        full += ev.delta.text; opts.onDelta(ev.delta.text);
      }
    }, opts.signal);
    return full;
  }

  function sleep(ms, signal) {
    return new Promise(function (resolve) {
      var t = setTimeout(resolve, ms);
      if (signal) signal.addEventListener('abort', function () { clearTimeout(t); resolve(); }, { once: true });
    });
  }

  /** Simuliert Streaming für lokal erzeugten Text. */
  async function streamText(text, opts) {
    var i = 0;
    await sleep(350, opts.signal);
    while (i < text.length) {
      if (opts.signal && opts.signal.aborted) break;
      var step = Math.max(2, Math.min(12, Math.round(text.length / 120)));
      var chunk = text.slice(i, i + step);
      i += step;
      opts.onDelta(chunk);
      await sleep(14, opts.signal);
    }
    return text;
  }

  async function streamOffline(opts) {
    var last = opts.messages[opts.messages.length - 1] || {};
    var text;
    if (opts.task === 'document') text = window.OfflineAI.makeDocument(last.content || '');
    else if (opts.task === 'edit-document') {
      text = (opts.currentDoc || '') ;
      opts.onNotice && opts.onNotice('Dokumente mit KI überarbeiten geht nur mit einer KI-Verbindung (Einstellungen → KI-Verbindung).');
      return text;
    } else {
      text = window.OfflineAI.answer(last.content || '', {
        userName: opts.settings.userName,
        hasAttachments: (last.attachments || []).length > 0
      });
    }
    return streamText(text, opts);
  }

  /**
   * opts: { settings, messages:[{role,content,attachments}], system, signal, onDelta(text), task, currentDoc, onNotice }
   */
  async function stream(opts) {
    var p = active(opts.settings);
    if (p === 'anthropic') return streamAnthropic(opts);
    if (p === 'openai') return streamOpenAI(opts);
    return streamOffline(opts);
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
    return list.map(function (m) { return m.id || m.name; }).filter(Boolean).sort();
  }

  function friendlyError(e) {
    if (!e) return 'Unbekannter Fehler';
    if (e.name === 'TypeError' && /fetch|network|load/i.test(e.message)) {
      return 'Keine Verbindung zum Server möglich. Prüfe Internetverbindung, Basis-URL und ob der Dienst Anfragen aus Apps erlaubt (CORS). Bei Ollama: Läuft der Dienst?';
    }
    return e.message || String(e);
  }

  window.Providers = { stream: stream, active: active, label: label, listModels: listModels, friendlyError: friendlyError, isLocalEndpoint: isLocalEndpoint };
})();
