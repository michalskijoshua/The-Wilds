// The Aetherseed's life in the wild (0.0.12, Director 24 Nov 2026). Its pulses are in pulse.js.
//   Wild: Original in dappled forest, Bloom in cherry groves, Withered in dark forest and swamps (one per square), and
//         now and then a Withered one near a village (never in the deep dark).
//   Bone meal: Withered -> Original or Bloom (50/50); Original <-> Bloom.
//   No glow (Director 24 Nov 2026: the Kindlesprite is the one that lights up). 0.0.12 gave Original and Bloom a
//         travelling light block; the clean-up below stays so any light left by 0.0.12 is removed.
//   Withered: no light, purple specks; follows players holding a torch (main or off hand); snuffs placed torches
//         nearby (they pop off); summons zombies now and then (at most 2, long gaps) that vanish when it dies.
//         It never attacks anyone itself.
import { world, system, guard, jget, jset, dbg, dist, sfx, each } from "../core/util.js";
import { squareSpawner, biomeAt, groundAt } from "../core/spawner.js";
import { near, lock, unlock, pay } from "../core/txn.js";
import { glideToward } from "../core/move.js";

const SEED = "wilds:aetherseed", FORMS = ["original", "bloom", "withered"];
const formOf = (s) => s.getProperty("wilds:form");
export const lifeStats = { lights: 0, lightsRemoved: 0, snuffed: 0, zombies: 0, zombiesGone: 0, villageSeeds: 0 };
const DIMS = ["overworld", "nether", "the_end"];
const seeds = () => DIMS.flatMap((d) => { try { return world.getDimension(d).getEntities({ type: SEED }); } catch { return []; } });

// ---- wild spawning
export const SEED_BIOMES = {
  original: ["dappled_forest"],
  bloom: ["cherry_grove"],
  withered: ["roofed_forest", "roofed_forest_mutated", "swampland", "swampland_mutated", "mangrove_swamp"],
};
const formForBiome = (b) => Object.keys(SEED_BIOMES).find((f) => SEED_BIOMES[f].includes(b));
export function spawnSeed(dim, at, form) {
  const s = dim.spawnEntity(SEED, at);
  s.triggerEvent(`wilds:form_${form}`);
  return s;
}
export const seedSpawner = squareSpawner({
  key: "aetherseed", square: 320, chance: 0.7, returnMs: 24 * 3600 * 1000,   // proposal: 7 in 10 fitting squares, back after 1 real day
  fits: (b) => !!formForBiome(b), minR: 16, maxR: 28,
  spawn: (dim, spot, biome) => spawnSeed(dim, { ...spot, y: spot.y + 1 }, formForBiome(biome)),
});

// near villages: rare, outside the village, never in the deep dark
const VILLAGE = { every: 1200, odds: 1 / 20, cooldownMs: 24 * 3600 * 1000, square: 256 };
export function villageCheck(p, force = false) {
  if (p.dimension.id !== "minecraft:overworld" || biomeAt(p.dimension, p.location) === "deep_dark") return "not here";
  const vs = p.dimension.getEntities({ type: "minecraft:villager_v2", location: p.location, maxDistance: 64 });
  if (vs.length < 3) return "no village";
  const c = { x: vs.reduce((a, v) => a + v.location.x, 0) / vs.length, y: p.location.y, z: vs.reduce((a, v) => a + v.location.z, 0) / vs.length };
  const k = `wilds:vw:${Math.floor(c.x / VILLAGE.square)},${Math.floor(c.z / VILLAGE.square)}`;
  if (!force && Date.now() - (jget(k, 0) ?? 0) < VILLAGE.cooldownMs) return "cooldown";
  if (p.dimension.getEntities({ type: SEED, location: c, maxDistance: 96 }).some((s) => formOf(s) === 2)) return "already one";
  if (!force && Math.random() > VILLAGE.odds) return "not this time";
  for (let i = 0; i < 8; i++) {
    const a = Math.random() * Math.PI * 2, r = 28 + Math.random() * 12, x = Math.floor(c.x + Math.cos(a) * r), z = Math.floor(c.z + Math.sin(a) * r);
    const y = groundAt(p.dimension, x, z); if (y === undefined) continue;
    if (biomeAt(p.dimension, { x, y, z }) === "deep_dark") continue;
    jset(k, Date.now());
    spawnSeed(p.dimension, { x: x + 0.5, y: y + 1, z: z + 0.5 }, "withered");
    lifeStats.villageSeeds++; dbg(`a Withered Aetherseed came near the village at ${x} ${y} ${z}`);
    return `spawned at ${x} ${y} ${z}`;
  }
  return "no spot";
}
system.runInterval(guard("seed.village", () => { for (const p of world.getAllPlayers()) villageCheck(p); }), VILLAGE.every);

