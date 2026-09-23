/* Kleiner, abhängigkeitsfreier Markdown-Renderer (funktioniert offline). */
(function () {
  'use strict';

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ---------- Syntax-Hervorhebung (einfach) ----------
  var KEYWORDS = new Set(('const let var function return if else for while do switch case break continue new class extends ' +
    'import from export default async await try catch finally throw typeof instanceof in of def lambda pass elif and or not is ' +
    'None True False null undefined true false this self public private protected static void int float double char bool ' +
    'boolean string struct enum interface type package func go defer fn mut impl use pub match echo then fi done with as yield ' +
    'print raise except global nonlocal select where insert update delete create table values into set').split(' '));
  var HASH_COMMENT = new Set(['python', 'py', 'bash', 'sh', 'shell', 'zsh', 'ruby', 'rb', 'yaml', 'yml', 'toml', 'r', 'perl', 'powershell', 'ps1', 'dockerfile', 'makefile', 'ini', 'conf']);

  function highlight(code, lang) {
    lang = (lang || '').toLowerCase();
    if (['text', 'txt', 'plain', 'markdown', 'md', ''].indexOf(lang) >= 0 && lang !== '') return esc(code);
    var hash = HASH_COMMENT.has(lang);
    var re = hash
      ? /(#[^\n]*|"""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|\b\d+(?:\.\d+)?\b|\b[A-Za-z_]\w*\b)/g
      : /(\/\*[\s\S]*?\*\/|\/\/[^\n]*|<!--[\s\S]*?-->|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`|\b\d+(?:\.\d+)?\b|\b[A-Za-z_$][\w$]*\b)/g;
    var out = '', last = 0, m;
    while ((m = re.exec(code))) {
      out += esc(code.slice(last, m.index));
      var t = m[0], cls = null;
      var c0 = t[0];
      if (c0 === '#' || t.slice(0, 2) === '//' || t.slice(0, 2) === '/*' || t.slice(0, 4) === '<!--') cls = 'c';
      else if (c0 === '"' || c0 === "'" || c0 === '`') cls = 's';
      else if (/^\d/.test(t)) cls = 'n';
      else if (KEYWORDS.has(t)) cls = 'k';
      else if (code[re.lastIndex] === '(') cls = 'f';
      out += cls ? '<span class="tk-' + cls + '">' + esc(t) + '</span>' : esc(t);
      last = re.lastIndex;
    }
    return out + esc(code.slice(last));
  }

  var COPY_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>';

  function codeBlock(code, lang) {
    return '<div class="code-block"><div class="code-head"><span>' + esc(lang || 'code') + '</span>' +
      '<button type="button" class="code-copy" data-copy-code>' + COPY_ICON + '<span>Kopieren</span></button></div>' +
      '<pre><code>' + highlight(code, lang) + '</code></pre></div>';
  }

  // ---------- Inline ----------
  function inline(src) {
    var tokens = [];
    function hold(html) { tokens.push(html); return '\u0000' + (tokens.length - 1) + '\u0000'; }
    var s = String(src);
    s = s.replace(/`([^`\n]+)`/g, function (m, c) { return hold('<code>' + esc(c) + '</code>'); });
    s = s.replace(/!\[([^\]]*)\]\((data:image\/[^\s)]+|https?:\/\/[^\s)]+)\)/g, function (m, alt, url) {
      return hold('<img src="' + esc(url) + '" alt="' + esc(alt) + '" style="max-width:100%;border-radius:12px">');
    });
    s = s.replace(/\[([^\]]+)\]\(((?:https?:\/\/|mailto:)[^\s)]+)\)/g, function (m, text, url) {
      return hold('<a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + inlineBasic(text) + '</a>');
    });
    s = s.replace(/(^|[\s(])((?:https?:\/\/)[^\s<>()]+[^\s<>().,;:!?"'])/g, function (m, pre, url) {
      return pre + hold('<a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + esc(url) + '</a>');
    });
    s = inlineBasic(s);
    return s.replace(/\u0000(\d+)\u0000/g, function (m, i) { return tokens[+i]; });
  }

  function inlineBasic(s) {
    s = esc(s);
    s = s.replace(/\*\*\*([^*\n]+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    s = s.replace(/\*\*([^\n]+?)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/__([^_\n]+?)__/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^*\w])\*(?!\s)([^*\n]+?)\*(?!\*)/g, '$1<em>$2</em>');
    s = s.replace(/(^|[^\w])_(?!\s)([^_\n]+?)_(?=[^\w]|$)/g, '$1<em>$2</em>');
    s = s.replace(/~~([^~\n]+?)~~/g, '<del>$1</del>');
    return s;
  }

  // ---------- Blöcke ----------
  var RE_FENCE = /^(\s*)(`{3,}|~{3,})\s*([\w+#.\-]*)\s*$/;
  var RE_LIST = /^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/;
  var RE_HEAD = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
  var RE_HR = /^\s{0,3}([-*_])(\s*\1){2,}\s*$/;
  var RE_TABLE_SEP = /^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)*\|?\s*$/;

  function indentOf(line) {
    var m = /^(\s*)/.exec(line);
    return m ? m[1].replace(/\t/g, '    ').length : 0;
  }

  function isBlockStart(line, next) {
    return RE_FENCE.test(line) || RE_HEAD.test(line) || RE_HR.test(line) || /^\s*>/.test(line) || RE_LIST.test(line) ||
      (line.indexOf('|') >= 0 && next !== undefined && RE_TABLE_SEP.test(next) && next.indexOf('-') >= 0);
  }

  function splitRow(line) {
    var s = line.trim();
    if (s[0] === '|') s = s.slice(1);
    if (s[s.length - 1] === '|' && s[s.length - 2] !== '\\') s = s.slice(0, -1);
    return s.split(/(?<!\\)\|/).map(function (c) { return c.trim().replace(/\\\|/g, '|'); });
  }

  function parseFence(lines, i) {
    var m = RE_FENCE.exec(lines[i]);
    var fence = m[2], lang = m[3], ind = m[1].length, buf = [];
    i++;
    while (i < lines.length && !(lines[i].trim().indexOf(fence[0].repeat(fence.length)) === 0 && lines[i].trim().replace(/[`~]/g, '') === '')) {
      var l = lines[i];
      buf.push(ind ? l.replace(new RegExp('^\\s{0,' + ind + '}'), '') : l);
      i++;
    }
    return { html: codeBlock(buf.join('\n'), lang), next: i + 1 };
  }

  function parseList(lines, start) {
    var first = RE_LIST.exec(lines[start]);
    var base = indentOf(lines[start]);
    var ordered = /\d/.test(first[2]);
    var startNum = ordered ? parseInt(first[2], 10) : 1;
    var html = ordered ? '<ol' + (startNum !== 1 ? ' start="' + startNum + '"' : '') + '>' : '<ul>';
    var items = [];
    var i = start;
    while (i < lines.length) {
      var line = lines[i];
      if (!line.trim()) {
        // Leerzeile: weiter, wenn danach die Liste fortgesetzt wird oder eingerückter Inhalt folgt
        var j = i + 1;
        while (j < lines.length && !lines[j].trim()) j++;
        if (j < lines.length) {
          var nm = RE_LIST.exec(lines[j]);
          if ((nm && indentOf(lines[j]) >= base && /\d/.test(nm[2]) === ordered) || (!nm && indentOf(lines[j]) > base && items.length)) { i = j; continue; }
        }
        break;
      }
      var m = RE_LIST.exec(line);
      var ind = indentOf(line);
      if (m && ind <= base + 1 && ind >= base) {
        if (/\d/.test(m[2]) !== ordered) break;
        items.push({ parts: [itemText(m[3])] });
        i++;
        continue;
      }
      if (ind < base || !items.length) break;
      var cur = items[items.length - 1];
      if (m && ind > base) {
        var sub = parseList(lines, i);
        cur.parts.push(sub.html);
        i = sub.next;
        continue;
      }
      if (RE_FENCE.test(line) && ind > base) {
        var f = parseFence(lines, i);
        cur.parts.push(f.html);
        i = f.next;
        continue;
      }
      if (ind > base || !isBlockStart(line)) {
        cur.parts.push('<br>' + inline(line.trim()));
        i++;
        continue;
      }
      break;
    }
    items.forEach(function (it) { html += '<li>' + it.parts.join('') + '</li>'; });
    html += ordered ? '</ol>' : '</ul>';
    return { html: html, next: i };
  }

  function itemText(t) {
    var task = /^\[([ xX])\]\s+(.*)$/.exec(t);
    if (task) return '<input type="checkbox" disabled' + (task[1] !== ' ' ? ' checked' : '') + '>' + inline(task[2]);
    return inline(t);
  }

  function render(src) {
    var lines = String(src || '').replace(/\r\n?/g, '\n').split('\n');
    var out = [], i = 0, m;
    while (i < lines.length) {
      var line = lines[i];
      if (!line.trim()) { i++; continue; }
      if (RE_FENCE.test(line)) { var f = parseFence(lines, i); out.push(f.html); i = f.next; continue; }
      if ((m = RE_HEAD.exec(line))) { var n = m[1].length; out.push('<h' + n + '>' + inline(m[2]) + '</h' + n + '>'); i++; continue; }
      if (RE_HR.test(line)) { out.push('<hr>'); i++; continue; }
      if (line.indexOf('|') >= 0 && i + 1 < lines.length && RE_TABLE_SEP.test(lines[i + 1]) && lines[i + 1].indexOf('-') >= 0) {
        var head = splitRow(line), aligns = splitRow(lines[i + 1]).map(function (c) {
          return /^:-+:$/.test(c) ? 'center' : /-+:$/.test(c) ? 'right' : '';
        });
        var t = '<div class="table-wrap"><table><thead><tr>' + head.map(function (c, k) {
          return '<th' + (aligns[k] ? ' style="text-align:' + aligns[k] + '"' : '') + '>' + inline(c) + '</th>';
        }).join('') + '</tr></thead><tbody>';
        i += 2;
        while (i < lines.length && lines[i].trim() && lines[i].indexOf('|') >= 0) {
          var cells = splitRow(lines[i]);
          t += '<tr>' + head.map(function (_, k) {
            return '<td' + (aligns[k] ? ' style="text-align:' + aligns[k] + '"' : '') + '>' + inline(cells[k] || '') + '</td>';
          }).join('') + '</tr>';
          i++;
        }
        out.push(t + '</tbody></table></div>');
        continue;
      }
      if (/^\s*>/.test(line)) {
        var q = [];
        while (i < lines.length && /^\s*>/.test(lines[i])) { q.push(lines[i].replace(/^\s*>\s?/, '')); i++; }
        out.push('<blockquote>' + render(q.join('\n')) + '</blockquote>');
        continue;
      }
      if (RE_LIST.test(line)) { var l = parseList(lines, i); out.push(l.html); i = l.next; continue; }
      var buf = [];
      while (i < lines.length && lines[i].trim() && (buf.length === 0 || !isBlockStart(lines[i], lines[i + 1]))) {
        if (buf.length === 0 && isBlockStart(lines[i], lines[i + 1])) break;
        buf.push(lines[i].trim());
        i++;
      }
      if (!buf.length) { buf.push(line.trim()); i++; }
      out.push('<p>' + buf.map(inline).join('<br>') + '</p>');
    }
    return out.join('\n');
  }

  window.Markdown = { render: render, escape: esc, inline: inline };
})();
