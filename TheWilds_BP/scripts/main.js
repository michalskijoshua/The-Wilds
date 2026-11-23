// The Wilds 0.0.1-p0: Phase 0 prototypes only. Works with or without Guilds+ (detected at runtime, never edited).
import { world, system, guard, guildsPresent, VERSION } from "./core/util.js";
import { setArcherMode, archerMode, seatReport, stats as seatStats, testSeat, allBeasts } from "./tusk/seats.js";
import { durabilityTest } from "./tusk/durability.js";
import { guardStats } from "./tusk/crewguard.js";
import { mimicInfo, mimicCensus, mimicSpawn } from "./mimic/affinity.js";
import { landmarkInfo, landmarkAudit, visit } from "./landmarks/cells.js";
import { seedForm, pulseStats } from "./aether/pulse.js";

// Test commands (cheats on): /scriptevent wilds:<command> [argument]
const COMMANDS = {
  status: (p) => p.sendMessage([
    `§bThe Wilds ${VERSION}. Guilds+ ${guildsPresent() ? "§adetected" : "§7not installed"}§b. Archer mode ${archerMode()}.`,
    `Seated archers fired: native ${seatStats.nativeShots}, Path B ${seatStats.scriptShots}.`,
    `Friendly fire on players (${guardStats.mode}): blocked ${guardStats.blocked}, refunded ${guardStats.refunded}.`,
    `Aetherseed pulses ${pulseStats.pulses}, plants changed ${pulseStats.changes}.`,
    ...seatReport(),
  ].join("\n")),
  archers: (p, a) => { setArcherMode(a.toUpperCase()); p.sendMessage(`§bArcher mode is now ${archerMode()} (A = mercenaries' own AI, B = Wilds fires for them).`); },
  durability_test: (p) => durabilityTest(p),
  mimic_info: (p) => mimicInfo(p),
  mimic_census: (p) => mimicCensus(p),
  mimic_spawn: (p, a) => mimicSpawn(p, parseInt(a, 10)),
  landmark: (p) => landmarkInfo(p),
  landmark_audit: (p) => landmarkAudit(p),
  seed: (p, a) => seedForm(p, a.toLowerCase()),
  debug: (p) => { if (p.hasTag("wilds:debug")) { p.removeTag("wilds:debug"); p.sendMessage("§7Wilds debug chat off."); } else { p.addTag("wilds:debug"); p.sendMessage("§7Wilds debug chat on."); } },
};

system.afterEvents.scriptEventReceive.subscribe(guard("scriptevent", (e) => {
  if (!e.id.startsWith("wilds:")) return;
  const p = e.sourceEntity;
  if (p?.typeId !== "minecraft:player") return;
  const cmd = COMMANDS[e.id.slice(6)];
  if (!cmd) return p.sendMessage(`§eUnknown. Try: ${Object.keys(COMMANDS).map((k) => `wilds:${k}`).join(", ")}`);
  cmd(p, (e.message ?? "").trim());
}));

// ---- Server test hooks (operator-only /scriptevent from the server console; harmless in normal play)
// /scriptevent wilds:test <cmd> <x> <y> <z> [args...]   Output goes to the console as "[wilds-test] ...".
const clean = (s) => String(s).replace(/§./g, "");
const stand = (x, y, z) => ({ dimension: world.getDimension("overworld"), location: { x, y, z }, name: "console", id: "console",
  sendMessage: (m) => console.warn(`[wilds-test] ${clean(m)}`), hasTag: () => false });