// ---- bone meal
export function boneMeal(seed) {
  const f = formOf(seed), to = f === 2 ? (Math.random() < 0.5 ? 0 : 1) : 1 - f;
  seed.triggerEvent(`wilds:form_${FORMS[to]}`);
  try { seed.dimension.spawnParticle("minecraft:crop_growth_emitter", seed.location); seed.dimension.playSound("item.bone_meal.use", seed.location); } catch { /* */ }
  if (f === 2) dismissZombies(seed);
  return FORMS[to];
}
world.beforeEvents.playerInteractWithEntity.subscribe((e) => {
  if (e.target?.typeId !== SEED || e.itemStack?.typeId !== "minecraft:bone_meal") return;
  e.cancel = true;
  const p = e.player, seed = e.target, slot = p.selectedSlotIndex;
  system.run(guard("seed.bonemeal", () => {                  // TW-03: re-checked when it happens, paid before it works
    if (!near(p, seed, 6) || !lock(seed)) return;
    try { if (pay(p, slot, "minecraft:bone_meal", 1)) boneMeal(seed); } finally { unlock(seed); }
  }));
});

// ---- glow clean-up: 0.0.12's travelling light blocks are taken away (no seed glows any more)
const GLOW = false, LIGHT = "minecraft:light_block_10", REG = "wilds:seed_lights";
const isLight = (b) => b?.typeId?.startsWith("minecraft:light_block");
const lkey = (dimId, l) => `${dimId}|${l.x},${l.y},${l.z}`;
const parse = (k) => { const [d, xyz] = k.split("|"); const [x, y, z] = xyz.split(",").map(Number); return { d, l: { x, y, z } }; };
const reg = () => jget(REG, {});
function removeLight(k) {                                  // true when the record can go (removed, or not a light any more)
  const { d, l } = parse(k);
  let b; try { b = world.getDimension(d).getBlock(l); } catch { return false; }
  if (!b) return false;                                    // not loaded: try again later
  if (isLight(b)) { b.setType("minecraft:air"); lifeStats.lightsRemoved++; }
  return true;
}
function dropLight(seed) {
  const k = seed.getDynamicProperty("wilds:light"); if (!k) return;
  if (removeLight(k)) { const r = reg(); delete r[k]; jset(REG, r); }
  seed.setDynamicProperty("wilds:light", undefined);
}
function keepLight(seed) {
  const cur = seed.getDynamicProperty("wilds:light");
  if (!GLOW || formOf(seed) === 2) { if (cur) dropLight(seed); return; }
  const l = { x: Math.floor(seed.location.x), y: Math.floor(seed.location.y), z: Math.floor(seed.location.z) };
  const want = lkey(seed.dimension.id, l);
  if (cur === want) { try { if (isLight(seed.dimension.getBlock(l))) return; } catch { return; } }   // still there
  if (cur) dropLight(seed);
  let b; try { b = seed.dimension.getBlock(l); } catch { return; }
  if (!b?.isAir) return;                                   // inside a leaf or water: no light this moment
  b.setType(LIGHT); lifeStats.lights++;
  seed.setDynamicProperty("wilds:light", want);
  const r = reg(); r[want] = seed.id; jset(REG, r);
}
function sweepLights() {                                   // any recorded light whose seed no longer holds it goes
  const r = reg(); let changed = false;
  for (const [k, id] of Object.entries(r)) {
    const s = world.getEntity(id);
    if (s?.isValid && s.getDynamicProperty("wilds:light") === k) continue;
    if (removeLight(k)) { delete r[k]; changed = true; }
  }
  if (changed) jset(REG, r);
}
// TW-51: once no light is recorded anywhere and no loaded seed carries one, the clean-up is done for this world
// (wilds:lights_done). A seed from 0.0.12 that loads later still drops its own light the moment it is seen (cheap).
const lightsDone = () => { try { return !!world.getDynamicProperty("wilds:lights_done"); } catch { return false; } };
system.runInterval(guard("seed.light", () => {
  if (lightsDone()) return;
  each("seed.light", seeds(), (s) => { if (s.isValid) keepLight(s); });
}), 20);
system.runInterval(guard("seed.sweep", () => {
  if (lightsDone()) { each("seed.light", seeds(), (s) => { if (s.getDynamicProperty("wilds:light")) dropLight(s); }); return; }
  sweepLights();
  if (!Object.keys(reg()).length && !seeds().some((s) => s.getDynamicProperty("wilds:light"))) world.setDynamicProperty("wilds:lights_done", true);
}), 200);
world.afterEvents.worldLoad.subscribe(guard("seed.load", () => system.runTimeout(guard("seed.sweep0", sweepLights), 40)));
// dies or unloads: take its light now if the block is still loaded (otherwise the sweep does it later)
world.beforeEvents.entityRemove.subscribe((e) => {
  const s = e.removedEntity; if (s?.typeId !== SEED) return;
  let k, zs, spell; try { k = s.getDynamicProperty("wilds:light"); zs = s.getDynamicProperty("wilds:zombies"); spell = s.getDynamicProperty("wilds:spell"); } catch { return; }
  const id = s.id, dying = (() => { try { return (s.getComponent("minecraft:health")?.currentValue ?? 1) <= 0; } catch { return false; } })();
  system.run(guard("seed.gone", () => {
    if (k && removeLight(k)) { const r = reg(); delete r[k]; jset(REG, r); }
    if (dying && zs) for (const z of JSON.parse(zs)) vanish(world.getEntity(typeof z === "string" ? z : z.id));
    if (dying && spell) endSpell(spell);
    if (dying) dbg(`Aetherseed ${id} died: light and summoned zombies cleared`);
  }));
});
world.afterEvents.entityDie.subscribe(guard("seed.die", (e) => {
  const s = e.deadEntity; let k; try { k = s.getDynamicProperty("wilds:light"); } catch { return; }
  if (k && removeLight(k)) { const r = reg(); delete r[k]; jset(REG, r); }
  dismissZombies(s);
}), { entityTypes: [SEED] });

