/* Offline-KI: llama.cpp (wllama, WebAssembly) direkt auf dem Gerät.
 * - Mitgeliefertes Modell: www/models/<datei>.gguf (siehe models/manifest.json)
 * - Weitere Modelle: einmalig herunterladen, werden im App-Speicher (OPFS) abgelegt
 * Nach dem Laden funktioniert alles ohne Internet. */
(function () {
  'use strict';

  var Catalog = window.ModelCatalog;
  var mod = null;
  var wllama = null;
  var loadedId = null;
  var loadedGpu = false;
  var loading = null;
  var bundledList = null;
  var installedCache = {};
  var listeners = [];

  var quietLogger = {
    debug: function () {}, log: function () {},
    warn: function () {}, error: function () { console.error.apply(console, arguments); }
  };

  function abs(p) { return new URL(p, location.href).href; }
  function emit() { listeners.forEach(function (fn) { try { fn(); } catch (e) { /* ignorieren */ } }); }

  function supported() {
    return typeof WebAssembly === 'object' && typeof Worker === 'function';
  }

  async function lib() {
    if (!mod) mod = await import(abs('vendor/wllama/index.js'));
    return mod;
  }

  async function instance() {
    if (wllama) return wllama;
    var m = await lib();
    wllama = new m.Wllama({ default: abs('vendor/wllama/wllama.wasm') }, {
      suppressNativeLog: true,
      allowOffline: true,
      parallelDownloads: 3,
      logger: quietLogger
    });
    // Keine Kompatibilitäts-Dateien aus dem Internet nachladen
    try { wllama.setCompat(null); } catch (e) { /* ältere Version */ }
    return wllama;
  }

  async function bundled() {
    if (bundledList) return bundledList;
    try {
      var r = await fetch('models/manifest.json', { cache: 'no-store' });
      bundledList = r.ok ? ((await r.json()).bundled || []) : [];
    } catch (e) { bundledList = []; }
    return bundledList;
  }

  /** Liste der installierten Modelle: { id: { source: 'bundled'|'download', size, model? } } */
  async function refresh() {
    var res = {};
    (await bundled()).forEach(function (b) { res[b.id] = { source: 'bundled', size: b.size }; });
    if (supported()) {
      try {
        var w = await instance();
        var models = await w.modelManager.getModels();
        models.forEach(function (m) {
          var c = Catalog.list.find(function (x) { return x.url === m.url; });
          var valid = typeof m.validate !== 'function' || m.validate() === 'valid';
          if (c && valid && m.size > 0 && !res[c.id]) res[c.id] = { source: 'download', size: m.size, model: m };
        });
      } catch (e) { console.warn('Offline-Modelle konnten nicht gelesen werden', e); }
    }
    installedCache = res;
    emit();
    return res;
  }

  function installedSync() { return installedCache; }
  function isInstalled(id) { return !!installedCache[id]; }

  async function download(id, onProgress, signal) {
    var c = Catalog.get(id);
    if (!c) throw new Error('Unbekanntes Modell');
    var w = await instance();
    try { if (navigator.storage && navigator.storage.persist) await navigator.storage.persist(); } catch (e) { /* optional */ }
    await w.modelManager.downloadModel(c.url, {
      signal: signal,
      progressCallback: function (p) { if (onProgress) onProgress(p.loaded, p.total || c.bytes); }
    });
    await refresh();
  }

  async function remove(id) {
    var info = installedCache[id];
    if (!info || info.source !== 'download') return;
    if (loadedId === id) await unload();
    await info.model.remove();
    await refresh();
  }

  async function unload() {
    if (wllama) {
      try { await wllama.exit(); } catch (e) { /* ignorieren */ }
    }
    wllama = null;
    loadedId = null;
    emit();
  }

  async function load(id, opts) {
    opts = opts || {};
    var useGpu = opts.gpu !== false;
    if (loadedId === id && loadedGpu === useGpu && wllama && wllama.isModelLoaded()) return;
    if (loading) { try { await loading; } catch (e) { /* neu versuchen */ } }
    if (loadedId === id && loadedGpu === useGpu && wllama && wllama.isModelLoaded()) return;

    loading = (async function () {
      if (wllama && wllama.isModelLoaded()) await unload();
      if (!Object.keys(installedCache).length) await refresh();
      var c = Catalog.get(id);
      var info = installedCache[id];
      if (!c || !info) throw new Error('Das Offline-Modell „' + (c ? c.name : id) + '“ ist nicht installiert.');
      var status = opts.onStatus || function () {};
      status('Offline-KI wird geladen …');

      async function attempt(gpu) {
        var w = await instance();
        var params = { n_ctx: c.ctx || 4096, n_batch: 512, skip_chat_parsing: true };
        if (!gpu) params.n_gpu_layers = 0;
        if (info.source === 'bundled') {
          var r = await fetch('models/' + c.file);
          if (!r.ok) throw new Error('Mitgeliefertes Modell nicht gefunden (HTTP ' + r.status + ')');
          var blob = await r.blob();
          await w.loadModel([new File([blob], c.file)], params);
        } else {
          await w.loadModel(info.model, params);
        }
      }

      try {
        await attempt(useGpu);
        loadedGpu = useGpu;
      } catch (e) {
        if (!useGpu) throw e;
        // WebGPU kann auf manchen Geräten fehlschlagen -> ohne Grafikkarte erneut
        console.warn('Laden mit Grafikkarte fehlgeschlagen, versuche CPU', e);
        await unload();
        await attempt(false);
        loadedGpu = false;
      }
      loadedId = id;
      emit();
    })();

    try { await loading; } finally { loading = null; }
  }

  /** Grobe Token-Schätzung (ca. 3 Zeichen je Token) und Kürzen des Verlaufs auf das Kontextfenster. */
  function fitHistory(system, messages, budgetTokens) {
    var est = function (s) { return Math.ceil(String(s || '').length / 3); };
    var used = est(system) + 16;
    var out = [];
    for (var i = messages.length - 1; i >= 0; i--) {
      var m = messages[i];
      var t = est(m.content) + 8;
      if (used + t > budgetTokens) {
        if (!out.length) {
          // letzte Nachricht notfalls kürzen
          var keep = Math.max(200, (budgetTokens - used) * 3);
          out.unshift({ role: m.role, content: String(m.content).slice(-keep) });
        }
        break;
      }
      used += t;
      out.unshift({ role: m.role, content: m.content });
    }
    while (out.length && out[0].role !== 'user') out.shift();
    if (system) out.unshift({ role: 'system', content: system });
    return out;
  }

  /**
   * opts: { modelId, messages:[{role, content}], system, signal, onDelta, onReasoning, onStatus, maxTokens, temperature, gpu }
   */
  async function chat(opts) {
    if (!supported()) throw new Error('Dieses Gerät unterstützt WebAssembly nicht.');
    await load(opts.modelId, { onStatus: opts.onStatus, gpu: opts.gpu });
    if (opts.signal && opts.signal.aborted) return '';
    var c = Catalog.get(opts.modelId);
    var maxTokens = opts.maxTokens || 1024;
    var messages = fitHistory(opts.system, opts.messages, (c.ctx || 4096) - maxTokens - 64);
    if (opts.onStatus) opts.onStatus(null);
    var full = '';
    await wllama.createChatCompletion({
      messages: messages,
      stream: true,
      max_tokens: maxTokens,
      temperature: opts.temperature != null ? opts.temperature : 0.2,
      top_p: 0.9,
      abortSignal: opts.signal,
      onData: function (chunk) {
        var d = chunk && chunk.choices && chunk.choices[0] && chunk.choices[0].delta;
        if (!d) return;
        if (d.reasoning_content && opts.onReasoning) opts.onReasoning(d.reasoning_content);
        if (d.content) { full += d.content; opts.onDelta(d.content); }
      }
    });
    return full;
  }

  function info() {
    return {
      loadedId: loadedId,
      gpu: loadedGpu,
      multithread: !!(wllama && wllama.isModelLoaded() && wllama.isMultithread && wllama.isMultithread()),
      threads: wllama && wllama.isModelLoaded() && wllama.getNumThreads ? wllama.getNumThreads() : 0,
      webgpu: typeof navigator !== 'undefined' && !!navigator.gpu
    };
  }

  window.LocalAI = {
    supported: supported,
    refresh: refresh,
    installed: installedSync,
    isInstalled: isInstalled,
    download: download,
    remove: remove,
    load: load,
    unload: unload,
    chat: chat,
    info: info,
    onChange: function (fn) { listeners.push(fn); }
  };
})();
