/* Katalog der Offline-KI-Modelle (GGUF, laufen per llama.cpp/WebAssembly direkt auf dem Gerät).
 * "bundled": wird beim Bauen der App mitgeliefert und funktioniert sofort ohne Internet.
 * Alle anderen können in den Einstellungen einmalig heruntergeladen werden.
 * Dateigrößen am 23.09.2026 per GitHub Actions geprüft. */
(function () {
  'use strict';
  var HF = 'https://huggingface.co/';
  function hf(repo, file) { return HF + repo + '/resolve/main/' + file; }

  var list = [
    {
      id: 'qwen2.5-0.5b',
      name: 'Nova Mini',
      base: 'Qwen2.5 0.5B Instruct (Q4_K_M)',
      desc: 'Klein und schnell, läuft auch auf Handys. Für einfache Fragen und kurze Texte.',
      file: 'qwen2.5-0.5b-instruct-q4_k_m.gguf',
      url: hf('Qwen/Qwen2.5-0.5B-Instruct-GGUF', 'qwen2.5-0.5b-instruct-q4_k_m.gguf'),
      bytes: 491400032,
      ctx: 4096,
      bundled: true
    },
    {
      id: 'qwen2.5-1.5b',
      name: 'Nova',
      base: 'Qwen2.5 1.5B Instruct (Q4_K_M)',
      desc: 'Deutlich bessere Antworten und gutes Deutsch. Empfohlen für PCs und neuere Handys.',
      file: 'qwen2.5-1.5b-instruct-q4_k_m.gguf',
      url: hf('Qwen/Qwen2.5-1.5B-Instruct-GGUF', 'qwen2.5-1.5b-instruct-q4_k_m.gguf'),
      bytes: 1117320736,
      ctx: 4096
    },
    {
      id: 'llama3.2-1b',
      name: 'Llama 3.2 1B',
      base: 'Meta Llama 3.2 1B Instruct (Q4_K_M)',
      desc: 'Kompaktes Allround-Modell.',
      file: 'Llama-3.2-1B-Instruct-Q4_K_M.gguf',
      url: hf('bartowski/Llama-3.2-1B-Instruct-GGUF', 'Llama-3.2-1B-Instruct-Q4_K_M.gguf'),
      bytes: 807694464,
      ctx: 4096
    },
    {
      id: 'gemma2-2b',
      name: 'Gemma 2 2B',
      base: 'Google Gemma 2 2B Instruct (Q4_K_M)',
      desc: 'Beste Textqualität der Offline-Modelle. Für PCs mit mindestens 8 GB RAM.',
      file: 'gemma-2-2b-it-Q4_K_M.gguf',
      url: hf('bartowski/gemma-2-2b-it-GGUF', 'gemma-2-2b-it-Q4_K_M.gguf'),
      bytes: 1708582752,
      ctx: 2048
    }
  ];

  window.ModelCatalog = {
    list: list,
    get: function (id) { return list.find(function (m) { return m.id === id; }) || null; },
    bundled: function () { return list.find(function (m) { return m.bundled; }) || null; },
    formatSize: function (bytes) {
      if (!bytes) return '';
      return bytes >= 1e9 ? (bytes / 1e9).toFixed(1).replace('.', ',') + ' GB' : Math.round(bytes / 1e6) + ' MB';
    }
  };
})();
