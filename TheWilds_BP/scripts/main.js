// The Wilds 0.0.1-p0: Phase 0 prototypes only. Works with or without Guilds+ (detected at runtime, never edited).
import { world, system, guard, guildsPresent, VERSION } from "./core/util.js";
import { ItemStack } from "@minecraft/server";
import { seatReport, stats as seatStats, testSeat, allBeasts, towerReport } from "./tusk/seats.js";
import { invites, toggleInvite, uninvite, mayRide } from "./tusk/owners.js";
import { durabilityTest } from "./tusk/durability.js";
import { buildHowdah } from "./tusk/menu.js";
import "./tusk/tame.js";
import { wildVisit, wildInfo, wildAge } from "./tusk/wild.js";
import { guardStats } from "./tusk/crewguard.js";
import { mimicInfo, mimicCensus, mimicSpawn } from "./mimic/affinity.js";
import { landmarkInfo, landmarkAudit, visit } from "./landmarks/cells.js";
import { seedForm, pulseStats } from "./aether/pulse.js";
import { capture, release, CAGEABLE, cageStats, catchWith, releaseWith, EMPTY } from "./cage.js";
import { dismountCrew } from "./tusk/seats.js";
import { hatch, eggStats } from "./eggs.js";
import { mimicVisit, mimicLifeStats } from "./mimic/life.js";
import { placeRoost, assignNearest, freeRoost, roostList, roostStats } from "./aether/roost.js";
import { moveStats } from "./core/move.js";
import { playTicks } from "./core/clock.js";
import { stageOf } from "./core/crops.js";
import { lifeStats, snapshot } from "./core/lifecycle.js";
import { allSpawners, spawnerStats } from "./core/spawner.js";
import { lock, unlock } from "./core/txn.js";
import { immunityStats } from "./tusk/durability.js";
import { dropsFor, DROPS } from "./mimic/drops.js";
import { EGGS } from "./eggs_data.js";
import { lynxSpawner, setMode, reward, lynxInfo, lynxStats } from "./lynx.js";
import { bloomVisit, looksAt, spawnBloomling, bloomStats, LOOKS as BLOOM_LOOKS } from "./bloomling.js";
import { seedSpawner, spawnSeed, boneMeal, seedReport, summonZombie, snuff, villageCheck } from "./aether/life.js";

