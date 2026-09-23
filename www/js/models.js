/* Katalog der Offline-KI-Modelle (GGUF, laufen per llama.cpp/WebAssembly direkt auf dem Gerät).
 * "bundled": wird beim Bauen der App mitgeliefert und funktioniert sofort ohne Internet.
 * Alle anderen können in den Einstellungen einmalig heruntergeladen werden. */
(function () {
  'use strict';
  var HF = 'https://huggingface.co/';
  function hf(repo, file) { return HF + repo + '/resolve/main/' + file; }

  var list = [
    {
      id: 'qwen2.5-0.5b',
      name: 'Nova Mini',
      base: 'Qwen2.5 0.5B Instruct',
      desc: 'Klein und schnell, auch auf Handys. Einfache Fragen und kurze Texte.',
      file: 'qwen2.5-0.5b-instruct-q4_k_m.gguf',
      url: hf('Qwen/Qwen2.5-0.5B-Instruct-GGUF', 'qwen2.5-0.5b-instruct-q4_k_m.gguf'),
      sizeMB: null,
      bundled: true
    },
    {
      id: 'qwen2.5-1.5b',
      name: 'Nova',
      base: 'Qwen2.5 1.5B Instruct',
      desc: 'Deutlich bessere Antworten, gute Deutschkenntnisse. Empfohlen für neuere Handys und PCs.',
      file: 'qwen2.5-1.5b-instruct-q4_k_m.gguf',
      url: hf('Qwen/Qwen2.5-1.5B-Instruct-GGUF', 'qwen2.5-1.5b-instruct-q4_k_m.gguf'),
      sizeMB: null
    },
    {
      id: 'llama3.2-1b',
      name: 'Llama 3.2 1B',
      base: 'Meta Llama 3.2 1B Instruct',
      desc: 'Kompaktes Allround-Modell.',
      file: 'Llama-3.2-1B-Instruct-Q4_K_M.gguf',
      url: hf('bartowski/Llama-3.2-1B-Instruct-GGUF', 'Llama-3.2-1B-Instruct-Q4_K_M.gguf'),
      sizeMB: null
    },
    {
      id: 'gemma2-2b',
      name: 'Gemma 2 2B',
      base: 'Google Gemma 2 2B Instruct',
      desc: 'Gute Textqualität, braucht mehr Arbeitsspeicher.',
      file: 'gemma-2-2b-it-Q4_K_M.gguf',
      url: hf('bartowski/gemma-2-2b-it-GGUF', 'gemma-2-2b-it-Q4_K_M.gguf'),
      sizeMB: null
    },
    {
      id: 'qwen2.5-3b',
      name: 'Nova Pro',
      base: 'Qwen2.5 3B Instruct',
      desc: 'Beste Offline-Qualität. Für PCs mit mindestens 8 GB RAM.',
      file: 'qwen2.5-3b-instruct-q4_k_m.gguf',
      url: hf('Qwen/Qwen2.5-3B-Instruct-GGUF', 'qwen2.5-3b-instruct-q4_k_m.gguf'),
      sizeMB: null
    }
  ];

  window.ModelCatalog = {
    list: list,
    get: function (id) { return list.find(function (m) { return m.id === id; }) || null; },
    bundled: function () { return list.find(function (m) { return m.bundled; }) || null; }
  };
})();