let moveRun;
const TESTS = {
  seat: (p, [owner]) => { const b = p.dimension.getEntities({ type: "wilds:tuskbeast", location: p.location, maxDistance: 16, closest: 1 })[0]; p.sendMessage(b ? `seated ${testSeat(b, owner)}` : "no beast"); },
  move: (p, [on]) => {
    if (moveRun !== undefined) { system.clearRun(moveRun); moveRun = undefined; }
    if (on !== "on") return p.sendMessage("move off");
    moveRun = system.runInterval(() => { for (const b of allBeasts()) { try { const r = (b.getRotation().y * Math.PI) / 180; b.applyImpulse({ x: -Math.sin(r) * 0.06, y: 0, z: Math.cos(r) * 0.06 }); } catch { /* */ } } }, 2);
    p.sendMessage("move on");
  },
  mode: (p, [m]) => { setArcherMode((m ?? "A").toUpperCase()); p.sendMessage(`archer mode ${archerMode()}`); },
  report: (p) => {
    p.sendMessage(`guilds=${guildsPresent()} mode=${archerMode()} native=${seatStats.nativeShots} pathB=${seatStats.scriptShots} ff=${guardStats.mode}/${guardStats.blocked}/${guardStats.refunded} pulses=${pulseStats.pulses} changes=${pulseStats.changes}`);
    for (const l of seatReport()) p.sendMessage(l);
  },
  mimic_spawn: (p, [n]) => mimicSpawn(p, parseInt(n, 10)),
  mimic_census: (p) => mimicCensus(p),
  mimic_gold: (p) => {                                   // put every loaded mimic on a gold block (a rare-tier form)
    let n = 0;
    for (const m of p.dimension.getEntities({ type: "wilds:pebble_mimic" })) {
      const l = m.location, b = { x: Math.floor(l.x), y: Math.floor(l.y) - 1, z: Math.floor(l.z) };
      try { p.dimension.getBlock(b).setType("minecraft:gold_block"); m.teleport({ x: b.x + 0.5, y: b.y + 1, z: b.z + 0.5 }); n++; } catch { /* */ }
    }
    p.sendMessage(`gold under ${n} mimics`);
  },
  mimic_verify: (p) => {                                 // the P0-4 rule: no mimic may hold a form above its affinity
    const TIER = [0, 0, 0, 0, 0, 1, 1, 2, 3, 4]; let bad = 0, n = 0; const forms = {};
    for (const m of p.dimension.getEntities({ type: "wilds:pebble_mimic" })) {
      n++; const a = m.getProperty("wilds:affinity"), f = m.getProperty("wilds:form");
      forms[`${a}:${f}`] = (forms[`${a}:${f}`] ?? 0) + 1;
      if (TIER[f] > a) bad++;
    }
    p.sendMessage(`mimics ${n}, violations ${bad}, affinity:form counts ${JSON.stringify(forms)}`);
  },
  mimic_snapshot: (p) => { const s = {}; for (const m of p.dimension.getEntities({ type: "wilds:pebble_mimic" })) s[m.id] = m.getProperty("wilds:affinity"); world.setDynamicProperty("wilds:test_snapshot", JSON.stringify(s)); p.sendMessage(`snapshot ${Object.keys(s).length}`); },
  mimic_compare: (p) => {
    const s = JSON.parse(world.getDynamicProperty("wilds:test_snapshot") ?? "{}"); let same = 0, diff = 0, gone = 0;
    for (const [id, a] of Object.entries(s)) { const m = world.getEntity(id); if (!m) { gone++; continue; } if (m.getProperty("wilds:affinity") === a) same++; else diff++; }
    p.sendMessage(`after reload: same ${same}, changed ${diff}, not loaded ${gone}`);
  },
  durability: (p) => durabilityTest(p),
  visit: (p) => { visit(p); landmarkInfo(p); },
  audit: (p) => landmarkAudit(p),
  seed: (p, [form]) => seedForm(p, form),
  garden: (p) => {                                       // a test garden around x y z (y = ground level)
    const d = p.dimension, { x, y, z } = p.location, set = (dx, dy, dz, id) => d.getBlock({ x: x + dx, y: y + dy, z: z + dz }).setType(id);
    for (let dx = -4; dx <= 4; dx++) for (let dz = -4; dz <= 4; dz++) { set(dx, -1, dz, "minecraft:grass_block"); for (let dy = 0; dy < 4; dy++) set(dx, dy, dz, "minecraft:air"); }
    for (const [dx, dz] of [[-2, -2], [-2, -1], [-2, 0], [-1, -2]]) { set(dx, -1, dz, "minecraft:farmland"); set(dx, 0, dz, "minecraft:wheat"); }
    for (const [dx, dz] of [[2, 2], [2, -2]]) set(dx, 0, dz, "minecraft:poppy");
    set(-2, 0, 2, "minecraft:oak_sapling");
    set(3, 0, 0, "minecraft:flower_pot"); set(3, 0, 1, "minecraft:flower_pot");
    system.runTimeout(() => { for (const [dx, dz] of [[3, 0], [3, 1]]) { try { d.runCommand(`setblock ${x + dx} ${y} ${z + dz} flower_pot`); } catch { /* */ } } }, 1);
    p.sendMessage("garden ready: 4 wheat, 2 poppies, 1 oak sapling, 2 flower pots");
  },
  garden_state: (p) => {
    const d = p.dimension, { x, y, z } = p.location, out = {};
    for (let dx = -4; dx <= 4; dx++) for (let dz = -4; dz <= 4; dz++) { const b = d.getBlock({ x: x + dx, y, z: z + dz }); if (b && !b.isAir) { const g = b.permutation.getState("growth"); const k = b.typeId.replace("minecraft:", "") + (g !== undefined ? `@${g}` : ""); out[k] = (out[k] ?? 0) + 1; } }
    p.sendMessage(`garden: ${JSON.stringify(out)}`);
  },
};
system.afterEvents.scriptEventReceive.subscribe(guard("test", (e) => {
  if (e.id !== "wilds:test") return;
  const [cmd, x, y, z, ...a] = (e.message ?? "").trim().split(/\s+/);
  const t = TESTS[cmd]; const p = stand(+x || 0, +y || 0, +z || 0);
  if (!t) return p.sendMessage(`unknown test ${cmd}`);
  t(p, a);
}));

world.afterEvents.worldLoad.subscribe(guard("load", () => {
  console.info(`[wilds] ${VERSION} loaded. Guilds+ ${guildsPresent() ? "detected" : "not installed"}.`);
}));