// ---- Withered: torches, zombies, purple specks
const holdsTorch = (p) => {
  const eq = p.getComponent("minecraft:equippable");
  return ["Mainhand", "Offhand"].some((slot) => { try { return /torch$/.test(eq?.getEquipment(slot)?.typeId ?? ""); } catch { return false; } });
};
const isPlacedTorch = (b) => /torch$/.test(b?.typeId ?? "");            // torch, soul_torch, redstone_torch, copper_torch...
// TW-22 (0.0.19): each run of summons ("a Withered spell") has its own id, stamped on its zombies. When the seed dies,
// is caged or is healed, that id goes on a world list of ended spells; a zombie of an ended spell vanishes when it is
// next loaded. A zombie whose seed is merely unloaded is left alone. Records: [{ id, t }] (t = when it was summoned).
const ENDED = "wilds:ended_spells", ENDED_KEEP_MS = 7 * 24 * 3600 * 1000, UNSEEN_COUNTS_MS = 10 * 60 * 1000;
const zombiesOf = (s) => { try { return JSON.parse(s.getDynamicProperty("wilds:zombies") ?? "[]").map((z) => (typeof z === "string" ? { id: z, t: Date.now() } : z)); } catch { return []; } };
function vanish(z) { if (!z?.isValid) return; try { z.dimension.spawnParticle("minecraft:obsidian_glow_dust_particle", z.location); z.remove(); lifeStats.zombiesGone++; } catch { /* */ } }
function endSpell(spell) {
  if (!spell) return;
  const now = Date.now(), ended = Object.fromEntries(Object.entries(jget(ENDED, {})).filter(([, t]) => now - t < ENDED_KEEP_MS));
  ended[spell] = now; jset(ENDED, ended);
}
export function dismissZombies(s) {
  let spell; try { spell = s.getDynamicProperty("wilds:spell"); } catch { /* */ }
  for (const z of zombiesOf(s)) vanish(world.getEntity(z.id));
  endSpell(spell);
  try { s.setDynamicProperty("wilds:zombies", undefined); s.setDynamicProperty("wilds:spell", undefined); } catch { /* */ }
}
export const WITHERED = { followRange: 16, snuffRange: 4, zombieMax: 2, zombieGapMs: [120000, 240000], firstZombieMs: [60000, 120000] };
const rnd = ([a, b]) => a + Math.random() * (b - a);

