// Bloomling (0.0.15, Batch D, Director 24 Nov 2026): a passive, common, rabbit-like flower creature.
// 8 looks (q.mark_variant, events wilds:look_<n>); where and when each appears is in LOOK_RULES. "Day" and "night" are
// the in-game clock. A script spawner (not light-level spawn rules, which leak under thick canopy): every 20 s per
// player, up to 8 Bloomlings around them; a small group of 2-4 of one look appears 20-40 blocks away.
// Babies (bred with any small flower) take ONE parent's look at random; breeding never makes a new kind.
// Eats flowers (entity file). Flees players who don't sneak, wolves, foxes, cats, ocelots, lynxes, zombies.
// Drops what a rabbit drops. Can be caged; can't be tamed. Wild ones fade away like rabbits; released, bred or
// spawn-egg ones stay (wilds:keep).
import { world, system } from "@minecraft/server";
import { guard, dbg, sfx } from "./core/util.js";
import { biomeAt, groundAt } from "./core/spawner.js";
import { registerLife, born, isBaby } from "./core/lifecycle.js";

export const FLOWERS = ["dandelion", "poppy", "blue_orchid", "allium", "azure_bluet", "red_tulip", "orange_tulip", "white_tulip", "pink_tulip",
  "oxeye_daisy", "cornflower", "lily_of_the_valley"].map((f) => `minecraft:${f}`);
registerLife("wilds:bloomling", { breedItems: FLOWERS, grow: 24000, rest: 6000 });   // 20 min to grow up, 5 min rest (vanilla-style)

const BL = "wilds:bloomling";
export const LOOKS = ["original", "ember_tulip", "sunbonnet", "moonbell", "froststar", "poppy_patch", "clover_puff", "dusk_orchid"];
const B = {                                              // Bedrock biome ids (confirmed with the biomes test hook)
  plains: ["plains", "sunflower_plains"],
  forest: ["forest", "forest_hills", "flower_forest"],
  birch: ["birch_forest", "birch_forest_hills", "birch_forest_mutated", "birch_forest_hills_mutated"],
  mountains: ["extreme_hills", "extreme_hills_edge", "extreme_hills_mutated", "extreme_hills_plus_trees", "extreme_hills_plus_trees_mutated", "meadow"],
  spruce: ["taiga", "taiga_hills", "taiga_mutated", "mega_taiga", "mega_taiga_hills", "redwood_taiga_mutated", "redwood_taiga_hills_mutated", "cold_taiga", "cold_taiga_hills", "cold_taiga_mutated"],
  savanna: ["savanna", "savanna_plateau", "savanna_mutated", "savanna_plateau_mutated"],
  cherry: ["cherry_grove"], dappled: ["dappled_forest"],
  jungle: ["jungle", "jungle_hills", "jungle_edge", "jungle_edge_mutated", "jungle_mutated", "bamboo_jungle", "bamboo_jungle_hills"],
  swamp: ["swampland", "swampland_mutated", "mangrove_swamp"],
};
const any = (...ks) => ks.flatMap((k) => B[k]);
// when: "day" | "night" | "any"; biomes: list; snow / sunflower: special places (any time)
export const LOOK_RULES = {
  original: { when: "day", biomes: any("plains", "forest", "mountains", "spruce") },
  ember_tulip: { when: "night", biomes: any("plains", "savanna") },
  sunbonnet: { when: "any", biomes: any("savanna"), sunflower: true },
  moonbell: { when: "night", biomes: any("cherry", "dappled") },
  froststar: { when: "any", biomes: [], snow: true },
  poppy_patch: { when: "day", biomes: any("spruce", "dappled") },
  clover_puff: { when: "night", biomes: any("birch", "forest", "spruce") },
  dusk_orchid: { when: "night", biomes: any("spruce", "jungle", "plains", "swamp") },
};
export const isDay = () => { const t = world.getTimeOfDay(); return t < 12000 || t >= 23500; };
const hasSnow = (dim, s) => { try { const a = dim.getBlock(s), b = dim.getBlock({ x: s.x, y: s.y - 1, z: s.z }); return a?.typeId === "minecraft:snow_layer" || b?.typeId === "minecraft:snow" || b?.typeId === "minecraft:snow_layer"; } catch { return false; } };
function nearSunflower(dim, s) {
  for (let x = -6; x <= 6; x++) for (let z = -6; z <= 6; z++) for (let y = -2; y <= 2; y++) {
    try { if (dim.getBlock({ x: s.x + x, y: s.y + y, z: s.z + z })?.typeId === "minecraft:sunflower") return true; } catch { /* */ }
  }
  return false;
}
/** The looks that may appear at a spot right now. */
export function looksAt(dim, spot, day = isDay()) {
  const biome = biomeAt(dim, spot), out = [];
  for (const [l, r] of Object.entries(LOOK_RULES)) {
    const timeOk = r.when === "any" || (r.when === "day") === day;
    if ((r.snow && hasSnow(dim, spot)) || (r.sunflower && nearSunflower(dim, spot)) || (timeOk && r.biomes.includes(biome))) out.push(l);
  }
  return { biome, day, looks: out };
}

