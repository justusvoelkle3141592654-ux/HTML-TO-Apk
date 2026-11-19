-- name: Manhunt
-- id: manhunt
-- version: @@VERSION@@
-- author: Manhunt
-- description: Manhunt-Modus: HUD, Menü (M), Fähigkeiten (R/V), Enterhaken und automatische Einrichtung der Manhunt-Engine.

local CFG = json.decode([==[@@CONFIG@@]==])
local ACT = CFG.ACT

-- ------------------------------------------------------------------ client settings (Audio & Anzeige)
settings.toggle("hud", { label = "HUD anzeigen", default = true })
settings.slider("hudScale", { label = "HUD-Größe (%)", min = 60, max = 150, step = 10, default = 100 })
settings.choice("hudCorner", { label = "HUD-Position", options = { "oben links", "oben rechts" }, default = "oben links" })
settings.toggle("arrow", { label = "Zielrichtung anzeigen (Hunter)", default = true })
settings.toggle("cooldowns", { label = "Abklingzeiten anzeigen", default = true })
settings.toggle("popups", { label = "XP-Einblendungen", default = true })
settings.toggle("sounds", { label = "Manhunt-Sounds", default = true })
settings.toggle("autoMenu", { label = "Menü beim ersten Betreten öffnen", default = true })

-- ------------------------------------------------------------------ state
local P = {}          -- own synced values (MHP)
local G = {}          -- global synced values (MHG)
local roster = {}     -- name -> {role,lvl,kills,xpt,out,id,lives,adm,seen}
local results = nil   -- {winner,duration,rows={...}}
local pendingRes = nil
local lastP, lastG = -1, -1
local ticks = 0
local inWorld = false
local worldTicks = 0
local announced = 0
local setup = { phase = 0, t = 0, failed = false, msg = nil }
local popups = {}
local lastXp, lastLvl = nil, nil
local levelFlash = 0
local menuScreen = nil
local menuOpen = false
local tab = 1
local page = 1

local function now() return ticks end
local SND = sound
local function playSnd(id, pitch)
  if settings.sounds and SND and SND.play then pcall(SND.play, id, 1.0, pitch or 1.0) end
end
local function atan2(y, x)
  local ok, v = pcall(math.atan, y, x)
  if ok and v then return v end
  if x > 0 then return math.atan(y / x) elseif x < 0 then return math.atan(y / x) + (y >= 0 and math.pi or -math.pi) end
  return y > 0 and math.pi / 2 or -math.pi / 2
end
local function act(n)
  chat.command("trigger mh.act set " .. tostring(n))
end
local function num(s) return tonumber(s) or 0 end
local function cleanName(n) return (tostring(n or ""):gsub("^%[[%a]+%] ", "")) end

local P_KEYS = { "state", "role", "lvl", "xp", "need", "xpt", "swm", "sws", "bpw", "bpu", "bfl", "bxb", "arm", "cd1", "cd2",
  "ab1", "ab2", "lives", "kills", "tx", "tz", "tdim", "tsame", "tid", "hs", "time", "adm", "out", "mkill", "id" }