export function summonZombie(s) {
  // still counted: zombies that are here, and zombies not seen for less than 10 minutes (they may just be unloaded)
  const now = Date.now(), zs = zombiesOf(s).filter((z) => world.getEntity(z.id)?.isValid || now - z.t < UNSEEN_COUNTS_MS);
  if (zs.length >= WITHERED.zombieMax) { s.setDynamicProperty("wilds:zombies", JSON.stringify(zs)); return "enough"; }
  let spell = s.getDynamicProperty("wilds:spell");
  if (!spell) { spell = `${s.id}:${now.toString(36)}`; s.setDynamicProperty("wilds:spell", spell); }
  for (let i = 0; i < 6; i++) {
    const a = Math.random() * Math.PI * 2, x = Math.floor(s.location.x + Math.cos(a) * 4), z = Math.floor(s.location.z + Math.sin(a) * 4);
    const y = groundAt(s.dimension, x, z); if (y === undefined) continue;
    const zb = s.dimension.spawnEntity("minecraft:zombie", { x: x + 0.5, y, z: z + 0.5 });
    zb.setDynamicProperty("wilds:summoner", s.id); zb.setDynamicProperty("wilds:spell", spell);
    zs.push({ id: zb.id, t: now }); s.setDynamicProperty("wilds:zombies", JSON.stringify(zs)); lifeStats.zombies++;
    sfx(s.dimension, "wilds.aetherseed.withered_summon", s.location);
    try { s.dimension.spawnParticle("minecraft:obsidian_glow_dust_particle", zb.location); } catch { /* */ }
    return "summoned";
  }
  return "no spot";
}
export function snuff(s) {
  let n = 0; const r = WITHERED.snuffRange, c = { x: Math.floor(s.location.x), y: Math.floor(s.location.y), z: Math.floor(s.location.z) };
  for (let x = c.x - r; x <= c.x + r; x++) for (let z = c.z - r; z <= c.z + r; z++) for (let y = c.y - 3; y <= c.y + 2; y++) {
    let b; try { b = s.dimension.getBlock({ x, y, z }); } catch { continue; }
    if (!isPlacedTorch(b)) continue;
    try { s.dimension.runCommand(`setblock ${x} ${y} ${z} air destroy`); n++; lifeStats.snuffed++; sfx(s.dimension, "wilds.aetherseed.withered_snuff", { x: x + 0.5, y, z: z + 0.5 }); } catch { /* */ }
  }
  return n;
}
let beat = 0;
system.runInterval(guard("seed.withered", () => {
  beat++;
  const now = Date.now(), players = world.getAllPlayers();
  each("seed.withered", seeds(), (s) => {
    if (!s.isValid || formOf(s) !== 2) return;
    try { s.dimension.spawnParticle("minecraft:obsidian_glow_dust_particle", { x: s.location.x, y: s.location.y + 0.4, z: s.location.z }); } catch { /* */ }
    // follow a torch
    const p = players.filter((q) => q.dimension.id === s.dimension.id && dist(q.location, s.location) <= WITHERED.followRange && holdsTorch(q))
      .sort((a, b) => dist(a.location, s.location) - dist(b.location, s.location))[0];
    if (p) {
      const to = { x: p.location.x, y: p.location.y + 1.6, z: p.location.z }, d = dist(to, s.location);
      if (d > 2.5) glideToward(s, to, 0.6, 2.5);                              // TW-20: never through walls, doors or ceilings
    }
    if (beat % 4 === 0) snuff(s);
    // zombies now and then
    const due = s.getDynamicProperty("wilds:next_zombie");
    if (due === undefined) s.setDynamicProperty("wilds:next_zombie", now + rnd(WITHERED.firstZombieMs));
    else if (now >= due) { summonZombie(s); s.setDynamicProperty("wilds:next_zombie", now + rnd(WITHERED.zombieGapMs)); }
  });
  if (beat % 20 === 0) {                                   // a summoned zombie whose seed is gone vanishes too
    for (const d of DIMS) {
      let zs; try { zs = world.getDimension(d).getEntities({ type: "minecraft:zombie" }); } catch { continue; }
      const ended = jget(ENDED, {});
      for (const z of zs) { const sp = z.getDynamicProperty("wilds:spell"); if (sp && ended[sp]) vanish(z); }   // TW-22: only ended spells
    }
  }
}), 10);