/** Room for a Bloomling: the block it stands in and the one above are air or a plant it can stand in (no water). */
const SOFT = /(^minecraft:(short_grass|tall_grass|fern|large_fern|snow_layer|dead_bush|.*_flower|.*tulip|poppy|dandelion|blue_orchid|allium|azure_bluet|oxeye_daisy|cornflower|lily_of_the_valley|sweet_berry_bush|.*_sapling)$)/;
function openAt(dim, s) {
  try { for (const dy of [0, 1]) { const b = dim.getBlock({ x: s.x, y: s.y + dy, z: s.z }); if (!b || b.isLiquid || !(b.isAir || SOFT.test(b.typeId))) return false; } return true; } catch { return false; }
}
export function spawnBloomling(dim, at, look, wild = true, baby = false) {
  const e = baby ? dim.spawnEntity(BL, at, { spawnEvent: "minecraft:entity_born" }) : dim.spawnEntity(BL, at), i = Math.max(0, LOOKS.indexOf(look));
  e.triggerEvent(`wilds:look_${i}`); e.setDynamicProperty("wilds:look", i);
  if (!wild) e.triggerEvent("wilds:keep");
  return e;
}
export const SPAWN = { every: 400, cap: 8, capRange: 48, group: [2, 4], minR: 20, maxR: 40, odds: 0.6 };
export const bloomStats = { groups: 0, spawned: 0, babies: 0, ate: 0 };
/** One spawn try around a visitor (a player, or a stand-in in server tests). Returns what happened. */
export function bloomVisit(p, force = false) {
  const dim = p.dimension; if (dim.id !== "minecraft:overworld") return "not overworld";
  if (dim.getEntities({ type: BL, location: p.location, maxDistance: SPAWN.capRange }).length >= SPAWN.cap) return "enough here";
  if (!force && Math.random() > SPAWN.odds) return "not this time";
  for (let i = 0; i < 6; i++) {
    const a = Math.random() * Math.PI * 2, r = SPAWN.minR + Math.random() * (SPAWN.maxR - SPAWN.minR);
    const x = Math.floor(p.location.x + Math.cos(a) * r), z = Math.floor(p.location.z + Math.sin(a) * r), y = groundAt(dim, x, z);
    if (y === undefined) continue;
    const spot = { x, y, z }, here = looksAt(dim, spot);
    if (!here.looks.length) continue;
    const look = here.looks[Math.floor(Math.random() * here.looks.length)], n = SPAWN.group[0] + Math.floor(Math.random() * (SPAWN.group[1] - SPAWN.group[0] + 1));
    // TW-36: every member gets its own checked spot (ground, open air, still allowed for this look); skip if none
    let made = 0;
    for (let k = 0; k < n; k++) {
      for (let tries = 0; tries < 4; tries++) {
        const mx = x + Math.round((Math.random() - 0.5) * 6), mz = z + Math.round((Math.random() - 0.5) * 6), my = groundAt(dim, mx, mz);
        if (my === undefined || Math.abs(my - y) > 3) continue;
        const ms = { x: mx, y: my, z: mz };
        if (!openAt(dim, ms) || !looksAt(dim, ms).looks.includes(look)) continue;
        spawnBloomling(dim, { x: mx + 0.5, y: my, z: mz + 0.5 }, look); made++; break;
      }
    }
    if (!made) continue;
    bloomStats.groups++; bloomStats.spawned += made;
    return `${made} of ${n} ${look} at ${x} ${y} ${z} (${here.biome}, ${here.day ? "day" : "night"})`;
  }
  return "no spot";
}
system.runInterval(guard("bloomlings", () => { for (const p of world.getAllPlayers()) bloomVisit(p); }), SPAWN.every);

// every new Bloomling gets its look settled once: babies from a parent, spawn-egg ones keep theirs and stay
world.afterEvents.entitySpawn.subscribe(guard("bloom.new", (e) => {
  const b = e.entity; if (b?.typeId !== BL) return;
  system.runTimeout(guard("bloom.new2", () => {
    if (!b.isValid || b.getDynamicProperty("wilds:look") !== undefined) return;
    if (isBaby(b)) {
      // TW-37: the baby takes the look of one of its REAL parents (the pair fed a flower just now, right here)
      const parents = born(b);
      const from = parents[Math.floor(Math.random() * parents.length)];
      const i = from?.getComponent("minecraft:mark_variant")?.value ?? 0;
      b.triggerEvent(`wilds:look_${i}`); b.setDynamicProperty("wilds:look", i); bloomStats.babies++;
      dbg(`a ${LOOKS[i]} Bloomling was born (parents: ${parents.map((x) => LOOKS[x.getComponent("minecraft:mark_variant")?.value ?? 0]).join(" + ") || "not found"})`);
    } else {
      b.setDynamicProperty("wilds:look", b.getComponent("minecraft:mark_variant")?.value ?? 0);
      b.triggerEvent("wilds:keep");                     // not from the wild spawner: a spawn egg or a command
    }
  }), 1);
}));
// grazing a flower plays its graze move
world.afterEvents.dataDrivenEntityTrigger.subscribe(guard("bloom.ate", (e) => {
  const b = e.entity; const l = LOOKS[b.getComponent("minecraft:mark_variant")?.value ?? 0];
  try { b.playAnimation(`animation.wilds_bloomling_${l}.graze`); } catch { /* */ }
  sfx(b.dimension, "wilds.bloomling.eat", b.location, 0.8);
  bloomStats.ate++;
}), { entityTypes: [BL], eventTypes: ["wilds:ate_flower"] });
