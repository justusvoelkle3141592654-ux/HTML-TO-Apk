// Manhunt shell: runs before the game starts.
//  1. Installs/updates the bundled Manhunt Lua mod in the game's browser file system (IndexedDB).
//  2. Creates the ready-to-play world "Manhunt-Welt" on first start (random seed, cheats on so the
//     Manhunt client can place the command-block engine automatically on first join).
// Placeholders are replaced by tools/build.js.
(function () {
  "use strict";
  var VERSION = "@@VERSION@@";
  var MOD_ZIP = "@@MOD_ZIP_B64@@";
  var WORLD = @@WORLD_JSON@@;
  var DB = "_net_lax1dude_eaglercraft_v1_8_internal_PlatformFilesystem_1_8_8_worlds";
  var LS_WORLD = "manhunt.worldSeeded.v1";
  var LS_VER = "manhunt.modVersion";

  function b64(s) {
    var bin = atob(s); var u = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u;
  }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function log(m) { try { (window.__log || []).push("L:[manhunt-shell] " + m); console.log("[manhunt-shell] " + m); } catch (e) {} }

  function gzip(bytes) {
    if (typeof CompressionStream !== "function") return Promise.reject(new Error("no CompressionStream"));
    var cs = new CompressionStream("gzip");
    var w = cs.writable.getWriter(); w.write(bytes); w.close();
    return new Response(cs.readable).arrayBuffer().then(function (b) { return new Uint8Array(b); });
  }

  function openDb() {
    return new Promise(function (resolve, reject) {
      var q = indexedDB.open(DB, 1);
      q.onupgradeneeded = function () {
        var db = q.result;
        if (!db.objectStoreNames.contains("filesystem")) db.createObjectStore("filesystem", { keyPath: ["path"] });
      };
      q.onsuccess = function () { resolve(q.result); };
      q.onerror = function () { reject(q.error); };
      q.onblocked = function () { reject(new Error("indexedDB blocked")); };
    });
  }
  function get(db, path) {
    return new Promise(function (resolve) {
      var r = db.transaction("filesystem").objectStore("filesystem").get([path]);
      r.onsuccess = function () { resolve(r.result ? r.result.data : null); };
      r.onerror = function () { resolve(null); };
    });
  }
  function hasPrefix(db, prefix) {
    return new Promise(function (resolve) {
      var r = db.transaction("filesystem").objectStore("filesystem").getAllKeys();
      r.onsuccess = function () {
        var keys = r.result || [];
        for (var i = 0; i < keys.length; i++) { if (String(keys[i]).indexOf(prefix) === 0) return resolve(true); }
        resolve(false);
      };
      r.onerror = function () { resolve(false); };
    });
  }
  function putAll(db, files) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction("filesystem", "readwrite");
      var st = tx.objectStore("filesystem");
      files.forEach(function (f) { st.put({ path: f[0], data: f[1].buffer.slice(f[1].byteOffset, f[1].byteOffset + f[1].byteLength) }); });
      tx.oncomplete = function () { resolve(); };
      tx.onerror = function () { reject(tx.error); };
    });
  }

  function installMod(db) {
    return get(db, "zeus/mods.json").then(function (raw) {
      var list = { format: 1, mods: [] };
      if (raw) { try { list = JSON.parse(new TextDecoder().decode(raw)); } catch (e) {} }
      if (!list.mods) list.mods = [];
      var entry = null;
      for (var i = 0; i < list.mods.length; i++) if (list.mods[i].id === "manhunt") entry = list.mods[i];
      var updated = lsGet(LS_VER) !== VERSION;
      if (!entry) { entry = { enabled: true, id: "manhunt" }; list.mods.push(entry); }
      if (updated) entry.enabled = true; // the mode is meant to be active; a manual disable lasts until the next update
      var files = [["zeus/mods/manhunt.zip", b64(MOD_ZIP)], ["zeus/mods.json", new TextEncoder().encode(JSON.stringify(list, null, 2))]];
      return putAll(db, files).then(function () { lsSet(LS_VER, VERSION); log("mod " + VERSION + " installed"); });
    });
  }

  function seedWorld(db) {
    if (lsGet(LS_WORLD) === "1") return Promise.resolve();
    var dir = "worlds/" + WORLD.folder + "/";
    return hasPrefix(db, dir).then(function (exists) {
      if (exists) { lsSet(LS_WORLD, "1"); return; }
      var wgs = b64(WORLD.worldGenRaw);
      var view = new DataView(wgs.buffer);
      var hi = (Math.random() * 0x100000000) >>> 0, lo = (Math.random() * 0x100000000) >>> 0;
      view.setUint32(WORLD.seedOffset, hi); view.setUint32(WORLD.seedOffset + 4, lo);
      return gzip(wgs).then(function (wgsGz) {
        return putAll(db, [
          [dir + "level.dat", b64(WORLD.level)],
          [dir + "data/minecraft/game_rules.dat", b64(WORLD.gameRules)],
          [dir + "data/minecraft/world_gen_settings.dat", wgsGz],
        ]);
      }).then(function () {
        // the world selection screen lists the folders named in worlds_list.txt (one per line)
        return get(db, "worlds_list.txt").then(function (raw) {
          var names = raw ? new TextDecoder().decode(raw).split("\n").filter(function (n) { return n.length > 0; }) : [];
          if (names.indexOf(WORLD.folder) < 0) names.unshift(WORLD.folder);
          return putAll(db, [["worlds_list.txt", new TextEncoder().encode(names.join("\n"))]]);
        });
      }).then(function () { lsSet(LS_WORLD, "1"); log("world '" + WORLD.folder + "' created"); });
    });
  }

  window.__manhuntShellReady = openDb().then(function (db) {
    return installMod(db).then(function () { return seedWorld(db); }).then(function () { db.close(); });
  }).catch(function (e) { log("setup failed: " + e); });
})();