export function seedReport(p) {
  const r = reg();
  const near = p.dimension.getEntities({ type: SEED, location: p.location, maxDistance: 32 })
    .map((s) => `${FORMS[formOf(s)]}@${Math.floor(s.location.x)},${Math.floor(s.location.y)},${Math.floor(s.location.z)} light=${s.getDynamicProperty("wilds:light") ?? "-"} zombies=${zombiesOf(s).length} spell=${s.getDynamicProperty("wilds:spell") ?? "-"}`);
  let lightBlocks = 0;
  for (let x = -12; x <= 12; x++) for (let z = -12; z <= 12; z++) for (let y = -6; y <= 6; y++) { try { if (isLight(p.dimension.getBlock({ x: p.location.x + x, y: p.location.y + y, z: p.location.z + z }))) lightBlocks++; } catch { /* */ } }
  return `seeds [${near.join("; ")}] | light blocks within 12: ${lightBlocks} | recorded lights ${Object.keys(r).length} | ${JSON.stringify(lifeStats)}`;
}

// ---- sounds by form (Codex, 0.0.18): idle now and then, hurt, death
const SEED_FORMS = ["original", "bloom", "withered"];
system.runInterval(guard("seed.sounds", () => {
  const now = Date.now();
  for (const s of seeds()) {
    if (!s.isValid) continue;
    const due = s.getDynamicProperty("wilds:next_sound") ?? 0;
    if (now < due) continue;
    if (due) sfx(s.dimension, `wilds.aetherseed.${SEED_FORMS[formOf(s)]}_idle`, s.location, 0.8);
    s.setDynamicProperty("wilds:next_sound", now + 8000 + Math.random() * 14000);
  }
}), 20);
world.afterEvents.entityHurt.subscribe(guard("seed.hurt", (e) => {
  const s = e.hurtEntity; if (!s.isValid || (s.getComponent("minecraft:health")?.currentValue ?? 0) <= 0) return;
  sfx(s.dimension, `wilds.aetherseed.${SEED_FORMS[formOf(s)]}_hurt`, s.location);
}), { entityTypes: [SEED] });
world.afterEvents.entityDie.subscribe(guard("seed.death", (e) => {
  const s = e.deadEntity; let f, at, dim; try { f = formOf(s); at = s.location; dim = s.dimension; } catch { return; }
  sfx(dim, `wilds.aetherseed.${SEED_FORMS[f]}_death`, at);
}), { entityTypes: [SEED] });
