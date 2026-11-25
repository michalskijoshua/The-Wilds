// Pebble Mimic survival loop (0.0.20, TW-02/TW-18).
//   Breeding: cobblestone (entity file: minecraft:breedable). Each baby rolls its OWN affinity at birth, with the same
//   odds as a wild one (70 / 20 / 5 / 4.5 / 0.5 %), and its future size; it grows up in 20 minutes (shared clock,
//   core/lifecycle.js). Parents rest 5 minutes. Wild and bred Mimics follow the same rules (one change of form, drops).
//   Natural spawning (Claude's numbers, easy to change): every 60 s per player, a 3 in 10 chance of one Mimic 12-28
//   blocks away, while fewer than 4 are within 64 blocks. On the surface it needs open stone-family ground (stone,
//   gravel, sand, clay, tuff...); below y 50 it can also appear on a cave floor near the player. It starts as stone and
//   takes its first form from the blocks it touches, as always.
import { world, system } from "@minecraft/server";
import { guard, dbg } from "../core/util.js";
import { registerLife, born, isBaby } from "../core/lifecycle.js";
import { groundAt } from "../core/spawner.js";

const MIMIC = "wilds:pebble_mimic";
registerLife(MIMIC, { breedItems: ["minecraft:cobblestone"], grow: 24000, rest: 6000 });
export const mimicLifeStats = { births: 0, spawned: 0 };

world.afterEvents.entitySpawn.subscribe(guard("mimic.born", (e) => {
  const m = e.entity; if (m?.typeId !== MIMIC) return;
  system.runTimeout(guard("mimic.born2", () => {
    if (!m.isValid || !isBaby(m) || m.getDynamicProperty("wilds:born_at") !== undefined) return;
    born(m); mimicLifeStats.births++;
    dbg(`a Pebble Mimic was born (affinity ${m.getProperty("wilds:affinity")}, will be ${m.getProperty("wilds:size") ? "large" : "small"})`);
  }), 1);
}));

const GROUND = /^minecraft:(stone|cobblestone|mossy_cobblestone|andesite|diorite|granite|tuff|deepslate|cobbled_deepslate|gravel|sand|red_sand|sandstone|red_sandstone|clay|calcite|dripstone_block|coal_ore|deepslate_coal_ore)$/;
export const MIMIC_SPAWN = { every: 1200, odds: 0.3, cap: 4, capRange: 64, minR: 12, maxR: 28 };
const roomAt = (dim, l) => { try { const a = dim.getBlock(l), b = dim.getBlock({ ...l, y: l.y + 1 }); return a?.isAir && b?.isAir; } catch { return false; } };
/** One spawn try around a visitor (a player or a stand-in in tests). */
export function mimicVisit(p, force = false) {
  const dim = p.dimension; if (dim.id !== "minecraft:overworld") return "not overworld";
  if (dim.getEntities({ type: MIMIC, location: p.location, maxDistance: MIMIC_SPAWN.capRange }).length >= MIMIC_SPAWN.cap) return "enough here";
  if (!force && Math.random() > MIMIC_SPAWN.odds) return "not this time";
  for (let i = 0; i < 8; i++) {
    const a = Math.random() * Math.PI * 2, r = MIMIC_SPAWN.minR + Math.random() * (MIMIC_SPAWN.maxR - MIMIC_SPAWN.minR);
    const x = Math.floor(p.location.x + Math.cos(a) * r), z = Math.floor(p.location.z + Math.sin(a) * r);
    const cands = [];
    const top = groundAt(dim, x, z); if (top !== undefined) cands.push(top);
    if (p.location.y < 50) for (let dy = -6; dy <= 6; dy++) cands.push(Math.floor(p.location.y) + dy);   // a cave floor near the player
    for (const y of cands) {
      let under; try { under = dim.getBlock({ x, y: y - 1, z }); } catch { continue; }
      if (!GROUND.test(under?.typeId ?? "") || !roomAt(dim, { x, y, z })) continue;
      dim.spawnEntity(MIMIC, { x: x + 0.5, y, z: z + 0.5 }); mimicLifeStats.spawned++;
      return `a Mimic at ${x} ${y} ${z} on ${under.typeId.replace("minecraft:", "")}`;
    }
  }
  return "no spot";
}
system.runInterval(guard("mimic.spawn", () => { for (const p of world.getAllPlayers()) { try { mimicVisit(p); } catch (err) { console.warn(`[wilds] mimic spawn: ${err}`); } } }), MIMIC_SPAWN.every);