local G_KEYS = { "state", "time", "hs" }
for _, s in ipairs(CFG.SETTINGS) do G_KEYS[#G_KEYS + 1] = s.key end
for _, k in ipairs({ "winner", "duration", "tier", "botalive", "rleft" }) do G_KEYS[#G_KEYS + 1] = k end

local function split(msg)
  local out = {}
  for part in (msg .. "|"):gmatch("([^|]*)|") do out[#out + 1] = part end
  return out
end

local function onSync(kind, f)
  if kind == "MHP" then
    for i, k in ipairs(P_KEYS) do P[k] = num(f[i + 1]) end
    lastP = now()
    if lastXp ~= nil and settings.popups and P.state == 1 then
      local gained = (P.lvl ~= lastLvl) and 0 or (P.xp - lastXp)
      if gained > 0 then popups[#popups + 1] = { text = "+" .. gained .. " XP", t = now() } end
      if lastLvl and P.lvl > lastLvl then levelFlash = now(); playSnd("minecraft:ui.toast.challenge_complete", 1.4) end
    end
    lastXp, lastLvl = P.xp, P.lvl
  elseif kind == "MHG" then
    for i, k in ipairs(G_KEYS) do G[k] = num(f[i + 1]) end
    lastG = now()
    setup.phase = 9 -- engine answers: installed
  elseif kind == "MHL" then
    local name = cleanName(f[2])
    roster[name] = { role = num(f[3]), lvl = num(f[4]), kills = num(f[5]), xpt = num(f[6]), out = num(f[7]), id = num(f[8]),
      lives = num(f[9]), adm = num(f[10]), seen = now() }
  elseif kind == "MHW" then
    if settings.autoMenu then timer.after(0.5, function() openMenu(1) end) end
  elseif kind == "MHX" then
    pendingRes = { winner = num(f[2]), duration = num(f[3]), rows = {} }
  elseif kind == "MHE" then
    if pendingRes then
      local r = { name = cleanName(f[2]) }
      local keys = { "role", "lvl", "xpt", "kills", "mkill", "w1", "w2", "w3", "w4", "bow", "xb", "gs", "cs", "ns", "tp", "sb", "gh", "pt", "out" }
      for i, k in ipairs(keys) do r[k] = num(f[i + 2]) end
      pendingRes.rows[#pendingRes.rows + 1] = r
    end
  elseif kind == "MHZ" then
    if pendingRes then
      results = pendingRes; pendingRes = nil
      timer.after(2.5, function() openResults() end)
    end
  end
end

on("chat_receive", function(e)
  local m = e.message
  if type(m) ~= "string" then return end
  local kind = m:match("^(MH[PGLWXEZ])|")
  if kind then
    onSync(kind, split(m))
    e:cancel()
    return
  end
  -- hide feedback of the menu's own trigger commands and of the automatic setup
  if m:match("^Triggered %[mh%.") or m:match("^Changed the block") or m:match("^Unknown scoreboard objective 'mh%.")
    or m:match("^You cannot trigger this objective yet") then e:cancel(); return end
  if setup.phase > 0 and setup.phase < 9 then
    if m:match("^Unknown or incomplete command") or m:match("permission") or m:match("^Incorrect argument") then
      setup.failed = true
      setup.msg = "Automatische Einrichtung nicht möglich: In dieser Welt sind keine Cheats erlaubt."
    end
    if m:match("^Chunk") or m:match("^Marked") or m:match("forceload") or m:match("^Gamerule") or m:match("^Placed") or m:match("structure") then e:cancel() end
  end
end)

-- ------------------------------------------------------------------ helpers for names / labels
local function roleName(r) return ({ [0] = "Keine Rolle", [1] = "Speedrunner", [2] = "Hunter", [3] = "Zuschauer" })[r] or "?" end
local function roleColor(r) return ({ [0] = 0xFFAAAAAA, [1] = 0xFF55FF55, [2] = 0xFFFF5555, [3] = 0xFFAAAAAA })[r] or 0xFFFFFFFF end
local function fmtTime(t) local s = math.floor((t or 0) / 20); return string.format("%d:%02d", s // 60, s % 60) end
local function settingIndex(key) for i, s in ipairs(CFG.SETTINGS) do if s.key == key then return i, s end end end
local function settingLabel(key)
  local i, s = settingIndex(key)
  local v = G[key]
  if v == nil then return "?" end
  if s.labels then for j, val in ipairs(s.values) do if val == v then return s.labels[j] end end end
  return tostring(v)
end
local ROMAN = { "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X" }
local function roman(n) if n <= 0 then return "-" end return ROMAN[n] or tostring(n) end
local function abilityById(id) for _, a in ipairs(CFG.ABILITIES) do if a.id == id then return a end end end
local function runnerById(id) for name, r in pairs(roster) do if r.id == id and r.role == 1 then return name end end end
local function isAdmin() return (P.adm or 0) == 1 end
local function costText(t)
  local parts = { "Lvl " .. t.lvl }
  if (t.iron or 0) > 0 then parts[#parts + 1] = t.iron .. " Eisen" end
  if (t.diamond or 0) > 0 then parts[#parts + 1] = t.diamond .. " Dia" end
  return table.concat(parts, ", ")
end
local function canAfford(t)
  local iron, dia = 0, 0
  for _, it in ipairs(player.inventory() or {}) do
    if it.id == "minecraft:iron_ingot" then iron = iron + it.count elseif it.id == "minecraft:diamond" then dia = dia + it.count end
  end
  return (P.lvl or 1) >= t.lvl and iron >= (t.iron or 0) and dia >= (t.diamond or 0), iron, dia
end
local function freshRoster()
  local list = {}
  for name, r in pairs(roster) do if now() - r.seen < 140 then list[#list + 1] = { name = name, r = r } end end
  table.sort(list, function(a, b) return a.name < b.name end)
  return list
end

-- ------------------------------------------------------------------ automatic engine setup (host only)
local function runSetup()
  local x, y, z = player.pos()
  local bx = math.floor(x / 16) * 16
  local bz = math.floor(z / 16) * 16
  local w, rows = CFG.engine.width, CFG.engine.rows
  setup.pos = { bx, bz }
  chat.command(string.format("forceload add %d %d %d %d", bx, bz, bx + w - 1, bz + rows - 1))
  timer.after(3, function()
    chat.command(string.format("place template manhunt:engine %d -64 %d", bx, bz))
  end)
end

local function worldTick()
  worldTicks = worldTicks + 1
  if (worldTicks == 30 or (worldTicks > 30 and worldTicks - announced >= 20)) and (player.health() or 0) > 0 then
    announced = worldTicks
    chat.command("trigger mh.mod set 1")
  end
  -- no engine answer after 6 s: install it (only the host of a singleplayer world can)
  if worldTicks == 140 and setup.phase == 0 and lastG < 0 then
    if game.isSingleplayer() then
      setup.phase = 1
      ui.notify("Manhunt wird eingerichtet …")
      runSetup()
    else
      setup.msg = "Dieser Server hat keine Manhunt-Engine. HUD und Menü brauchen einen Manhunt-Host."
    end
  end
  if setup.phase == 1 and worldTicks == 340 and lastG < 0 and not setup.failed then
    chat.command("trigger mh.mod set 1")
  end
  if setup.phase == 1 and worldTicks == 440 and lastG < 0 then
    setup.failed = true
    setup.msg = setup.msg or "Einrichtung fehlgeschlagen. Cheats aktivieren (ESC → Für LAN öffnen → Cheats an) und Welt neu betreten."
  end
end

-- ------------------------------------------------------------------ grappling hook (client physics)
local grapple = { bob = nil, still = 0, hooked = false, anchor = nil, wasRight = false }
local function grappleTick()
  local held = player.heldItem()
  local holding = held and held.name == "Enterhaken"
  if not holding then grapple.bob = nil; grapple.hooked = false; return end
  local px, py, pz = player.pos()
  local best, bestD = nil, 40
  for _, e in ipairs(world.entities() or {}) do
    if e.type == "minecraft:fishing_bobber" then
      local d = math.sqrt((e.x - px) ^ 2 + (e.y - py) ^ 2 + (e.z - pz) ^ 2)
      if d < bestD then best, bestD = e, d end
    end
  end
  if best then
    if grapple.bob and math.abs(best.x - grapple.bob.x) + math.abs(best.y - grapple.bob.y) + math.abs(best.z - grapple.bob.z) < 0.03 then
      grapple.still = grapple.still + 1
    else
      grapple.still = 0
    end
    grapple.bob = { x = best.x, y = best.y, z = best.z }
    if grapple.still >= 3 then
      local okb, b = pcall(world.block, math.floor(best.x), math.floor(best.y - 0.2), math.floor(best.z))
      local bid = okb and (type(b) == "table" and (b.id or b.name) or b) or "minecraft:stone"
      grapple.hooked = bid ~= nil and bid ~= "minecraft:air" and bid ~= "minecraft:water" and bid ~= "minecraft:lava"
      if grapple.hooked then grapple.anchor = { x = best.x, y = best.y + 0.6, z = best.z } end
    end
  else
    if grapple.hooked and grapple.anchor then
      -- bobber was reeled in while hooked: pull the player to the anchor
      local ex, ey, ez = player.eyePos()
      local dx, dy, dz = grapple.anchor.x - px, grapple.anchor.y - py, grapple.anchor.z - pz
      local dist = math.sqrt(dx * dx + dy * dy + dz * dz)
      if dist > 1.5 then
        local speed = math.min(2.6, math.max(0.9, dist * 0.17))
        player.setVelocity(dx / dist * speed, dy / dist * speed + 0.42, dz / dist * speed)
        act(ACT.GRAPPLE)
        playSnd("minecraft:entity.fishing_bobber.retrieve", 0.7)
      end
    end
    grapple.bob = nil; grapple.hooked = false; grapple.anchor = nil; grapple.still = 0
  end
end

on("tick", function()
  ticks = ticks + 1
  local iw = game.inWorld() and player.exists()
  if iw and not inWorld then
    worldTicks = 0; announced = 0; lastP = -1; lastG = -1; roster = {}; P = {}; G = {}
    setup = { phase = 0, t = 0, failed = false, msg = nil }; lastXp = nil; lastLvl = nil
  end
  inWorld = iw
  if menuOpen and game.screen() == nil then menuOpen = false end
  if menuOpen and menuScreen and ticks % 20 == 0 then pcall(function() menuScreen:rebuild() end) end
  if not iw then return end
  worldTick()
end)

-- ------------------------------------------------------------------ HUD
local function bar(ctx, x, y, w, h, frac, c1, c2)
  ctx:rect(x, y, w, h, 0xA0000000)
  local fw = math.floor((w - 2) * math.max(0, math.min(1, frac)))
  if fw > 0 then ctx:gradient(x + 1, y + 1, fw, h - 2, c1, c2) end
  ctx:outline(x, y, w, h, 0x60FFFFFF)
end
local ARROWS = { "↑", "↗", "→", "↘", "↓", "↙", "←", "↖" }
local DIMS = { [0] = "Oberwelt", [1] = "Nether", [2] = "Ende" }
local function myDim()
  local d = player.dimension() or ""
  if d:find("nether") then return 1 elseif d:find("end") then return 2 end
  return 0
end

hud.add("manhunt", function(ctx)
  if not settings.hud or not inWorld then return end
  if game.screen() ~= nil and not menuOpen then return end
  local sc = settings.hudScale / 100
  if lastP < 0 then
    if setup.msg then
      local w = math.min(ctx.width - 8, 260)
      ctx:rect(4, 4, w, 34, 0xC0400000); ctx:wrappedText(setup.msg, 9, 7, w - 10, 0xFFFFDD55)
    elseif setup.phase >= 1 and setup.phase < 9 then
      ctx:rect(4, 4, 170, 14, 0xC0000000); ctx:text("Manhunt wird eingerichtet …", 9, 7, 0xFFFFDD55)
    end
    return
  end
  local W = math.floor(172 * sc)
  local right = settings.hudCorner == "oben rechts"
  local x0 = right and (ctx.width - W - 4) or 4
  local y = 4
  local state = P.state or 0
  local role = P.role or 0
  local rc = roleColor(role)
  -- header: role + status
  local status = state == 0 and "LOBBY" or (state == 1 and ((G.hs or 0) > 0 and ("Vorsprung " .. fmtTime(G.hs)) or ("Runde " .. fmtTime(G.time))) or "Beendet")
  ctx:rect(x0, y, W, 13, 0xC0000000)
  ctx:rect(x0, y, 3, 13, rc)
  ctx:text(roleName(role):upper(), x0 + 6, y + 3, rc)
  ctx:text(status, x0 + W - ctx:textWidth(status) - 4, y + 3, 0xFFFFFFFF)
  y = y + 14
  if state == 1 or (P.lvl or 1) > 1 then
    -- level + xp
    ctx:rect(x0, y, W, 24, 0xA0000000)
    local lvlText = "LEVEL " .. (P.lvl or 1)
    ctx:text(lvlText, x0 + 4, y + 3, 0xFFFFC94A)
    local xpText = (P.lvl or 1) >= CFG.MAX_LEVEL and "MAX" or ("XP: " .. (P.xp or 0) .. " / " .. (P.need or 0))
    ctx:text(xpText, x0 + W - ctx:textWidth(xpText) - 4, y + 3, 0xFFDDDDDD)
    local frac = (P.need or 0) > 0 and (P.xp or 0) / P.need or 1
    bar(ctx, x0 + 4, y + 14, W - 8, 7, frac, 0xFF7CFF4A, 0xFF2FB34A)
    if now() - levelFlash < 60 then ctx:outline(x0, y, W, 24, 0xFFFFD700) end
    y = y + 25
    -- health
    local hp, mhp = player.health() or 0, player.maxHealth() or 20
    ctx:rect(x0, y, W, 12, 0xA0000000)
    ctx:text("♥ " .. string.format("%.0f/%.0f", hp, mhp), x0 + 4, y + 2, 0xFFFF6B6B)
    if state == 1 and role == 1 then
      local lv = "Leben: " .. (P.lives or 0)
      ctx:text(lv, x0 + W - ctx:textWidth(lv) - 4, y + 2, 0xFF55FF55)
    elseif state == 1 and role == 2 then
      local k = "Kills: " .. (P.kills or 0)
      ctx:text(k, x0 + W - ctx:textWidth(k) - 4, y + 2, 0xFFFF5555)
    end
    y = y + 13
  end
  if state == 1 and (P.out or 0) == 0 and settings.cooldowns and (role == 1 or role == 2) and (G.abil or 1) == 1 then
    for slot = 1, 2 do
      local a = abilityById(slot == 1 and P.ab1 or P.ab2)
      if a then
        local cd = slot == 1 and P.cd1 or P.cd2
        local locked = slot == 2 and (P.lvl or 1) < CFG.ABILITY_SLOT2_LEVEL
        ctx:rect(x0, y, W, 12, 0xA0000000)
        local key = slot == 1 and "[R]" or "[V]"
        ctx:text(key .. " " .. a.name, x0 + 4, y + 2, locked and 0xFF777777 or 0xFFE0B0FF)
        local s = locked and ("ab Lvl " .. CFG.ABILITY_SLOT2_LEVEL) or ((cd or 0) > 0 and (math.ceil(cd / 20) .. " s") or "BEREIT")
        ctx:text(s, x0 + W - ctx:textWidth(s) - 4, y + 2, ((cd or 0) > 0 or locked) and 0xFFAAAAAA or 0xFF55FF55)
        y = y + 13
      end
    end
    -- special weapon cooldown (marker effect)
    for _, ef in ipairs(player.effects() or {}) do
      local id = type(ef) == "table" and (ef.id or ef.effect or ef.name) or tostring(ef)
      if id and tostring(id):find("unluck") then
        local d = type(ef) == "table" and (ef.duration or ef.ticks) or 0
        ctx:rect(x0, y, W, 12, 0xA0000000)
        ctx:text("Spezialangriff lädt " .. math.ceil((d or 0) / 20) .. " s", x0 + 4, y + 2, 0xFFFFAA55)
        y = y + 13
      end
    end
  end
  -- hunter target
  if state == 1 and role == 2 and settings.arrow and (P.tid or 0) > 0 then
    local name = runnerById(P.tid) or "Speedrunner"
    ctx:rect(x0, y, W, 24, 0xA0000000)
    local same = (P.tsame or 0) == 1 and (P.tdim or 0) == myDim()
    if same then
      local px, _, pz = player.pos()
      local dx, dz = P.tx - px, P.tz - pz
      local dist = math.floor(math.sqrt(dx * dx + dz * dz))
      local ang = math.deg(atan2(-dx, dz)) -- yaw angle of the target direction (MC: 0 = south)
      local rel = (ang - (player.yaw() or 0)) % 360
      local idx = math.floor((rel + 22.5) / 45) % 8 + 1
      ctx:text(ARROWS[idx], x0 + 6, y + 8, 0xFF55FFFF)
      ctx:text("Ziel: " .. name, x0 + 18, y + 3, 0xFF55FF55)
      ctx:text(dist .. " m entfernt", x0 + 18, y + 13, 0xFFFFFFFF)
    else
      ctx:text("Ziel: " .. name, x0 + 6, y + 3, 0xFF55FF55)
      ctx:text("Anderer Ort: " .. (DIMS[P.tdim or 0] or "?") .. " (letzte Pos.)", x0 + 6, y + 13, 0xFFFFAA55)
    end
    y = y + 25
  end
  if state == 1 and role == 1 then
    local hunters = 0
    for _, e in ipairs(freshRoster()) do if e.r.role == 2 and e.r.out == 0 then hunters = hunters + 1 end end
    local t = "Hunter: " .. hunters .. "  Bots: " .. (G.botalive or 0)
    ctx:rect(x0, y, W, 12, 0xA0000000); ctx:text(t, x0 + 4, y + 2, 0xFFFF7777); y = y + 13
  end
  if state == 0 then
    local t = isAdmin() and "Menü: M · Runde starten als Host" or "Menü: M · Rolle wählen"
    ctx:rect(x0, y, W, 12, 0xA0000000); ctx:text(t, x0 + 4, y + 2, 0xFFFFFF55); y = y + 13
  end
  -- xp popups
  local py = y + 4
  for i = #popups, 1, -1 do
    local p = popups[i]
    local age = now() - p.t
    if age > 50 then table.remove(popups, i) else
      ctx:text(p.text, x0 + 6, py - math.floor(age / 4), 0xFF7CFF4A)
      py = py + 10
    end
  end
end)

-- ------------------------------------------------------------------ menu
local TABS = { "Übersicht", "Rollen", "Hunter", "Level", "Schwert", "Bogen", "Sonderwaffen", "Rüstung", "Fähigkeiten", "Spielregeln", "Anzeige", "Welt" }
local content = {} -- text lines drawn by render: {text, color, x, y}

local function refreshSoon()
  timer.after(0.5, function() if menuOpen and menuScreen then pcall(function() menuScreen:rebuild() end) end end)
  timer.after(1.3, function() if menuOpen and menuScreen then pcall(function() menuScreen:rebuild() end) end end)
end
local function actBtn(s, text, n, x, y, w)
  s:button({ text = text, x = x, y = y, width = w, height = 16, onClick = function() act(n); playSnd("minecraft:ui.button.click"); refreshSoon() end })
end
local function line(text, color, x, y) content[#content + 1] = { text = text, color = color or 0xFFFFFFFF, x = x, y = y } end

local function cycleRow(s, key, x, y, w)
  local i = settingIndex(key)
  local sdef = CFG.SETTINGS[i]
  line(sdef.name .. ": " .. settingLabel(key), 0xFFFFFFFF, x, y + 4)
  if isAdmin() then
    actBtn(s, "◀", ACT.SETTING_BASE + 2 * (i - 1) + 1, x + w - 46, y, 22)
    actBtn(s, "▶", ACT.SETTING_BASE + 2 * (i - 1), x + w - 22, y, 22)
  end
end

local function buildTab(s, x, y, w, h)
  local state = P.state or 0
  if tab == 1 then
    local st = state == 0 and "Lobby – Rollen wählen" or (state == 1 and "Runde läuft" or "Runde beendet")
    line("Status: " .. st, 0xFFFFDD55, x, y)
    line("Rundenzeit: " .. fmtTime(G.time) .. ((G.hs or 0) > 0 and ("   Vorsprung: " .. fmtTime(G.hs)) or ""), 0xFFFFFFFF, x, y + 12)
    line("Deine Rolle: " .. roleName(P.role or 0) .. "   Level " .. (P.lvl or 1), roleColor(P.role or 0), x, y + 24)
    local runners, hunters = {}, {}
    for _, e in ipairs(freshRoster()) do
      if e.r.role == 1 then runners[#runners + 1] = e.name .. (e.r.out == 1 and " (raus)" or "") elseif e.r.role == 2 then hunters[#hunters + 1] = e.name end
    end
    line("Speedrunner: " .. (#runners > 0 and table.concat(runners, ", ") or "-"), 0xFF55FF55, x, y + 40)
    line("Hunter: " .. (#hunters > 0 and table.concat(hunters, ", ") or "-"), 0xFFFF5555, x, y + 52)
    line("Hunter-Bots: " .. (G.bots or 0) .. " (" .. settingLabel("botdiff") .. "), aktiv: " .. (G.botalive or 0), 0xFFFF9999, x, y + 64)
    local by = y + 82
    if isAdmin() then
      if state == 0 then actBtn(s, "Runde starten", ACT.START, x, by, 110) end
      if state == 1 then actBtn(s, "Runde abbrechen", ACT.ABORT, x, by, 110) end
      if state ~= 0 then actBtn(s, "Zurück zur Lobby", ACT.LOBBY, x + 116, by, 110) end
    else
      line("Der Host startet die Runde.", 0xFFAAAAAA, x, by + 4)
    end
    if results then s:button({ text = "Letztes Ergebnis", x = x, y = by + 20, width = 110, height = 16, onClick = function() openResults() end }) end
  elseif tab == 2 then
    line("Deine Rolle: " .. roleName(P.role or 0), roleColor(P.role or 0), x, y)
    line(state == 0 and "Wähle deine Rolle für die nächste Runde:" or "Während der Runde: als Hunter einsteigen möglich.", 0xFFAAAAAA, x, y + 12)
    actBtn(s, "Speedrunner", ACT.ROLE_RUNNER, x, y + 26, 90)
    actBtn(s, "Hunter", ACT.ROLE_HUNTER, x + 94, y + 26, 70)
    actBtn(s, "Zuschauer", ACT.ROLE_SPECTATOR, x + 168, y + 26, 70)
    if isAdmin() and state == 0 then
      actBtn(s, "Zufällige Rollen", ACT.RANDOM_ROLES, x, y + 46, 110)
      actBtn(s, "Rest → Hunter", ACT.ALL_HUNTERS, x + 116, y + 46, 110)
    end
    local yy = y + 70
    line("Spieler:", 0xFFFFDD55, x, yy)
    for i, e in ipairs(freshRoster()) do
      if yy + i * 10 > y + h - 10 then break end
      line(e.name .. " – " .. roleName(e.r.role) .. (e.r.adm == 1 and " (Host)" or ""), roleColor(e.r.role), x + 6, yy + i * 10)
    end
  elseif tab == 3 then
    line("Hunter-Einstellungen" .. (isAdmin() and "" or " (nur Host änderbar)"), 0xFFFFDD55, x, y)
    local keys = { "bots", "botdiff", "hsset", "hresp", "ffire", "arsenal" }
    for i, k in ipairs(keys) do cycleRow(s, k, x, y + 4 + i * 18, w) end
    line("Bots: Zombies/Skelette mit Hunter-Ausrüstung,", 0xFF999999, x, y + 4 + 7 * 18 + 4)
    line("Vanilla-Wegfindung, brauchen Sichtkontakt.", 0xFF999999, x, y + 4 + 7 * 18 + 14)
  elseif tab == 4 then
    local lv = P.lvl or 1
    line("Level " .. lv .. " / " .. CFG.MAX_LEVEL .. "    XP: " .. (P.xp or 0) .. " / " .. (P.need or 0) .. "    Runde gesamt: " .. (P.xpt or 0), 0xFFFFC94A, x, y)
    line("XP-Quellen (× " .. settingLabel("xpmul") .. " %):", 0xFFFFDD55, x, y + 14)
    local src = { "Erze: Kohle 3, Eisen 8, Gold 10, Diamant 40, Smaragd 30, Antiker Schrott 60",
      "Holzstämme 1 · Mob 8 · Lohe +20 · Enderman +15 · Spieler 120",
      "1 XP pro 2 Schaden · Überleben/Verfolgen alle 20 s",
      "Meilensteine: Nether 150, Festung 150, Bastion 100, Stronghold 200, Ende 300" }
    for i, t in ipairs(src) do line(t, 0xFFCCCCCC, x + 4, y + 14 + i * 10) end
    line("Nächste Freischaltungen:", 0xFFFFDD55, x, y + 70)
    local unl = {}
    local function addU(l, t) if l > lv then unl[#unl + 1] = { l = l, t = t } end end
    for _, t in ipairs(CFG.SWORD_SHARPNESS) do addU(t.lvl, "Schärfe " .. roman(t.tier)) end
    for _, t in ipairs(CFG.SWORD_MATERIALS) do if t.lvl then addU(t.lvl, "Schwert " .. t.name) end end
    for _, t in ipairs(CFG.BOW_POWER) do addU(t.lvl, "Stärke " .. roman(t.tier)) end
    for _, wpn in ipairs(CFG.WEAPONS) do addU(wpn.lvl, wpn.name) end
    for _, a in ipairs(CFG.ARMOR_SETS) do addU(a.lvl, a.name) end
    addU(CFG.ABILITY_SLOT2_LEVEL, "Fähigkeit 2")
    for _, l in ipairs({ 10, 20, 30, 40, 50 }) do addU(l, "+1 Herz") end
    table.sort(unl, function(a, b) return a.l < b.l end)
    for i = 1, math.min(#unl, 8) do line("Lvl " .. unl[i].l .. ": " .. unl[i].t, 0xFFCCCCCC, x + 4 + ((i - 1) % 2) * (w // 2), y + 82 + ((i - 1) // 2) * 10) end
  elseif tab == 5 then
    local m, sh = P.swm or 0, P.sws or 0
    local base = ({ 4, 5, 6, 7 })[m + 1]
    local dmg = base + (sh > 0 and (0.5 * sh + 0.5) or 0)
    line("Manhunt-Schwert: " .. CFG.SWORD_MATERIALS[m + 1].name .. ", Schärfe " .. roman(sh) .. "   Schaden ≈ " .. dmg, 0xFFFFC94A, x, y)
    local nm = CFG.SWORD_MATERIALS[m + 2]
    if nm then
      local ok = canAfford(nm)
      line("Nächstes Material: " .. nm.name .. " (" .. costText(nm) .. ")", ok and 0xFF55FF55 or 0xFFAAAAAA, x, y + 18)
      actBtn(s, "Kaufen", ACT.SWORD_MAT_BASE + nm.tier, x + w - 60, y + 14, 60)
    else line("Material: maximal", 0xFF55FF55, x, y + 18) end
    local ns = CFG.SWORD_SHARPNESS[sh + 1]
    if ns then
      local ok = canAfford(ns)
      line("Nächste Schärfe: " .. roman(ns.tier) .. " (" .. costText(ns) .. ")" .. (ns.extra and (" + " .. ns.extra) or ""), ok and 0xFF55FF55 or 0xFFAAAAAA, x, y + 38)
      actBtn(s, "Kaufen", ACT.SWORD_SHARP_BASE + ns.tier, x + w - 60, y + 34, 60)
    else line("Schärfe: maximal", 0xFF55FF55, x, y + 38) end
    line("Alle Stufen:", 0xFFFFDD55, x, y + 58)
    for i, t in ipairs(CFG.SWORD_SHARPNESS) do
      local own = sh >= t.tier
      line((own and "✔ " or "· ") .. "Schärfe " .. roman(t.tier) .. " – " .. costText(t), own and 0xFF55FF55 or 0xFFBBBBBB, x + 4 + ((i - 1) % 2) * (w // 2), y + 70 + ((i - 1) // 2) * 10)
    end
    line("Das Upgrade ersetzt dein Manhunt-Schwert im Inventar.", 0xFF999999, x, y + 116)
  elseif tab == 6 then
    line("Manhunt-Bogen: Stärke " .. roman(P.bpw or 0) .. ", Schlag " .. roman(P.bpu or 0) .. ", Flamme " .. ((P.bfl or 0) == 1 and "ja" or "nein") .. ", Unendlichkeit", 0xFFFFC94A, x, y)
    local rows = {}
    local np = CFG.BOW_POWER[(P.bpw or 0) + 1]; if np then rows[#rows + 1] = { "Stärke " .. roman(np.tier) .. " (+Pfeilschaden)", np, ACT.BOW_POWER_BASE + np.tier } end
    local nu = CFG.BOW_PUNCH[(P.bpu or 0) + 1]; if nu then rows[#rows + 1] = { "Schlag " .. roman(nu.tier) .. " (+Rückstoß)", nu, ACT.BOW_PUNCH_BASE + nu.tier } end
    if (P.bfl or 0) == 0 then rows[#rows + 1] = { "Flamme (Ziele brennen)", CFG.BOW_FLAME, ACT.BOW_FLAME } end
    if (P.bxb or 0) == 0 then rows[#rows + 1] = { "Repetierarmbrust (Schnellladen III)", CFG.BOW_REPEATER, ACT.BOW_REPEATER } end
    for i, r in ipairs(rows) do
      local ok = canAfford(r[2])
      line(r[1] .. " – " .. costText(r[2]), ok and 0xFF55FF55 or 0xFFAAAAAA, x, y + 18 + (i - 1) * 20)
      actBtn(s, "Kaufen", r[3], x + w - 60, y + 14 + (i - 1) * 20, 60)
    end
    line("Hinweis: Bögen haben in dieser Minecraft-Version keine Lade-Verzauberung;", 0xFF999999, x, y + 104)
    line("„Schnellladen“ gibt es daher als Armbrust mit Schnellladen III.", 0xFF999999, x, y + 114)
  elseif tab == 7 then
    local per = math.max(3, (h - 20) // 26)
    local pages = math.ceil(#CFG.WEAPONS / per)
    if page > pages then page = 1 end
    for i = (page - 1) * per + 1, math.min(#CFG.WEAPONS, page * per) do
      local wpn = CFG.WEAPONS[i]
      local yy = y + ((i - 1) % per) * 26
      local ok = canAfford(wpn)
      line(wpn.name .. ((wpn.count or 1) > 1 and (" ×" .. wpn.count) or "") .. " – " .. costText(wpn), ok and 0xFF55FF55 or 0xFFE0B0FF, x, yy)
      line(wpn.desc, 0xFFAAAAAA, x + 4, yy + 10)
      actBtn(s, "Kaufen", ACT.WEAPON_BASE + wpn.id, x + w - 54, yy, 54)
    end
    if pages > 1 then
      s:button({ text = "Seite " .. page .. "/" .. pages .. " ▶", x = x, y = y + h - 18, width = 90, height = 16, onClick = function() page = page % pages + 1; menuScreen:rebuild() end })
    end
  elseif tab == 8 then
    local t = P.arm or 0
    line("Schutz-Upgrade: " .. roman(t) .. " (verstärkt die getragene Rüstung)", 0xFFFFC94A, x, y)
    local nt = CFG.ARMOR_PROT[t + 1]
    if nt then
      line("Nächste Stufe: Schutz " .. roman(nt.tier) .. " – " .. costText(nt), canAfford(nt) and 0xFF55FF55 or 0xFFAAAAAA, x, y + 16)
      actBtn(s, "Kaufen", ACT.ARMOR_PROT_BASE + nt.tier, x + w - 60, y + 12, 60)
    end
    if t > 0 then actBtn(s, "Auf neue Rüstung anwenden", ACT.ARMOR_PROT_BASE + 9, x, y + 30, 150) end
    line("Spezial-Sets:", 0xFFFFDD55, x, y + 52)
    local yy = y + 64
    for _, a in ipairs(CFG.ARMOR_SETS) do
      local roleOk = a.role == 0 or a.role == (P.role or 0)
      line(a.name .. " (" .. (a.role == 1 and "Runner" or (a.role == 2 and "Hunter" or "alle")) .. ") – " .. costText(a), roleOk and (canAfford(a) and 0xFF55FF55 or 0xFFE0B0FF) or 0xFF666666, x, yy)
      line(a.desc, 0xFFAAAAAA, x + 4, yy + 9)
      if roleOk then actBtn(s, "Kaufen", ACT.ARMOR_SET_BASE + a.id, x + w - 54, yy, 54) end
      yy = yy + 21
    end
  elseif tab == 9 then
    if (G.abil or 1) == 0 then line("Fähigkeiten sind in den Spielregeln deaktiviert.", 0xFFFF5555, x, y) end
    local role = P.role or 0
    for slot = 1, 2 do
      local a = abilityById(slot == 1 and P.ab1 or P.ab2)
      local cd = slot == 1 and (P.cd1 or 0) or (P.cd2 or 0)
      local yy = y + 12 + (slot - 1) * 22
      line("Slot " .. slot .. " [" .. (slot == 1 and "R" or "V") .. "]: " .. (a and a.name or "-") .. (cd > 0 and ("  (" .. math.ceil(cd / 20) .. " s)") or ""), 0xFFE0B0FF, x, yy + 4)
      actBtn(s, "Benutzen", slot == 1 and ACT.ABILITY_USE1 or ACT.ABILITY_USE2, x + w - 70, yy, 70)
    end
    line("Fähigkeit wählen (" .. (role == 1 and "Speedrunner" or (role == 2 and "Hunter" or "Rolle wählen")) .. "):", 0xFFFFDD55, x, y + 62)
    local yy = y + 74
    for _, a in ipairs(CFG.ABILITIES) do
      if a.role == role then
        line(a.name .. " – " .. a.desc .. " (" .. a.cd .. " s)", 0xFFCCCCCC, x, yy + 4)
        actBtn(s, "S1", ACT.ABILITY_SET1_BASE + a.id, x + w - 52, yy, 24)
        actBtn(s, "S2", ACT.ABILITY_SET2_BASE + a.id, x + w - 26, yy, 24)
        yy = yy + 18
      end
    end
    line("Slot 2 ab Level " .. CFG.ABILITY_SLOT2_LEVEL .. ". Abklingzeit-Faktor: " .. settingLabel("cdf") .. " %", 0xFF999999, x, yy + 6)
  elseif tab == 10 then
    line("Spielregeln" .. (isAdmin() and "" or " (nur Host änderbar)"), 0xFFFFDD55, x, y)
    local keys = { "lives", "tlimit", "xpmul", "abil", "cdf", "keepinv" }
    for i, k in ipairs(keys) do cycleRow(s, k, x, y + 4 + (i - 1) * 18 + 10, w) end
    line("Speedrunner gewinnt: Enderdrache besiegt.  Hunter gewinnen: alle Speedrunner", 0xFFCCCCCC, x, y + 128)
    line("ohne Leben – oder das Zeitlimit läuft ab.", 0xFFCCCCCC, x, y + 138)
  elseif tab == 11 then
    s:toggle({ text = "HUD anzeigen", value = settings.hud, x = x, y = y, width = w // 2 - 4, height = 16, onChange = function(v) settings.hud = v end })
    s:toggle({ text = "Zielrichtung", value = settings.arrow, x = x + w // 2, y = y, width = w // 2, height = 16, onChange = function(v) settings.arrow = v end })
    s:toggle({ text = "Abklingzeiten", value = settings.cooldowns, x = x, y = y + 20, width = w // 2 - 4, height = 16, onChange = function(v) settings.cooldowns = v end })
    s:toggle({ text = "XP-Einblendungen", value = settings.popups, x = x + w // 2, y = y + 20, width = w // 2, height = 16, onChange = function(v) settings.popups = v end })
    s:toggle({ text = "Manhunt-Sounds", value = settings.sounds, x = x, y = y + 40, width = w // 2 - 4, height = 16, onChange = function(v) settings.sounds = v end })
    s:toggle({ text = "Menü automatisch", value = settings.autoMenu, x = x + w // 2, y = y + 40, width = w // 2, height = 16, onChange = function(v) settings.autoMenu = v end })
    s:slider({ text = "HUD-Größe", min = 60, max = 150, value = settings.hudScale, x = x, y = y + 60, width = w, height = 16, onChange = function(v) settings.hudScale = math.floor(v / 10 + 0.5) * 10 end })
    s:button({ text = "HUD-Position: " .. settings.hudCorner, x = x, y = y + 80, width = w, height = 16, onClick = function()
      settings.hudCorner = settings.hudCorner == "oben links" and "oben rechts" or "oben links"; menuScreen:rebuild() end })
    line("Spiel-Lautstärke und Grafik: Minecraft-Optionen (ESC → Optionen).", 0xFF999999, x, y + 104)
  elseif tab == 12 then
    line("Die Welt und alle Manhunt-Daten speichern automatisch (Autosave + beim Verlassen).", 0xFFCCCCCC, x, y)
    if game.isSingleplayer() then
      s:button({ text = "Jetzt speichern", x = x, y = y + 14, width = 110, height = 16, onClick = function() chat.command("save-all"); ui.notify("Welt gespeichert") end })
      s:button({ text = "Engine neu installieren", x = x + 116, y = y + 14, width = 130, height = 16, onClick = function()
        setup.phase = 1; setup.failed = false; setup.msg = nil; runSetup(); ui.notify("Manhunt-Engine wird neu platziert") end })
    end
    if isAdmin() then
      actBtn(s, "Tag", ACT.WORLD_DAY, x, y + 36, 60)
      actBtn(s, "Wetter klar", ACT.WORLD_CLEAR, x + 64, y + 36, 80)
      local names = { "Friedlich", "Einfach", "Normal", "Schwer" }
      for i = 0, 3 do actBtn(s, names[i + 1], ACT.WORLD_DIFF_BASE + i, x + i * (w // 4), y + 56, w // 4 - 4) end
      actBtn(s, "Lobby hierher", ACT.WORLD_RELOBBY, x, y + 76, 110)
      actBtn(s, "Arsenal neu aufbauen", ACT.WORLD_REBUILD_CHEST, x + 116, y + 76, 130)
      actBtn(s, "Rollen & Daten zurücksetzen", ACT.WORLD_RESET_STATS, x, y + 96, 170)
    else
      line("Weltoptionen kann nur der Host ändern.", 0xFFAAAAAA, x, y + 40)
    end
    line("Welt sichern/exportieren: Hauptmenü → Einzelspieler → Backup.", 0xFF999999, x, y + 120)
  end
end

local function menuInit(s)
  content = {}
  local W, H = s.width, s.height
  local tw = 96
  local x0 = 8
  local y0 = 24
  local th = math.max(12, math.min(16, (H - y0 - 8) // #TABS - 2))
  for i, name in ipairs(TABS) do
    s:button({ text = (i == tab and "» " or "") .. name, x = x0, y = y0 + (i - 1) * (th + 2), width = tw, height = th, onClick = function()
      tab = i; page = 1; s:rebuild() end })
  end
  local cx = x0 + tw + 10
  local cw = math.min(W - cx - 8, 330)
  buildTab(s, cx, y0 + 4, cw, H - y0 - 12)
  s:button({ text = "Schließen", x = W - 68, y = 4, width = 60, height = 14, onClick = function() s:close() end })
end

local function menuRender(s, ctx)
  local W, H = s.width, s.height
  local cx = 8 + 96 + 6
  ctx:outline(cx, 22, math.min(W - cx - 4, 338), H - 28, 0x80FFD24A)
  ctx:rect(cx, 22, math.min(W - cx - 4, 338), 1, 0xC0FFD24A)
  ctx:text("MANHUNT", 8, 8, 0xFFFFC94A)
  ctx:text("· " .. TABS[tab], 8 + ctx:textWidth("MANHUNT") + 6, 8, 0xFFFFFFFF)
  for _, l in ipairs(content) do ctx:text(l.text, l.x, l.y, l.color) end
end

function openMenu(t)
  if t then tab = t end
  if lastP < 0 then
    ui.notify(setup.msg or "Manhunt-Engine antwortet noch nicht …")
  end
  menuScreen = ui.screen({ title = "Manhunt", pause = false, init = menuInit, render = menuRender })
  menuOpen = true
  ui.open(menuScreen)
end

-- ------------------------------------------------------------------ results screen
local RES_LINES = {}
function openResults()
  if not results then ui.notify("Noch kein Ergebnis vorhanden"); return end
  local r = results
  local scr = ui.screen({ title = "Ergebnis", pause = false, init = function(s)
    RES_LINES = {}
    s:button({ text = "Schließen", x = s.width - 68, y = 4, width = 60, height = 14, onClick = function() s:close() end })
    if isAdmin() then s:button({ text = "Zurück zur Lobby", x = s.width // 2 - 60, y = s.height - 22, width = 120, height = 16, onClick = function() act(ACT.LOBBY); s:close() end }) end
  end, render = function(s, ctx)
    local W = s.width
    local win = ({ [1] = "SPEEDRUNNER GEWINNEN", [2] = "HUNTER GEWINNEN", [3] = "RUNDE ABGEBROCHEN", [4] = "ZEIT ABGELAUFEN – HUNTER GEWINNEN" })[r.winner] or "RUNDE BEENDET"
    local col = r.winner == 1 and 0xFF55FF55 or (r.winner == 3 and 0xFFAAAAAA or 0xFFFF5555)
    ctx:outline(10, 20, W - 20, s.height - 46, 0x80FFD24A)
    ctx:centeredText(win, W // 2, 26, col)
    local loser = r.winner == 1 and "Verlierer: Hunter" or ((r.winner == 2 or r.winner == 4) and "Verlierer: Speedrunner" or "")
    ctx:centeredText("Dauer: " .. fmtTime(r.duration) .. "   " .. loser, W // 2, 38, 0xFFFFFFFF)
    local cols = { { "Spieler", 16 }, { "Rolle", 110 }, { "Lvl", 170 }, { "XP", 196 }, { "Kills", 236 }, { "Mobs", 268 }, { "Waffen", 300 } }
    for _, c in ipairs(cols) do ctx:text(c[1], c[2], 54, 0xFFFFDD55) end
    for i, row in ipairs(r.rows) do
      local y = 54 + i * 11
      if y > s.height - 34 then break end
      local nm = row.name
      while #nm > 3 and ctx:textWidth(nm) > 90 do nm = nm:sub(1, #nm - 1) end
      ctx:text(nm, 16, y, roleColor(row.role))
      ctx:text(roleName(row.role) .. (row.out == 1 and "†" or ""), 110, y, roleColor(row.role))
      ctx:text(tostring(row.lvl), 170, y, 0xFFFFFFFF)
      ctx:text(tostring(row.xpt), 196, y, 0xFFFFFFFF)
      ctx:text(tostring(row.kills), 236, y, 0xFFFFFFFF)
      ctx:text(tostring(row.mkill), 268, y, 0xFFFFFFFF)
      local w = {}
      local sw = row.w1 + row.w2 + row.w3 + row.w4
      if sw > 0 then w[#w + 1] = "Schwert×" .. sw end
      if row.bow > 0 then w[#w + 1] = "Bogen×" .. row.bow end
      if row.xb > 0 then w[#w + 1] = "Armbrust×" .. row.xb end
      if row.gs > 0 then w[#w + 1] = "Blitz×" .. row.gs end
      if row.cs > 0 then w[#w + 1] = "Frost×" .. row.cs end
      if row.ns > 0 then w[#w + 1] = "Explosion×" .. row.ns end
      if row.tp > 0 then w[#w + 1] = "Teleport×" .. row.tp end
      if row.sb > 0 then w[#w + 1] = "Rauch×" .. row.sb end
      if row.gh > 0 then w[#w + 1] = "Haken×" .. (row.gh // 2) end
      if row.pt > 0 then w[#w + 1] = "Trank×" .. row.pt end
      local wt = #w > 0 and table.concat(w, " ") or "-"
      ctx:text(wt, 300, y, 0xFFCCCCCC)
    end
  end })
  ui.open(scr)
end

-- ------------------------------------------------------------------ keys & commands
keys.bind({ id = "menu", label = "Manhunt-Menü", default = "m", onPress = function()
  if inWorld and game.screen() == nil then openMenu() end
end })
keys.bind({ id = "ability1", label = "Fähigkeit 1", default = "r", onPress = function()
  if inWorld and game.screen() == nil and lastP >= 0 then act(ACT.ABILITY_USE1) end
end })
keys.bind({ id = "ability2", label = "Fähigkeit 2", default = "v", onPress = function()
  if inWorld and game.screen() == nil and lastP >= 0 then act(ACT.ABILITY_USE2) end
end })
commands.register("manhunt", function(args)
  local a = args[1]
  if a == "results" then openResults() elseif a == "setup" then setup.phase = 1; runSetup() else openMenu() end
end, "Öffnet das Manhunt-Menü (/manhunt, /manhunt results, /manhunt setup)")

log("Manhunt-Client geladen")
