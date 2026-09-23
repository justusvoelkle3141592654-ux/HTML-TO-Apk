/* Echte Office-Dateien erzeugen: PowerPoint (.pptx), Word (.docx), Excel (.xlsx).
 * Die KI liefert eine Beschreibung (JSON bzw. Markdown), daraus werden hier die Dateien gebaut.
 * Bibliotheken: pptxgenjs, docx, exceljs (MIT) – liegen lokal in www/vendor/office. */
(function () {
  'use strict';

  var LIBS = {
    pptx: { src: 'vendor/office/pptxgen.bundle.js', global: 'PptxGenJS' },
    docx: { src: 'vendor/office/docx.iife.js', global: 'docx' },
    xlsx: { src: 'vendor/office/exceljs.min.js', global: 'ExcelJS' }
  };
  var loading = {};

  function load(kind) {
    var lib = LIBS[kind];
    if (window[lib.global]) return Promise.resolve(window[lib.global]);
    if (!loading[kind]) {
      loading[kind] = new Promise(function (resolve, reject) {
        var s = document.createElement('script');
        s.src = lib.src;
        s.onload = function () { resolve(window[lib.global]); };
        s.onerror = function () { loading[kind] = null; reject(new Error('Bibliothek für ' + kind + ' konnte nicht geladen werden.')); };
        document.head.appendChild(s);
      });
    }
    return loading[kind];
  }

  var META = {
    pptx: { label: 'PowerPoint', ext: 'pptx', color: '#d24726', mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' },
    docx: { label: 'Word-Dokument', ext: 'docx', color: '#2b579a', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
    xlsx: { label: 'Excel-Tabelle', ext: 'xlsx', color: '#217346', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
  };

  // ---------- Anweisungen an die KI ----------
  var PROMPTS = {
    pptx: 'AUFGABE: Erstelle den Inhalt einer PowerPoint-Präsentation. Antworte AUSSCHLIESSLICH mit JSON in genau diesem Format (keine Erklärung davor oder danach):\n' +
      '{"title":"Titel","subtitle":"Untertitel","slides":[{"title":"Folientitel","bullets":["Punkt 1","Punkt 2","Punkt 3"],"notes":"Sprechernotizen"}]}\n' +
      'Regeln: 5 bis 10 Folien, je Folie 3 bis 6 kurze Stichpunkte (höchstens 15 Wörter je Punkt), letzte Folie = Fazit oder Zusammenfassung. Sprache: Deutsch, außer anders gewünscht.',
    docx: 'AUFGABE: Schreibe ein vollständiges, gut gegliedertes Word-Dokument. Gib AUSSCHLIESSLICH den Dokumentinhalt in Markdown aus: Beginne mit "# Titel", nutze "##"-Überschriften, Absätze, Aufzählungen und bei Bedarf Tabellen. Keine Einleitung, kein Kommentar.',
    xlsx: 'AUFGABE: Erstelle eine Excel-Tabelle. Antworte AUSSCHLIESSLICH mit JSON in genau diesem Format (keine Erklärung):\n' +
      '{"title":"Titel","sheets":[{"name":"Blatt1","columns":["Spalte A","Spalte B"],"rows":[["Text",123],["Text",45.5]],"totals":true}]}\n' +
      'Regeln: Zahlen als echte Zahlen (ohne Einheit/Währungszeichen im Wert, Einheit in den Spaltennamen). Formeln sind erlaubt als Text, der mit "=" beginnt (z. B. "=B2*C2"). "totals": true fügt eine Summenzeile für Zahlenspalten hinzu. Mindestens 5 sinnvolle Zeilen.'
  };

  function extractJSON(text) {
    var t = String(text || '');
    var fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(t);
    if (fence) t = fence[1];
    var a = t.indexOf('{'), b = t.lastIndexOf('}');
    if (a < 0 || b <= a) throw new Error('Die KI hat kein gültiges Format geliefert.');
    var raw = t.slice(a, b + 1);
    try { return JSON.parse(raw); } catch (e) {
      // häufige Fehler kleiner Modelle: Kommas am Ende
      try { return JSON.parse(raw.replace(/,\s*([}\]])/g, '$1')); } catch (e2) { throw new Error('Die KI hat kein gültiges JSON geliefert. Bitte erneut versuchen.'); }
    }
  }

  function clean(s, max) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, max || 400); }

  /** Rohtext der KI in eine Beschreibung umwandeln. */
  function parse(kind, text, request) {
    if (kind === 'docx') {
      var md = String(text || '').replace(/^\s*```(?:markdown|md)?\s*\n([\s\S]*?)\n```\s*$/i, '$1').trim();
      if (!md) throw new Error('Es wurde kein Inhalt erzeugt.');
      var t = /^#\s+(.+)$/m.exec(md);
      return { title: t ? clean(t[1], 120) : titleFrom(request), markdown: md };
    }
    var j = extractJSON(text);
    if (kind === 'pptx') {
      var slides = (Array.isArray(j.slides) ? j.slides : []).map(function (s) {
        return {
          title: clean(s.title || s.heading, 120),
          bullets: (Array.isArray(s.bullets) ? s.bullets : Array.isArray(s.points) ? s.points : []).map(function (b) { return clean(b, 220); }).filter(Boolean).slice(0, 8),
          notes: clean(s.notes, 1200)
        };
      }).filter(function (s) { return s.title || s.bullets.length; });
      if (!slides.length) throw new Error('Die Präsentation enthält keine Folien.');
      return { title: clean(j.title, 120) || titleFrom(request), subtitle: clean(j.subtitle, 160), slides: slides.slice(0, 25) };
    }
    var sheets = (Array.isArray(j.sheets) ? j.sheets : [j]).map(function (sh, i) {
      var cols = (Array.isArray(sh.columns) ? sh.columns : []).map(function (c) { return clean(c, 60); });
      var rows = (Array.isArray(sh.rows) ? sh.rows : []).filter(Array.isArray).map(function (r) {
        return r.map(function (v) {
          if (typeof v === 'number' || typeof v === 'boolean') return v;
          var s = String(v == null ? '' : v).trim();
          if (/^-?\d+([.,]\d+)?$/.test(s) && !/^0\d/.test(s)) return parseFloat(s.replace(',', '.'));
          return s.slice(0, 500);
        });
      });
      if (!cols.length && rows.length) cols = rows[0].map(function (_, k) { return 'Spalte ' + (k + 1); });
      return { name: clean(sh.name || ('Blatt' + (i + 1)), 31).replace(/[\\/?*[\]:]/g, ' ') || 'Blatt' + (i + 1), columns: cols, rows: rows.slice(0, 2000), totals: !!sh.totals };
    }).filter(function (s) { return s.columns.length; });
    if (!sheets.length) throw new Error('Die Tabelle ist leer.');
    return { title: clean(j.title, 120) || titleFrom(request), sheets: sheets.slice(0, 10) };
  }

  function titleFrom(req) {
    var t = String(req || '').replace(/^(bitte\s+)?(erstell|mach|schreib|generier)\w*\s+(mir\s+)?(eine?n?\s+)?/i, '').replace(/\s+/g, ' ').trim();
    return (t.charAt(0).toUpperCase() + t.slice(1)).slice(0, 80) || 'Neue Datei';
  }

  /** Vorlage ohne KI (Basis-Modus). */
  function fromBasic(kind, request) {
    var title = titleFrom(request);
    if (kind === 'pptx') return {
      title: title, subtitle: 'Entwurf – bitte ergänzen',
      slides: [
        { title: 'Einleitung', bullets: ['Worum geht es?', 'Warum ist das Thema wichtig?', 'Ziel der Präsentation'] },
        { title: 'Hintergrund', bullets: ['Wichtige Fakten', 'Aktuelle Situation', 'Beteiligte'] },
        { title: 'Kernpunkte', bullets: ['Punkt 1', 'Punkt 2', 'Punkt 3'] },
        { title: 'Nächste Schritte', bullets: ['Was ist zu tun?', 'Wer ist verantwortlich?', 'Bis wann?'] },
        { title: 'Fazit', bullets: ['Zusammenfassung', 'Offene Fragen', 'Vielen Dank!'] }
      ]
    };
    if (kind === 'xlsx') return {
      title: title,
      sheets: [{ name: 'Tabelle', columns: ['Position', 'Menge', 'Einzelpreis (€)', 'Gesamt (€)'], totals: true,
        rows: [1, 2, 3, 4, 5].map(function (i) { return ['Eintrag ' + i, 1, 0, '=B' + (i + 1) + '*C' + (i + 1)]; }) }]
    };
    return { title: title, markdown: window.OfflineAI ? window.OfflineAI.makeDocument(request) : '# ' + title + '\n\n' };
  }

  // ---------- Markdown -> Word ----------
  function inlineRuns(D, text, base) {
    var runs = [];
    var re = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`)/g, last = 0, m;
    text = String(text || '');
    while ((m = re.exec(text))) {
      if (m.index > last) runs.push(new D.TextRun(Object.assign({ text: text.slice(last, m.index) }, base)));
      var t = m[0];
      if (t.slice(0, 2) === '**') runs.push(new D.TextRun(Object.assign({ text: t.slice(2, -2), bold: true }, base)));
      else if (t[0] === '`') runs.push(new D.TextRun(Object.assign({ text: t.slice(1, -1), font: 'Consolas' }, base)));
      else runs.push(new D.TextRun(Object.assign({ text: t.slice(1, -1), italics: true }, base)));
      last = re.lastIndex;
    }
    if (last < text.length) runs.push(new D.TextRun(Object.assign({ text: text.slice(last) }, base)));
    return runs.length ? runs : [new D.TextRun('')];
  }

  function mdToDocx(D, md) {
    var lines = String(md).replace(/\r/g, '').split('\n');
    var out = [], i = 0, m;
    var H = [D.HeadingLevel.TITLE, D.HeadingLevel.HEADING_1, D.HeadingLevel.HEADING_2, D.HeadingLevel.HEADING_3, D.HeadingLevel.HEADING_4];
    while (i < lines.length) {
      var line = lines[i];
      if (!line.trim()) { i++; continue; }
      if ((m = /^(#{1,5})\s+(.*)$/.exec(line))) {
        out.push(new D.Paragraph({ heading: H[Math.min(m[1].length - 1, 4)], children: inlineRuns(D, m[2]) }));
        i++; continue;
      }
      if (/^\s*```/.test(line)) {
        i++;
        while (i < lines.length && !/^\s*```/.test(lines[i])) {
          out.push(new D.Paragraph({ children: [new D.TextRun({ text: lines[i], font: 'Consolas', size: 20 })] }));
          i++;
        }
        i++; continue;
      }
      if (line.indexOf('|') >= 0 && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
        var split = function (l) { return l.trim().replace(/^\||\|$/g, '').split('|').map(function (c) { return c.trim(); }); };
        var head = split(line); i += 2;
        var rows = [head];
        while (i < lines.length && lines[i].indexOf('|') >= 0 && lines[i].trim()) { rows.push(split(lines[i])); i++; }
        out.push(new D.Table({
          width: { size: 100, type: D.WidthType.PERCENTAGE },
          rows: rows.map(function (r, ri) {
            return new D.TableRow({
              tableHeader: ri === 0,
              children: head.map(function (_, ci) {
                return new D.TableCell({
                  shading: ri === 0 ? { fill: 'E8ECF4' } : undefined,
                  children: [new D.Paragraph({ children: inlineRuns(D, r[ci] || '', ri === 0 ? { bold: true } : {}) })]
                });
              })
            });
          })
        }));
        out.push(new D.Paragraph(''));
        continue;
      }
      if ((m = /^(\s*)([-*+]|\d+[.)])\s+(\[[ xX]\]\s+)?(.*)$/.exec(line))) {
        var level = Math.min(2, Math.floor(m[1].replace(/\t/g, '    ').length / 2));
        var ordered = /\d/.test(m[2]);
        var text = (m[3] ? (/x/i.test(m[3]) ? '☑ ' : '☐ ') : '') + m[4];
        out.push(new D.Paragraph(ordered ? { numbering: { reference: 'num', level: level }, children: inlineRuns(D, text) } : { bullet: { level: level }, children: inlineRuns(D, text) }));
        i++; continue;
      }
      if (/^\s*>/.test(line)) {
        out.push(new D.Paragraph({ indent: { left: 400 }, children: inlineRuns(D, line.replace(/^\s*>\s?/, ''), { italics: true, color: '555555' }) }));
        i++; continue;
      }
      if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { out.push(new D.Paragraph({ border: { bottom: { style: D.BorderStyle.SINGLE, size: 6, color: 'CCCCCC' } } })); i++; continue; }
      var para = [line.trim()];
      i++;
      while (i < lines.length && lines[i].trim() && !/^(#|\s*[-*+]\s|\s*\d+[.)]\s|\s*>|\s*```)/.test(lines[i]) && lines[i].indexOf('|') < 0) { para.push(lines[i].trim()); i++; }
      out.push(new D.Paragraph({ spacing: { after: 160 }, children: inlineRuns(D, para.join(' ')) }));
    }
    return out;
  }

  // ---------- Dateien bauen ----------
  var THEME = { dark: '1F2A44', accent: 'E0662F', light: 'F5F7FB', text: '1F2937', muted: '6B7280' };

  async function buildPptx(spec) {
    var P = await load('pptx');
    var pres = new P();
    pres.layout = 'LAYOUT_WIDE';
    pres.title = spec.title;
    var t = pres.addSlide();
    t.background = { color: THEME.dark };
    t.addShape(pres.ShapeType.rect, { x: 0.6, y: 3.05, w: 1.4, h: 0.08, fill: { color: THEME.accent }, line: { color: THEME.accent } });
    t.addText(spec.title, { x: 0.6, y: 1.5, w: 12, h: 1.4, fontSize: 40, bold: true, color: 'FFFFFF', fontFace: 'Calibri' });
    if (spec.subtitle) t.addText(spec.subtitle, { x: 0.6, y: 3.3, w: 12, h: 0.8, fontSize: 20, color: 'C9D2E3', fontFace: 'Calibri' });
    spec.slides.forEach(function (s, idx) {
      var sl = pres.addSlide();
      sl.background = { color: 'FFFFFF' };
      sl.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 0.12, fill: { color: THEME.accent }, line: { color: THEME.accent } });
      sl.addText(s.title || '', { x: 0.6, y: 0.4, w: 12.1, h: 0.9, fontSize: 30, bold: true, color: THEME.dark, fontFace: 'Calibri' });
      if (s.bullets.length) {
        sl.addText(s.bullets.map(function (b) { return { text: b, options: { bullet: { indent: 22 }, paraSpaceAfter: 10 } }; }),
          { x: 0.7, y: 1.5, w: 11.9, h: 5.2, fontSize: 20, color: THEME.text, fontFace: 'Calibri', valign: 'top' });
      }
      sl.addText(String(idx + 2), { x: 12.3, y: 6.95, w: 0.6, h: 0.35, fontSize: 11, color: THEME.muted, align: 'right' });
      if (s.notes) sl.addNotes(s.notes);
    });
    return pres.write({ outputType: 'blob' });
  }

  async function buildDocx(spec) {
    var D = await load('docx');
    var doc = new D.Document({
      creator: 'NovaChat',
      title: spec.title,
      styles: { default: { document: { run: { font: 'Calibri', size: 23 } } } },
      numbering: { config: [{ reference: 'num', levels: [0, 1, 2].map(function (l) { return { level: l, format: D.LevelFormat.DECIMAL, text: '%' + (l + 1) + '.', alignment: D.AlignmentType.START, style: { paragraph: { indent: { left: 720 * (l + 1), hanging: 360 } } } }; }) }] },
      sections: [{ children: mdToDocx(D, spec.markdown) }]
    });
    return D.Packer.toBlob(doc);
  }

  async function buildXlsx(spec) {
    var E = await load('xlsx');
    var wb = new E.Workbook();
    wb.creator = 'NovaChat';
    spec.sheets.forEach(function (sh) {
      var ws = wb.addWorksheet(sh.name);
      ws.addRow(sh.columns);
      sh.rows.forEach(function (r) {
        ws.addRow(sh.columns.map(function (_, k) {
          var v = r[k];
          if (typeof v === 'string' && v[0] === '=') return { formula: v.slice(1) };
          return v == null ? '' : v;
        }));
      });
      var head = ws.getRow(1);
      head.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF217346' } };
      ws.views = [{ state: 'frozen', ySplit: 1 }];
      if (sh.rows.length) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sh.columns.length } };
      if (sh.totals && sh.rows.length) {
        var last = sh.rows.length + 1;
        var tot = sh.columns.map(function (_, k) {
          if (k === 0) return 'Summe';
          var numeric = sh.rows.some(function (r) { return typeof r[k] === 'number' || (typeof r[k] === 'string' && r[k][0] === '='); });
          if (!numeric) return '';
          var col = ws.getColumn(k + 1).letter;
          return { formula: 'SUM(' + col + '2:' + col + last + ')' };
        });
        var tr = ws.addRow(tot);
        tr.font = { bold: true };
        tr.border = { top: { style: 'thin' } };
      }
      sh.columns.forEach(function (c, k) {
        var width = Math.max(String(c).length, 8);
        sh.rows.forEach(function (r) { width = Math.max(width, String(r[k] == null ? '' : r[k]).length); });
        var col = ws.getColumn(k + 1);
        col.width = Math.min(60, width + 2);
        if (/€|eur|preis|betrag|kosten|summe|gesamt/i.test(c)) col.numFmt = '#,##0.00';
      });
    });
    var buf = await wb.xlsx.writeBuffer();
    return new Blob([buf], { type: META.xlsx.mime });
  }

  function build(file) {
    if (file.kind === 'pptx') return buildPptx(file.spec);
    if (file.kind === 'docx') return buildDocx(file.spec);
    return buildXlsx(file.spec);
  }

  function fileName(file) {
    var base = String(file.spec.title || 'Datei').toLowerCase().replace(/[äöüß]/g, function (c) { return { ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' }[c]; })
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'datei';
    return base + '.' + META[file.kind].ext;
  }

  function summary(file) {
    var s = file.spec;
    if (file.kind === 'pptx') return (s.slides.length + 1) + ' Folien';
    if (file.kind === 'xlsx') return s.sheets.length + (s.sheets.length === 1 ? ' Blatt · ' + s.sheets[0].rows.length + ' Zeilen' : ' Blätter');
    return ((s.markdown.match(/\S+/g) || []).length) + ' Wörter';
  }

  /** Text-Zusammenfassung für den Gesprächsverlauf der KI. */
  function asText(file) {
    var s = file.spec;
    if (file.kind === 'pptx') return '# ' + s.title + '\n' + s.slides.map(function (x, i) { return '\nFolie ' + (i + 2) + ': ' + x.title + '\n' + x.bullets.map(function (b) { return '- ' + b; }).join('\n'); }).join('\n');
    if (file.kind === 'xlsx') return '# ' + s.title + '\n' + s.sheets.map(function (sh) {
      return '\n## ' + sh.name + '\n| ' + sh.columns.join(' | ') + ' |\n' + sh.rows.slice(0, 40).map(function (r) { return '| ' + r.join(' | ') + ' |'; }).join('\n');
    }).join('\n');
    return s.markdown;
  }

  /** HTML-Vorschau */
  function preview(file) {
    var esc = window.Markdown.escape;
    var s = file.spec;
    if (file.kind === 'pptx') {
      var html = '<div class="slides-preview"><div class="slide-card title-slide"><h2>' + esc(s.title) + '</h2>' + (s.subtitle ? '<p>' + esc(s.subtitle) + '</p>' : '') + '</div>';
      s.slides.forEach(function (x, i) {
        html += '<div class="slide-card"><span class="slide-no">' + (i + 2) + '</span><h3>' + esc(x.title) + '</h3><ul>' + x.bullets.map(function (b) { return '<li>' + esc(b) + '</li>'; }).join('') + '</ul></div>';
      });
      return html + '</div>';
    }
    if (file.kind === 'xlsx') {
      return s.sheets.map(function (sh) {
        return '<h3 class="sheet-name">' + esc(sh.name) + '</h3><div class="table-wrap xlsx-preview"><table><thead><tr>' + sh.columns.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') + '</tr></thead><tbody>' +
          sh.rows.slice(0, 200).map(function (r) { return '<tr>' + sh.columns.map(function (_, k) { var v = r[k]; return '<td' + (typeof v === 'number' ? ' class="num"' : '') + '>' + esc(typeof v === 'number' ? v.toLocaleString('de-DE') : (v == null ? '' : v)) + '</td>'; }).join('') + '</tr>'; }).join('') +
          '</tbody></table></div>';
      }).join('');
    }
    return '<div class="md docx-preview">' + window.Markdown.render(s.markdown) + '</div>';
  }

  var TASK_RE = {
    pptx: /(power\s?-?point|präsentation|praesentation|foliensatz|folien|slides?|pptx)/i,
    docx: /(word-?dokument|word-?datei|\bdocx\b|als word\b|in word\b)/i,
    xlsx: /(excel|tabelle|spreadsheet|xlsx|kalkulation|budgetplan)/i
  };
  var CREATE_RE = /(erstell|mach|generier|schreib|bau|entwirf|plane|anleg|gestalte|create|make|build)/i;
  /** Erkennt Wünsche wie „Erstelle eine PowerPoint über …“. */
  function detect(text) {
    var t = String(text || '');
    if (!CREATE_RE.test(t)) return null;
    if (TASK_RE.pptx.test(t)) return 'pptx';
    if (TASK_RE.xlsx.test(t)) return 'xlsx';
    if (TASK_RE.docx.test(t)) return 'docx';
    return null;
  }

  window.Office = { META: META, PROMPTS: PROMPTS, load: load, parse: parse, fromBasic: fromBasic, build: build, fileName: fileName, summary: summary, asText: asText, preview: preview, detect: detect };
})();
