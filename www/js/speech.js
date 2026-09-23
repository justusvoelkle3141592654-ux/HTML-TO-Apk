/* Sprache: Spracherkennung (Diktieren/Sprachmodus) und Vorlesen.
 * Android-App: native Plugins (@capacitor-community/speech-recognition, text-to-speech)
 * Browser: Web Speech API. Desktop (Electron): nur Vorlesen, Spracherkennung wird dort nicht angeboten. */
(function () {
  'use strict';

  var cap = window.Capacitor;
  var isNative = !!(cap && cap.isNativePlatform && cap.isNativePlatform());
  var isElectron = /Electron/i.test(navigator.userAgent);
  var plugins = (cap && cap.Plugins) || {};
  var NativeSR = isNative ? plugins.SpeechRecognition : null;
  var NativeTTS = isNative ? plugins.TextToSpeech : null;
  var WebSR = window.SpeechRecognition || window.webkitSpeechRecognition;

  function canListen() {
    if (NativeSR) return true;
    return !!WebSR && !isElectron;
  }
  function canSpeak() {
    if (NativeTTS) return true;
    return 'speechSynthesis' in window;
  }

  /** Text für die Sprachausgabe von Markdown befreien. */
  function plain(text) {
    return String(text || '')
      .replace(/```[\s\S]*?```/g, ' (Codeblock) ')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/^\s*[#>|-]+\s*/gm, '')
      .replace(/[*_~|]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Zuhören. opts: { lang, continuous, onPartial(text), onFinal(text), onEnd(), onError(msg) }
   * Rückgabe: { stop() }
   */
  function listen(opts) {
    opts = opts || {};
    var lang = opts.lang || 'de-DE';
    var ended = false;
    function end() { if (!ended) { ended = true; opts.onEnd && opts.onEnd(); } }

    if (NativeSR) {
      var handles = [];
      var last = '';
      var stopped = false;
      (async function () {
        try {
          var av = await NativeSR.available();
          if (!av.available) throw new Error('Spracherkennung ist auf diesem Gerät nicht verfügbar.');
          var perm = await NativeSR.checkPermissions();
          if (perm.speechRecognition !== 'granted') perm = await NativeSR.requestPermissions();
          if (perm.speechRecognition !== 'granted') throw new Error('Mikrofonzugriff verweigert.');
          handles.push(await NativeSR.addListener('partialResults', function (d) {
            if (d && d.matches && d.matches[0]) { last = d.matches[0]; opts.onPartial && opts.onPartial(last); }
          }));
          handles.push(await NativeSR.addListener('listeningState', function (d) {
            if (d && d.status === 'stopped') {
              if (last) opts.onFinal && opts.onFinal(last);
              cleanup();
            }
          }));
          if (stopped) return cleanup();
          await NativeSR.start({ language: lang, maxResults: 1, partialResults: true, popup: false });
        } catch (e) {
          opts.onError && opts.onError(e.message || String(e));
          cleanup();
        }
      })();
      function cleanup() {
        handles.forEach(function (h) { try { h.remove(); } catch (e) { /* ignorieren */ } });
        handles = [];
        end();
      }
      return {
        stop: function () {
          stopped = true;
          NativeSR.stop().catch(function () {});
        }
      };
    }

    if (!WebSR || isElectron) {
      setTimeout(function () { opts.onError && opts.onError('Spracherkennung wird hier nicht unterstützt.'); end(); });
      return { stop: function () {} };
    }
    var rec = new WebSR();
    rec.lang = lang;
    rec.interimResults = true;
    rec.continuous = !!opts.continuous;
    var finalText = '';
    rec.onresult = function (e) {
      var interim = '';
      finalText = '';
      for (var i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalText += e.results[i][0].transcript;
        else interim += e.results[i][0].transcript;
      }
      opts.onPartial && opts.onPartial(finalText + interim);
    };
    rec.onerror = function (e) {
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      opts.onError && opts.onError(e.error === 'not-allowed' ? 'Mikrofonzugriff verweigert.' :
        e.error === 'network' ? 'Spracherkennung braucht eine Internetverbindung.' : 'Spracherkennung: ' + e.error);
    };
    rec.onend = function () {
      if (finalText) opts.onFinal && opts.onFinal(finalText);
      end();
    };
    try { rec.start(); } catch (e) { setTimeout(function () { opts.onError && opts.onError('Spracherkennung konnte nicht starten.'); end(); }); }
    return { stop: function () { try { rec.stop(); } catch (e) { /* ignorieren */ } } };
  }

  var speaking = false;
  /** Vorlesen; Promise wird erfüllt, wenn fertig oder abgebrochen. */
  function speak(text, opts) {
    opts = opts || {};
    var t = plain(text);
    if (!t) return Promise.resolve();
    stopSpeaking();
    speaking = true;
    if (NativeTTS) {
      return NativeTTS.speak({ text: t, lang: opts.lang || 'de-DE', rate: opts.rate || 1.0 })
        .catch(function () {}).then(function () { speaking = false; });
    }
    return new Promise(function (resolve) {
      var synth = window.speechSynthesis;
      var u = new SpeechSynthesisUtterance(t);
      u.lang = opts.lang || 'de-DE';
      u.rate = opts.rate || 1.0;
      var voices = synth.getVoices().filter(function (v) { return /^de/i.test(v.lang); });
      if (voices.length) u.voice = voices.find(function (v) { return /google|natural|online/i.test(v.name); }) || voices[0];
      u.onend = u.onerror = function () { speaking = false; resolve(); };
      synth.speak(u);
    });
  }
  function stopSpeaking() {
    speaking = false;
    if (NativeTTS) { NativeTTS.stop().catch(function () {}); return; }
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }

  window.Speech = {
    canListen: canListen,
    canSpeak: canSpeak,
    listen: listen,
    speak: speak,
    stopSpeaking: stopSpeaking,
    isSpeaking: function () { return speaking; },
    plain: plain
  };
})();
