/* Eingebauter Offline-Assistent.
 * Ohne Verbindung zu einem echten KI-Modell beherrscht er nur einfache Aufgaben:
 * Begrüßung, Rechnen, Datum/Uhrzeit, Umrechnungen, Textstatistik und Dokumentvorlagen.
 * Für echte KI-Antworten: Einstellungen → KI-Verbindung. */
(function () {
  'use strict';

  function pad(n) { return String(n).padStart(2, '0'); }
  function today() { return new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  function fmtNum(n) {
    if (!isFinite(n)) return String(n);
    var r = Math.round(n * 1e8) / 1e8;
    return r.toLocaleString('de-DE', { maximumFractionDigits: Math.abs(r) >= 1 ? 6 : 8 });
  }

  // ---------- Sicherer Rechner (kein eval) ----------
  function evalMath(expr) {
    var s = expr.replace(/\s+/g, '').replace(/(\d)\.(?=\d{3}(\D|$))/g, '$1').replace(/,/g, '.')
      .replace(/[×x]/g, '*').replace(/[÷:]/g, '/').replace(/²/g, '^2').replace(/³/g, '^3');
    var pos = 0;
    function peek() { return s[pos]; }
    function expr_() {
      var v = term();
      while (peek() === '+' || peek() === '-') { var op = s[pos++]; var r = term(); v = op === '+' ? v + r : v - r; }
      return v;
    }
    function term() {
      var v = power();
      while (peek() === '*' || peek() === '/' || peek() === '%') {
        var op = s[pos++]; var r = power();
        v = op === '*' ? v * r : op === '/' ? v / r : v % r;
      }
      return v;
    }
    function power() {
      var b = unary();
      if (peek() === '^') { pos++; return Math.pow(b, power()); }
      return b;
    }
    function unary() {
      if (peek() === '-') { pos++; return -unary(); }
      if (peek() === '+') { pos++; return unary(); }
      return primary();
    }
    function primary() {
      if (s.slice(pos, pos + 4) === 'sqrt' || s.slice(pos, pos + 1) === '√') {
        pos += s[pos] === '√' ? 1 : 4;
        return Math.sqrt(primary());
      }
      if (peek() === '(') { pos++; var v = expr_(); if (peek() !== ')') throw new Error('Klammer'); pos++; return v; }
      var m = /^\d+(\.\d+)?/.exec(s.slice(pos));
      if (!m) throw new Error('Zahl erwartet');
      pos += m[0].length;
      return parseFloat(m[0]);
    }
    var v = expr_();
    if (pos !== s.length) throw new Error('Unerwartetes Zeichen');
    return v;
  }

  function tryMath(text) {
    var t = text.toLowerCase()
      .replace(/^(was|wieviel|wie viel)\s+(ist|ergibt|sind|macht)\s+/, '')
      .replace(/^(berechne|rechne|rechne aus|calculate|what is)\s*:?\s*/, '')
      .replace(/\bmal\b/g, '*').replace(/\bgeteilt durch\b/g, '/').replace(/\bdurch\b/g, '/')
      .replace(/\bplus\b/g, '+').replace(/\bminus\b/g, '-').replace(/\bhoch\b/g, '^')
      .replace(/\bwurzel\s*(aus|von)?\s*/g, 'sqrt')
      .replace(/[?=!]+\s*$/, '').trim();
    var pct = /^(\d+(?:[.,]\d+)?)\s*(%|prozent)\s*(von|of)\s*(\d+(?:[.,]\d+)?)$/.exec(t);
    if (pct) {
      var p = parseFloat(pct[1].replace(',', '.')), b = parseFloat(pct[4].replace(',', '.'));
      return pct[1] + ' % von ' + pct[4] + ' = **' + fmtNum(p / 100 * b) + '**';
    }
    if (!/\d/.test(t) || !/^[\d\s+\-*/().,^%×÷:x²³√sqrt]+$/.test(t) || !/[+\-*/^%×÷:x²³√]|sqrt/.test(t)) return null;
    try {
      var v = evalMath(t);
      if (typeof v !== 'number' || isNaN(v)) return null;
      return '`' + t + '` = **' + fmtNum(v) + '**';
    } catch (e) { return null; }
  }

  // ---------- Umrechnungen ----------
  var UNITS = {
    km: ['m', 1000], m: ['m', 1], cm: ['m', 0.01], mm: ['m', 0.001], mi: ['m', 1609.344], meile: ['m', 1609.344], meilen: ['m', 1609.344],
    ft: ['m', 0.3048], fuß: ['m', 0.3048], zoll: ['m', 0.0254], inch: ['m', 0.0254], zoll_: ['m', 0.0254],
    kg: ['g', 1000], g: ['g', 1], mg: ['g', 0.001], t: ['g', 1e6], lb: ['g', 453.59237], pfund: ['g', 500],
    l: ['l', 1], liter: ['l', 1], ml: ['l', 0.001], gallone: ['l', 3.785411784], gallonen: ['l', 3.785411784]
  };
  function tryConvert(text) {
    var m = /(-?\d+(?:[.,]\d+)?)\s*([a-zäöüß°]+)\s+(?:in|nach|zu|to)\s+([a-zäöüß°]+)/i.exec(text);
    if (!m) return null;
    var v = parseFloat(m[1].replace(',', '.')), a = m[2].toLowerCase(), b = m[3].toLowerCase();
    var tMap = { c: 'c', '°c': 'c', celsius: 'c', f: 'f', '°f': 'f', fahrenheit: 'f', k: 'k', kelvin: 'k' };
    if (tMap[a] && tMap[b]) {
      var c = tMap[a] === 'c' ? v : tMap[a] === 'f' ? (v - 32) * 5 / 9 : v - 273.15;
      var r = tMap[b] === 'c' ? c : tMap[b] === 'f' ? c * 9 / 5 + 32 : c + 273.15;
      var name = { c: '°C', f: '°F', k: 'K' };
      return fmtNum(v) + ' ' + name[tMap[a]] + ' = **' + fmtNum(r) + ' ' + name[tMap[b]] + '**';
    }
    if (UNITS[a] && UNITS[b] && UNITS[a][0] === UNITS[b][0]) {
      return fmtNum(v) + ' ' + m[2] + ' = **' + fmtNum(v * UNITS[a][1] / UNITS[b][1]) + ' ' + m[3] + '**';
    }
    return null;
  }

  // ---------- Dokumentvorlagen ----------
  function extractTopic(text) {
    var m = /(?:über|zum thema|zu dem thema|thema|zu|für|about|on)\s+(?:das |die |den |dem |eine[nm]? )?(.+?)[.?!]*$/i.exec(text);
    var t = m ? m[1] : '';
    return t.replace(/^["„']|["“']$/g, '').trim();
  }

  var TEMPLATES = [
    {
      re: /bewerbung|anschreiben/i, make: function (topic) {
        return '# Bewerbung als ' + (topic || '[Position]') + '\n\n[Dein Name]  \n[Straße Hausnummer]  \n[PLZ Ort]  \n[E-Mail] · [Telefon]\n\n' +
          '[Firma]  \nz. Hd. [Ansprechpartner]  \n[Straße Hausnummer]  \n[PLZ Ort]\n\n' + '[Ort], ' + today() + '\n\n' +
          '**Bewerbung als ' + (topic || '[Position]') + '**\n\nSehr geehrte Damen und Herren,\n\n' +
          'mit großem Interesse habe ich Ihre Stellenausschreibung gelesen. [Warum dich die Stelle anspricht.]\n\n' +
          '[Deine relevante Erfahrung und Qualifikationen – mit konkreten Beispielen.]\n\n' +
          '[Was du dem Unternehmen bietest und warum du gut ins Team passt.]\n\n' +
          'Über die Einladung zu einem persönlichen Gespräch freue ich mich sehr.\n\nMit freundlichen Grüßen\n\n[Dein Name]\n\n' +
          '**Anlagen:** Lebenslauf, Zeugnisse';
      }
    },
    {
      re: /lebenslauf|\bcv\b/i, make: function () {
        return '# Lebenslauf\n\n## Persönliche Daten\n\n| | |\n|---|---|\n| Name | [Vorname Nachname] |\n| Anschrift | [Straße, PLZ Ort] |\n| Telefon | [Nummer] |\n| E-Mail | [Adresse] |\n| Geburtsdatum | [TT.MM.JJJJ] |\n\n' +
          '## Berufserfahrung\n\n**[MM/JJJJ] – heute** · [Position], [Firma]\n- [Aufgabe / Erfolg]\n- [Aufgabe / Erfolg]\n\n' +
          '**[MM/JJJJ] – [MM/JJJJ]** · [Position], [Firma]\n- [Aufgabe / Erfolg]\n\n' +
          '## Ausbildung\n\n**[JJJJ] – [JJJJ]** · [Abschluss], [Schule/Hochschule]\n\n' +
          '## Kenntnisse\n\n- **Sprachen:** [Deutsch (Muttersprache), Englisch (fließend)]\n- **IT:** [Programme]\n- **Sonstiges:** [Führerschein Klasse B]\n\n[Ort], ' + today() + '\n\n[Unterschrift]';
      }
    },
    {
      re: /kündigung/i, make: function (topic) {
        return '# Kündigung ' + (topic || '[Vertrag]') + '\n\n[Dein Name]  \n[Straße Hausnummer]  \n[PLZ Ort]\n\n[Firma]  \n[Straße Hausnummer]  \n[PLZ Ort]\n\n[Ort], ' + today() + '\n\n' +
          '**Kündigung ' + (topic ? 'meines Vertrags: ' + topic : 'meines Vertrags') + ' – Kundennummer [Nummer]**\n\nSehr geehrte Damen und Herren,\n\n' +
          'hiermit kündige ich den oben genannten Vertrag fristgerecht zum nächstmöglichen Zeitpunkt.\n\n' +
          'Bitte senden Sie mir eine schriftliche Bestätigung der Kündigung unter Angabe des Beendigungsdatums zu.\n\nMit freundlichen Grüßen\n\n[Dein Name]';
      }
    },
    {
      re: /brief|schreiben an|e-?mail|mail an/i, make: function (topic) {
        return '# ' + (topic ? cap(topic) : 'Brief') + '\n\n[Absender]  \n[Straße Hausnummer]  \n[PLZ Ort]\n\n[Empfänger]  \n[Straße Hausnummer]  \n[PLZ Ort]\n\n[Ort], ' + today() + '\n\n' +
          '**Betreff: ' + (topic ? cap(topic) : '[Betreff]') + '**\n\nSehr geehrte Damen und Herren,\n\n[Anliegen in ein bis zwei Sätzen.]\n\n[Details, Hintergründe, Fristen.]\n\n[Gewünschte nächste Schritte.]\n\nMit freundlichen Grüßen\n\n[Name]';
      }
    },
    {
      re: /protokoll|besprechung|meeting/i, make: function (topic) {
        return '# Protokoll' + (topic ? ': ' + cap(topic) : '') + '\n\n| | |\n|---|---|\n| Datum | ' + today() + ' |\n| Uhrzeit | [von – bis] |\n| Ort | [Ort / Online] |\n| Teilnehmende | [Namen] |\n| Protokoll | [Name] |\n\n' +
          '## Tagesordnung\n\n1. [Punkt 1]\n2. [Punkt 2]\n3. Verschiedenes\n\n## Ergebnisse\n\n### 1. [Punkt 1]\n- [Ergebnis / Beschluss]\n\n### 2. [Punkt 2]\n- [Ergebnis / Beschluss]\n\n' +
          '## Aufgaben\n\n| Aufgabe | Verantwortlich | Bis |\n|---|---|---|\n| [Aufgabe] | [Name] | [Datum] |\n\n## Nächster Termin\n\n[Datum, Uhrzeit, Ort]';
      }
    },
    {
      re: /einkauf/i, make: function () {
        return '# Einkaufsliste\n\n_Stand: ' + today() + '_\n\n## Obst & Gemüse\n- [ ] \n\n## Kühlregal\n- [ ] \n\n## Vorrat\n- [ ] \n\n## Drogerie\n- [ ] ';
      }
    },
    {
      re: /to-?do|aufgaben|checkliste/i, make: function (topic) {
        return '# ' + (topic ? 'To-do: ' + cap(topic) : 'To-do-Liste') + '\n\n_Erstellt am ' + today() + '_\n\n## Heute\n- [ ] \n- [ ] \n\n## Diese Woche\n- [ ] \n\n## Später\n- [ ] \n\n## Erledigt\n- [x] Liste angelegt';
      }
    },
    {
      re: /rezept/i, make: function (topic) {
        return '# ' + (topic ? cap(topic) : 'Rezept') + '\n\n**Portionen:** [Anzahl] · **Zubereitung:** [Minuten] · **Schwierigkeit:** [leicht/mittel/schwer]\n\n## Zutaten\n\n- [Menge] [Zutat]\n- [Menge] [Zutat]\n\n## Zubereitung\n\n1. [Schritt]\n2. [Schritt]\n3. [Schritt]\n\n## Tipps\n\n- [Tipp]';
      }
    },
    {
      re: /plan|zeitplan|wochenplan/i, make: function (topic) {
        var days = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
        return '# ' + (topic ? cap(topic) : 'Wochenplan') + '\n\n| Tag | Vormittag | Nachmittag | Abend |\n|---|---|---|---|\n' +
          days.map(function (d) { return '| ' + d + ' | | | |'; }).join('\n') + '\n\n## Notizen\n\n- ';
      }
    },
    {
      re: /aufsatz|essay|bericht|referat|artikel/i, make: function (topic) {
        var t = topic ? cap(topic) : '[Thema]';
        return '# ' + t + '\n\n## Einleitung\n\n[Worum geht es? Warum ist ' + t + ' relevant? Leitfrage formulieren.]\n\n' +
          '## Hauptteil\n\n### 1. Hintergrund\n\n[Grundlagen und Begriffe zu ' + t + '.]\n\n### 2. Argumente / Aspekte\n\n- [Aspekt 1 mit Beleg]\n- [Aspekt 2 mit Beleg]\n\n### 3. Gegenpositionen\n\n[Andere Sichtweisen.]\n\n' +
          '## Fazit\n\n[Beantwortung der Leitfrage, eigene Einschätzung.]\n\n## Quellen\n\n1. [Quelle]';
      }
    },
    {
      re: /notiz|notizen/i, make: function (topic) {
        return '# ' + (topic ? cap(topic) : 'Notizen') + '\n\n_' + today() + '_\n\n## Stichpunkte\n\n- \n\n## Ideen\n\n- \n\n## Offene Fragen\n\n- ';
      }
    }
  ];

  function makeDocument(text) {
    var topic = extractTopic(text);
    for (var i = 0; i < TEMPLATES.length; i++) {
      if (TEMPLATES[i].re.test(text)) return TEMPLATES[i].make(topic);
    }
    var title = topic ? cap(topic) : 'Neues Dokument';
    return '# ' + title + '\n\n_Erstellt am ' + today() + ' (Offline-Vorlage)_\n\n## Überblick\n\n[Kurze Zusammenfassung]\n\n## Details\n\n- [Punkt 1]\n- [Punkt 2]\n- [Punkt 3]\n\n## Nächste Schritte\n\n1. [Schritt]\n2. [Schritt]';
  }

  var HELP = 'Ich laufe gerade im **Offline-Modus** – ohne Verbindung zu einem KI-Modell. Das kann ich trotzdem:\n\n' +
    '- **Rechnen:** z. B. `(12,5 + 7) * 3` oder `19 % von 250`\n' +
    '- **Umrechnen:** z. B. `5 km in mi`, `30 °C in °F`\n' +
    '- **Datum & Uhrzeit**\n' +
    '- **Textstatistik:** „Zähle Wörter: …“\n' +
    '- **Dokumente erstellen** (Canvas): Brief, Bewerbung, Lebenslauf, Kündigung, Protokoll, To-do-Liste, Einkaufsliste, Rezept, Wochenplan, Aufsatz, Notizen\n\n' +
    'Für richtige KI-Antworten verbinde unter **Einstellungen → KI-Verbindung** einen Anbieter (OpenAI-kompatibel, Anthropic oder lokal über Ollama/LM Studio).';

  function answer(text, ctx) {
    var t = String(text || '').trim();
    var lo = t.toLowerCase();
    var name = ctx && ctx.userName ? ' ' + ctx.userName : '';

    if (!t && ctx && ctx.hasAttachments) {
      return 'Ich habe deine Datei(en) erhalten. Im Offline-Modus kann ich Inhalte leider nicht analysieren – verbinde dafür unter **Einstellungen → KI-Verbindung** ein KI-Modell.';
    }
    if (/^(hallo|hi|hey|servus|moin|grüß|gruss|guten (morgen|tag|abend)|hello|yo)\b/.test(lo)) {
      return 'Hallo' + name + '! 👋 Wie kann ich dir helfen?\n\n_Hinweis: Ich bin gerade offline und kann nur einfache Aufgaben erledigen. Schreib „Hilfe“, um zu sehen, was geht._';
    }
    if (/^(danke|vielen dank|thx|thanks)/.test(lo)) return 'Gern geschehen! 😊';
    if (/(was kannst du|hilfe|^help|funktionen|wie funktioniert)/.test(lo)) return HELP;
    if (/(wer bist du|was bist du|wie heißt du)/.test(lo)) {
      return 'Ich bin **NovaChat**, dein Chat-Assistent. Gerade arbeite ich offline mit eingebauten Funktionen. Mit einer KI-Verbindung (Einstellungen → KI-Verbindung) kann ich frei antworten, Texte schreiben, Code erklären und Dokumente überarbeiten.';
    }
    if (/(wie spät|uhrzeit|wieviel uhr|wie viel uhr)/.test(lo)) {
      var d = new Date();
      return 'Es ist **' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ' Uhr**.';
    }
    if (/(welches datum|welcher tag|datum heute|heutige datum|was ist heute|welcher wochentag)/.test(lo)) {
      return 'Heute ist **' + new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) + '**.';
    }
    var cm = /^(zähle|zaehle|zähl)\s+(die\s+)?(wörter|zeichen)\s*:?\s*([\s\S]+)$/i.exec(t);
    if (cm) {
      var body = cm[4];
      var words = (body.match(/\S+/g) || []).length;
      return '| | |\n|---|---|\n| Wörter | ' + words + ' |\n| Zeichen | ' + body.length + ' |\n| Zeichen ohne Leerzeichen | ' + body.replace(/\s/g, '').length + ' |\n| Sätze | ' + ((body.match(/[.!?]+(\s|$)/g) || []).length || 1) + ' |';
    }
    var math = tryMath(t);
    if (math) return math;
    var conv = tryConvert(t);
    if (conv) return conv;
    if (/(erstell|schreib|mach|entwirf|verfass|generier).*(dokument|brief|bewerbung|lebenslauf|kündigung|protokoll|liste|rezept|plan|aufsatz|essay|bericht|notiz|anschreiben|e-?mail)/i.test(lo)) {
      return 'Hier ist eine Vorlage, die du anpassen kannst. Tipp: Aktiviere über **+ → Canvas**, um sie direkt als bearbeitbares Dokument zu öffnen.\n\n---\n\n' + makeDocument(t);
    }
    return 'Das kann ich offline leider nicht beantworten. 🙁\n\n' + HELP;
  }

  window.OfflineAI = { answer: answer, makeDocument: makeDocument, evalMath: evalMath };
})();