// Test commands (cheats on): /scriptevent wilds:<command> [argument]
const COMMANDS = {
  status: (p) => p.sendMessage([
    `§bThe Wilds ${VERSION}. Guilds+ ${guildsPresent() ? "§adetected" : "§7not installed"}§b.`,
    `Howdah towers fired ${seatStats.towerShots} (bolts ${seatStats.bolts}); seated guards fired themselves ${seatStats.nativeShots}.`,
    `Friendly fire on players (${guardStats.mode}): blocked ${guardStats.blocked}, refunded ${guardStats.refunded}.`,
    `Aetherseed pulses ${pulseStats.pulses}, plants changed ${pulseStats.changes}.`,
    ...seatReport(),
  ].join("\n")),
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
let moveRun, cageHeld;
const FORMS_LIST = Object.keys(DROPS);
const TESTS = {
  seat: (p, [owner]) => { const b = p.dimension.getEntities({ type: "wilds:tuskbeast", location: p.location, maxDistance: 16, closest: 1 })[0]; p.sendMessage(b ? `seated ${testSeat(b, owner)}` : "no beast"); },
  move: (p, [on]) => {
    if (moveRun !== undefined) { system.clearRun(moveRun); moveRun = undefined; }
    if (on !== "on") return p.sendMessage("move off");
    moveRun = system.runInterval(() => { for (const b of allBeasts()) { try { const r = (b.getRotation().y * Math.PI) / 180; b.applyImpulse({ x: -Math.sin(r) * 0.06, y: 0, z: Math.cos(r) * 0.06 }); } catch { /* */ } } }, 2);
    p.sendMessage("move on");
  },
  dbg: (p) => p.sendMessage(JSON.stringify(seatStats)),
  tame: (p, [owner]) => {                                // tame the nearest beast to a stand-in owner (no real player here)
    const b = p.dimension.getEntities({ type: "wilds:tuskbeast", location: p.location, maxDistance: 16, closest: 1 })[0]; if (!b) return p.sendMessage("no beast");
    b.setDynamicProperty("wilds:owner", owner); b.setDynamicProperty("wilds:owner_name", owner); b.triggerEvent("wilds:on_tame");
    system.runTimeout(() => p.sendMessage(`tamed: is_tamed ${!!b.getComponent("minecraft:is_tamed")}, seats ${b.getComponent("minecraft:rideable")?.seatCount}, variant ${b.getComponent("minecraft:variant")?.value}`), 2);
  },
  howdah: (p) => {                                       // build a howdah on the nearest beast: first with empty pockets, then with 25 emeralds
    const b = p.dimension.getEntities({ type: "wilds:tuskbeast", location: p.location, maxDistance: 16, closest: 1 })[0]; if (!b) return p.sendMessage("no beast");
    const pocket = (items) => ({ size: items.length, getItem: (i) => items[i], setItem: (i, it) => { items[i] = it; } });
    const poor = { ...p, getComponent: () => ({ container: pocket([]) }), playSound: () => {} };
    p.sendMessage(`poor player: ${buildHowdah(b, poor)}`);
    const purse = [new ItemStack("minecraft:emerald", 25)], rich = { ...p, getComponent: () => ({ container: pocket(purse) }), playSound: () => {} };
    p.sendMessage(`player with 25 emeralds: ${buildHowdah(b, rich)} Emeralds left: ${purse[0]?.amount ?? 0}`);
    system.runTimeout(() => p.sendMessage(`howdah: seats ${b.getComponent("minecraft:rideable")?.seatCount}, variant ${b.getComponent("minecraft:variant")?.value}, chest ${b.getComponent("minecraft:inventory")?.container?.size}`), 2);
  },
  wild_visit: (p) => { wildVisit(p); wildInfo(p); },
  wild_info: (p) => wildInfo(p),
  // Checkpoint B (0.0.20)
  mimic_ages: (p) => { const c = {}; for (const m of p.dimension.getEntities({ type: "wilds:pebble_mimic" })) { const k = `${m.getComponent("minecraft:is_baby") ? "baby" : "adult"} size${m.getProperty("wilds:size")} scale${m.getComponent("minecraft:scale")?.value}`; c[k] = (c[k] ?? 0) + 1; } p.sendMessage(JSON.stringify(c)); },
  clock: (p) => p.sendMessage(`absolute ${world.getAbsoluteTime()} day ${world.getTimeOfDay()} tick ${system.currentTick} wilds clock ${playTicks()}`),
  mimic_babies: (p, [n]) => { for (let i = 0; i < (+n || 100); i++) p.dimension.spawnEntity("wilds:pebble_mimic", { x: p.location.x + (i % 10), y: p.location.y, z: p.location.z + Math.floor(i / 10) }, { spawnEvent: "minecraft:entity_born" }); p.sendMessage(`born ${n}`); },
  who: (p) => { for (const e of p.dimension.getEntities({ location: p.location, maxDistance: 6, families: ["wilds"] })) p.sendMessage(`${e.typeId} name="${e.nameTag}" ${JSON.stringify(snapshot(e))}`); },
  roost_place: (p) => { const b = p.dimension.getBlock(p.location); b.setType("wilds:aetherseed_roost"); p.sendMessage(`place: ${placeRoost(b, undefined)}`); },
  roost_assign: (p) => { const k = Object.keys(roostList()).find((x) => { const o = roostList()[x]; return Math.hypot(o.x - p.location.x, o.z - p.location.z) < 3; }); p.sendMessage(k ? assignNearest(k) : "no roost here"); },
  roost_free: (p) => { const k = Object.keys(roostList()).find((x) => { const o = roostList()[x]; return Math.hypot(o.x - p.location.x, o.z - p.location.z) < 3; }); if (k) freeRoost(k); p.sendMessage(k ? "freed" : "no roost here"); },
  roost_list: (p) => { const r = roostList(); p.sendMessage(`${Object.keys(r).length} roosts: ${JSON.stringify(r)} | ${JSON.stringify(roostStats)} | move ${JSON.stringify(moveStats)}`);
    for (const s of p.dimension.getEntities({ type: "wilds:aetherseed", location: p.location, maxDistance: 48 })) p.sendMessage(`  seed ${s.location.x.toFixed(1)},${s.location.y.toFixed(1)},${s.location.z.toFixed(1)} roost=${s.getDynamicProperty("wilds:roost") ?? "-"}`); },
  crop: (p, [id, stage]) => { const b = p.dimension.getBlock(p.location); p.dimension.getBlock({ ...p.location, y: p.location.y - 1 }).setType("minecraft:farmland"); try { b.setType(id); } catch (err) { return p.sendMessage(`${id}: ${err}`); } p.sendMessage(`${id} stage ${stageOf(b)}`); },
  crop_stage: (p) => { const b = p.dimension.getBlock(p.location); p.sendMessage(`${b.typeId} stage ${stageOf(b)}`); },
  mimic_visit: (p, [force]) => p.sendMessage(`${mimicVisit(p, force === "force")} | ${JSON.stringify(mimicLifeStats)} ${JSON.stringify(lifeStats)}`),
  baby: (p, [type, look]) => { const e = p.dimension.spawnEntity(type, p.location, { spawnEvent: "minecraft:entity_born" }); system.runTimeout(() => p.sendMessage(`${type} baby: ${JSON.stringify(snapshot(e))} affinity ${e.getProperty?.("wilds:affinity") ?? "-"} | ${JSON.stringify(lifeStats)}`), 3); },
  fed: (p) => { for (const e of p.dimension.getEntities({ location: p.location, maxDistance: 6, families: ["wilds"] })) e.setDynamicProperty("wilds:fed_at", playTicks()); p.sendMessage("all creatures here count as just fed"); },
  grow_all: (p) => { for (const e of p.dimension.getEntities({ location: p.location, maxDistance: 48, families: ["wilds"] })) { const at = e.getDynamicProperty("wilds:born_at"); if (at !== undefined) e.setDynamicProperty("wilds:born_at", at - 30000); } p.sendMessage("babies here now count as old enough"); },
  // Checkpoint A (0.0.19)
  sq_remove: (p) => { const e = p.dimension.getEntities({ location: p.location, maxDistance: 64 }).find((x) => x.getDynamicProperty("wilds:sq") || x.getDynamicProperty("wilds:tb_square")); if (!e) return p.sendMessage("none"); p.sendMessage(`removed ${e.typeId} quietly (no death)`); e.remove(); },
  sq_fake: (p) => { const cx = Math.floor(p.location.x / 750), cz = Math.floor(p.location.z / 750); world.setDynamicProperty(`wilds:sq:tuskbeast:${cx},${cz}`, JSON.stringify({ v: 2, s: "live", id: null, t: Date.now() - 61000 })); p.sendMessage("fake reservation with no creature, 61 s old"); },
  sq_legacy: (p) => { const cx = Math.floor(p.location.x / 750), cz = Math.floor(p.location.z / 750);
    world.setDynamicProperty(`wilds:sq:tuskbeast:${cx},${cz}`, undefined);
    world.setDynamicProperty(`wilds:tb:${cx},${cz}`, JSON.stringify({ s: "wild", x: Math.floor(p.location.x), y: Math.floor(p.location.y), z: Math.floor(p.location.z) }));
    const b = p.dimension.spawnEntity("wilds:tuskbeast", p.location); b.setDynamicProperty("wilds:tb_square", `${cx},${cz}`); p.sendMessage(`old-style record and beast in square ${cx},${cz}`); },
  zombies: (p) => p.sendMessage(p.dimension.getEntities({ type: "minecraft:zombie" }).map((z) => `${Math.floor(z.location.x)},${Math.floor(z.location.y)},${Math.floor(z.location.z)} spell=${z.getDynamicProperty("wilds:spell") ?? "-"}`).join("; ") || "no zombies"),
  // a stand-in player with a 9-slot inventory: slot 0 holds the given items
  txn: (p, [what]) => {
    const slots = Array(9).fill(undefined), log = [];
    const fake = (sel = 0) => ({ id: "T1", name: "Tester", isValid: true, dimension: p.dimension, location: p.location, selectedSlotIndex: sel,
      getGameMode: () => "Survival", sendMessage: (m) => log.push(m),
      getComponent: () => ({ container: { size: 9, getItem: (i) => slots[i]?.clone(), setItem: (i, it) => { slots[i] = it?.clone(); }, addItem: (it) => { const k = slots.findIndex((x) => !x); if (k < 0) return it; slots[k] = it.clone(); return undefined; } } }) });
    const seed = () => p.dimension.getEntities({ type: "wilds:aetherseed", location: p.location, maxDistance: 8, closest: 1 })[0];
    const show = () => slots.map((x, i) => (x ? `${i}:${x.typeId.split(":")[1]}x${x.amount}` : "")).filter(Boolean).join(" ");
    slots[0] = new ItemStack(EMPTY, 3);
    if (what === "switched") { p.sendMessage(`catch after switching slot: ${catchWith(fake(4), 0, seed())} | ${show()} | seed still here: ${!!seed()}`); return; }
    if (what === "busy") { lock(seed()); p.sendMessage(`catch while busy: ${catchWith(fake(), 0, seed())} | ${show()}`); unlock(seed()); return; }
    if (what === "far") { const s = seed(); s.teleport({ ...p.location, x: p.location.x + 10 }); p.sendMessage(`catch from 10 blocks: ${catchWith(fake(), 0, s)} | ${show()}`); s.teleport(p.location); return; }
    const r1 = catchWith(fake(), 0, seed());
    const full = slots.find((x) => x?.typeId.startsWith("wilds:cage_")), fslot = slots.indexOf(full);
    p.sendMessage(`catch: ${r1} | ${show()} | seed still here: ${!!seed()}`);
    const caught = slots[fslot].getDynamicProperty("wilds:caught");
    if (what === "moved") { slots[7] = slots[fslot]; slots[fslot] = undefined; p.sendMessage(`release after moving the cage: ${releaseWith(fake(fslot), fslot, full.typeId, caught, p.location)} | ${show()} | seed: ${!!seed()}`); return; }
    p.sendMessage(`release: ${releaseWith(fake(fslot), fslot, full.typeId, caught, p.location)} | ${show()} | seed: ${!!seed()}`);
    p.sendMessage(`release again with the same cage: ${releaseWith(fake(fslot), fslot, full.typeId, caught, p.location)} | ${show()}`);
  },
  senddown: (p, [who]) => {                                // who: a player id (T1 = the beast's owner in these tests)
    const b = p.dimension.getEntities({ type: "wilds:tuskbeast", location: p.location, maxDistance: 24, closest: 1 })[0];
    const before = b.getComponent("minecraft:rideable").getRiders().length;
    dismountCrew(b, { id: who, sendMessage: (m) => p.sendMessage(`  to ${who}: ${m}`) });
    p.sendMessage(`${who}: riders ${before} -> ${b.getComponent("minecraft:rideable").getRiders().length}`);
  },
  sq_check: (p) => { for (const s of allSpawners()) { s.reconcile(p); p.sendMessage(s.info(p)); } p.sendMessage(JSON.stringify(spawnerStats)); },
  tusk_hit: (p, [who]) => {                               // who: crew (riding this beast) | mounted (skeleton riding a spider) | foot (guard on foot)
    const b = p.dimension.getEntities({ type: "wilds:tuskbeast", location: p.location, maxDistance: 24, closest: 1 })[0]; if (!b) return p.sendMessage("no beast");
    const h = b.getComponent("minecraft:health"), before = h.currentValue;
    let a;
    if (who === "crew") a = b.getComponent("minecraft:rideable").getRiders().find((r) => r.typeId.startsWith("guilds:merc_"));
    else if (who === "mounted") { const m = p.dimension.spawnEntity("minecraft:spider", { ...p.location, x: p.location.x + 6 }); a = p.dimension.spawnEntity("minecraft:skeleton", m.location); m.getComponent("minecraft:rideable").addRider(a); }
    else if (who === "other") a = p.dimension.getEntities({ families: ["ironhome_mercenary"], location: p.location, maxDistance: 48 }).find((m) => { const r = m.getComponent("minecraft:riding")?.entityRidingOn; return r?.typeId === "wilds:tuskbeast" && r.id !== b.id; });
    else a = p.dimension.getEntities({ families: ["ironhome_mercenary"], location: p.location, maxDistance: 32 }).find((m) => !m.getComponent("minecraft:riding"));
    if (!a) return p.sendMessage(`no attacker for ${who}`);
    b.applyDamage(10, { cause: "entityAttack", damagingEntity: a });
    system.runTimeout(() => p.sendMessage(`${who} (${a.typeId}, riding ${a.getComponent("minecraft:riding")?.entityRidingOn?.typeId ?? "nothing"}): health ${before} -> ${h.currentValue} | ${JSON.stringify(immunityStats)}`), 2);
  },
  // Mimic drops (0.0.17): what each form drops, large and small, with a pickaxe and with a sword; then really drop one set here
  mimic_drops: (p) => {
    const rows = FORMS_LIST.map((f, i) => `${f}: L ${JSON.stringify(dropsFor(i, true, "minecraft:wooden_pickaxe"))} S ${JSON.stringify(dropsFor(i, false, "minecraft:netherite_pickaxe"))} sword ${JSON.stringify(dropsFor(i, true, "minecraft:diamond_sword"))}`);
    for (const r of rows) p.sendMessage(r);
    for (const [item, n] of dropsFor(0, true, "minecraft:iron_pickaxe")) p.dimension.spawnItem(new ItemStack(item, n), p.location);
  },
  // Spawn eggs (0.0.16): hatch every egg in a row along x
  eggs: (p) => {
    const made = EGGS.map((g, i) => hatch(g.id, p.dimension, { x: p.location.x + i * 2, y: p.location.y, z: p.location.z }));
    system.runTimeout(() => p.sendMessage(made.map((e, i) => { const v = (id) => e.getComponent(id)?.value; const g = EGGS[i];
      return `${g.creature}/${g.look}=${e.typeId.split(":")[1]} mark ${v("minecraft:mark_variant") ?? "-"}${e.typeId.endsWith("mimic") ? ` form ${e.getProperty("wilds:form")} size ${e.getProperty("wilds:size")}` : e.typeId.endsWith("seed") ? ` form ${e.getProperty("wilds:form")}` : ""}`; }).join("; ") + ` | ${JSON.stringify(eggStats)}`), 3);
  },
  // Bloomling (0.0.15)
  bloom_looks: (p) => { const r = looksAt(p.dimension, { x: Math.floor(p.location.x), y: Math.floor(p.location.y), z: Math.floor(p.location.z) }); p.sendMessage(`${r.biome}, ${r.day ? "day" : "night"}: ${r.looks.join(", ") || "none"}`); },
  bloom_spawn: (p, [look]) => { spawnBloomling(p.dimension, p.location, look ?? "original"); p.sendMessage(`spawned ${look ?? "original"}`); },
  bloom_visit: (p, [force]) => p.sendMessage(`visit: ${bloomVisit(p, force === "force")} | ${JSON.stringify(bloomStats)}`),
  bloom_breed: (p, [a, b]) => {                           // two parents of looks a and b, then a baby born next to them
    spawnBloomling(p.dimension, p.location, a, false); spawnBloomling(p.dimension, { ...p.location, x: p.location.x + 1 }, b, false);
    system.runTimeout(() => { p.dimension.spawnEntity("wilds:bloomling", { ...p.location, z: p.location.z + 0.5 }, { spawnEvent: "minecraft:entity_born" }); }, 2);
    system.runTimeout(() => { const kids = p.dimension.getEntities({ type: "wilds:bloomling", location: p.location, maxDistance: 3 }).filter((x) => x.getComponent("minecraft:is_baby"));
      p.sendMessage(`babies: ${kids.map((k) => BLOOM_LOOKS[k.getComponent("minecraft:mark_variant")?.value ?? 0]).join(", ")} | ${JSON.stringify(bloomStats)}`); }, 8);
  },
  bloom_list: (p) => { const c = {}; for (const b of p.dimension.getEntities({ type: "wilds:bloomling", location: p.location, maxDistance: 64 })) { const k = `${BLOOM_LOOKS[b.getComponent("minecraft:mark_variant")?.value ?? 0]}${b.getComponent("minecraft:is_baby") ? "(baby)" : ""}${b.getComponent("minecraft:persistent") ? "" : "(wild)"}`; c[k] = (c[k] ?? 0) + 1; } p.sendMessage(JSON.stringify(c)); },
  // Frost Lynx (0.0.14)
  lynx_visit: (p) => { lynxSpawner.visit(p); p.sendMessage(lynxSpawner.info(p)); },
  lynx_info: (p) => { for (const l of p.dimension.getEntities({ type: "wilds:frost_lynx", location: p.location, maxDistance: 48 })) p.sendMessage(lynxInfo(l)); p.sendMessage(JSON.stringify(lynxStats)); },
  lynx_tame: (p, [owner]) => { const l = p.dimension.getEntities({ type: "wilds:frost_lynx", location: p.location, maxDistance: 16, closest: 1 })[0]; if (!l) return p.sendMessage("no lynx");
    l.triggerEvent("wilds:on_tame"); l.setDynamicProperty("wilds:owner", owner ?? "test"); l.setDynamicProperty("wilds:mode", "follow"); system.runTimeout(() => p.sendMessage(lynxInfo(l)), 2); },
  lynx_mode: (p, [mode]) => { const l = p.dimension.getEntities({ type: "wilds:frost_lynx", location: p.location, maxDistance: 16, closest: 1 })[0]; if (!l) return p.sendMessage("no lynx"); setMode(l, mode); system.runTimeout(() => p.sendMessage(lynxInfo(l)), 2); },
  lynx_trick: (p) => { const l = p.dimension.getEntities({ type: "wilds:frost_lynx", location: p.location, maxDistance: 16, closest: 1 })[0]; p.sendMessage(l ? `trick ${reward(undefined, l)} | ${JSON.stringify(lynxStats)}` : "no lynx"); },
  // Cage (0.0.13): catch the nearest creature, then let it out here (optionally as if kept N minutes)
  cage_catch: (p) => {
    const e = p.dimension.getEntities({ location: p.location, maxDistance: 16, families: ["wilds"] }).filter((x) => x.typeId !== "wilds:seat_keeper")
      .sort((a, b) => Math.hypot(a.location.x - p.location.x, a.location.z - p.location.z) - Math.hypot(b.location.x - p.location.x, b.location.z - p.location.z))[0];
    if (!e) return p.sendMessage("nothing to catch");
    if (!CAGEABLE[e.typeId]) return p.sendMessage(`${e.typeId}: won't fit in a cage`);
    cageHeld = capture(e);
    p.sendMessage(`caught: ${cageHeld.typeId}, hp ${cageHeld.getDynamicProperty("wilds:hp")}, lore ${JSON.stringify(cageHeld.getLore())}, ${e.isValid ? "still in the world!" : "gone from the world"}`);
  },
  cage_release: (p, [minutes]) => {
    if (!cageHeld) return p.sendMessage("nothing caged");
    if (minutes) cageHeld.setDynamicProperty("wilds:caught", playTicks() - Math.round(+minutes * 1200));
    const e = release(cageHeld, p.dimension, p.location); cageHeld = undefined;
    system.runTimeout(() => p.sendMessage(`released ${e.typeId}: form ${e.getProperty("wilds:form")}, look ${e.getComponent("minecraft:mark_variant")?.value}, hp ${e.getComponent("minecraft:health")?.currentValue} | ${JSON.stringify(cageStats)}`), 2);
  },
  // Aetherseed (0.0.12)
  seed_spawn: (p, [form]) => { spawnSeed(p.dimension, p.location, form ?? "original"); p.sendMessage(`spawned ${form ?? "original"}`); },
  seed_visit: (p) => { seedSpawner.visit(p); p.sendMessage(seedSpawner.info(p)); },
  seed_age: (p, [h]) => p.sendMessage(seedSpawner.age(p, (+h || 0) * 3600 * 1000)),
  seed_light: (p) => p.sendMessage(seedReport(p)),
  seed_bonemeal: (p) => { const s = p.dimension.getEntities({ type: "wilds:aetherseed", location: p.location, maxDistance: 16, closest: 1 })[0]; p.sendMessage(s ? `now ${boneMeal(s)}` : "no seed"); },
  seed_zombie: (p) => { const s = p.dimension.getEntities({ type: "wilds:aetherseed", location: p.location, maxDistance: 16, closest: 1 })[0]; p.sendMessage(s ? summonZombie(s) : "no seed"); },
  seed_snuff: (p) => { const s = p.dimension.getEntities({ type: "wilds:aetherseed", location: p.location, maxDistance: 16, closest: 1 })[0]; p.sendMessage(s ? `snuffed ${snuff(s)}` : "no seed"); },
  seed_village: (p, [force]) => p.sendMessage(`village: ${villageCheck(p, force === "force")}`),
  forms: (p) => {                                        // form (saved) and look (mark_variant) must match
    let ok = 0, bad = 0;
    for (const t of ["wilds:pebble_mimic", "wilds:aetherseed"]) for (const e of p.dimension.getEntities({ type: t })) { if (e.getProperty("wilds:form") === (e.getComponent("minecraft:mark_variant")?.value ?? 0)) ok++; else bad++; }
    p.sendMessage(`forms matching their look: ${ok}, not matching: ${bad}`);
  },
  biomes: (p) => { try { p.sendMessage(`biome here: ${p.dimension.getBiome(p.location)?.id}`); } catch (err) { p.sendMessage(`${err}`); } },   // TW-01: BiomeTypes is not in @minecraft/server 2.6.0
  looks: (p) => { for (const b of p.dimension.getEntities({ type: "wilds:tuskbeast", location: p.location, maxDistance: 400 })) { const c = (id) => b.getComponent(id)?.value; p.sendMessage(`beast ${Math.floor(b.location.x)} ${Math.floor(b.location.y)} ${Math.floor(b.location.z)}: kind ${c("minecraft:mark_variant")} (${b.getDynamicProperty("wilds:kind")}), build ${c("minecraft:variant")}, wounded ${c("minecraft:skin_id")}`); } },
  wild_age: (p, [h]) => wildAge(p, (+h || 0) * 3600 * 1000),
  invite_check: (p) => {                                 // the invite rules with stand-in players (no real players on the test server)
    const fake = (id, name) => ({ id, name, sendMessage: (m) => p.sendMessage(`  to ${name}: ${m}`) });
    const own = fake("wt_owner", "Olly"), pip = fake("wt_pip", "Pip"), sam = fake("wt_sam", "Sam");
    const beast = { getDynamicProperty: (k) => ({ "wilds:owner": own.id, "wilds:owner_name": own.name })[k] };
    const ride = () => `Olly ${mayRide(own, beast)}, Pip ${mayRide(pip, beast)}, Sam ${mayRide(sam, beast)}`;
    p.sendMessage(`before: ${ride()}`); toggleInvite(own, pip); p.sendMessage(`Pip invited: ${ride()}`);
    toggleInvite(own, pip); p.sendMessage(`tapped again: ${ride()}`);
    toggleInvite(own, sam); uninvite(own, "sAm"); p.sendMessage(`typed uninvite: ${ride()}`);
    const free = { getDynamicProperty: () => undefined }; p.sendMessage(`unowned beast, Sam may ride: ${mayRide(sam, free)}`);
  },
  tower: (p) => { for (const b of allBeasts()) p.sendMessage(towerReport(b)); },
  invites: (p, [owner]) => p.sendMessage(`invites of ${owner}: ${JSON.stringify(invites(owner))}`),
  report: (p) => {
    p.sendMessage(`guilds=${guildsPresent()} tower=${seatStats.towerShots} bolts=${seatStats.bolts} boltHits=${seatStats.boltHits} native=${seatStats.nativeShots} ff=${guardStats.mode}/${guardStats.blocked}/${guardStats.refunded} pulses=${pulseStats.pulses} changes=${pulseStats.changes}`);
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
