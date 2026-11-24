// P0-4 Pebble Mimic affinity.
// The roll happens in the entity file (minecraft:entity_spawned, weights 750/200/40/9/1 out of 1000), so it runs once at
// birth, inside the engine, and is never rerolled: entity_spawned does not fire again on reload. The value lives in
// the entity property wilds:affinity, which saves with the mob. Size (small/large) is rolled the same way and is
// only a scale: large = half Codex's full model (2 blocks wide), small = half a large one (Director 24 Nov 2026).
// The look follows the form through q.mark_variant (event wilds:form_<n>), the Android-safe way.
// Approved: the 75 % common tier. Proposal: the other tiers and which form sits in which tier (FORMS below).
import { world, system, guard, dbg } from "../core/util.js";

const MIMIC = "wilds:pebble_mimic";
export const TIERS = ["common", "uncommon", "rare", "diamond", "netherite"];
// index = wilds:form, matching the Ore and Shell Variant models
export const FORMS = [
  { name: "stone", tier: 0, blocks: ["stone", "cobblestone", "andesite", "diorite", "granite", "deepslate", "cobbled_deepslate", "tuff"] },
  { name: "mossy", tier: 0, blocks: ["mossy_cobblestone", "moss_block", "mossy_stone_bricks"] },
  { name: "sand", tier: 0, blocks: ["sand", "red_sand", "sandstone", "red_sandstone"] },
  { name: "clay", tier: 0, blocks: ["clay", "hardened_clay", "mud"] },
  { name: "coal", tier: 0, blocks: ["coal_ore", "deepslate_coal_ore", "coal_block"] },
  { name: "copper", tier: 1, blocks: ["copper_ore", "deepslate_copper_ore", "raw_copper_block", "copper_block"] },
  { name: "iron", tier: 1, blocks: ["iron_ore", "deepslate_iron_ore", "raw_iron_block", "iron_block"] },
  { name: "gold", tier: 2, blocks: ["gold_ore", "deepslate_gold_ore", "nether_gold_ore", "raw_gold_block", "gold_block"] },
  { name: "diamond", tier: 3, blocks: ["diamond_ore", "deepslate_diamond_ore", "diamond_block"] },
  { name: "netherite", tier: 4, blocks: ["ancient_debris", "netherite_block"] },
];
const BY_BLOCK = new Map();
FORMS.forEach((f, i) => f.blocks.forEach((b) => BY_BLOCK.set(`minecraft:${b}`, i)));
const COOLDOWN_MS = 8000;
const last = new Map();
export const mimicStats = { transforms: 0, refused: 0 };

/** The one rule this prototype proves: a form is allowed only if its tier is at or below the mimic's affinity. */
export const allowed = (affinity, form) => FORMS[form].tier <= affinity;

function touching(e) {
  const l = e.location, x = Math.floor(l.x), y = Math.floor(l.y), z = Math.floor(l.z);
  const spots = [[0, -1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]];
  for (const [dx, dy, dz] of spots) {
    let b; try { b = e.dimension.getBlock({ x: x + dx, y: y + dy, z: z + dz }); } catch { continue; }
    const f = b && BY_BLOCK.get(b.typeId);
    if (f !== undefined) return f;
  }
  return undefined;
}

system.runInterval(guard("mimic", () => {
  const t = Date.now();
  for (const d of ["overworld", "nether", "the_end"]) {
    let list; try { list = world.getDimension(d).getEntities({ type: MIMIC }); } catch { continue; }
    for (const e of list) {
      if (!e.isValid || t - (last.get(e.id) ?? 0) < COOLDOWN_MS) continue;
      const f = touching(e); if (f === undefined) continue;
      const cur = e.getProperty("wilds:form");
      if (e.getComponent("minecraft:mark_variant")?.value !== cur) e.triggerEvent(`wilds:form_${cur}`);   // the look follows the form
      if (f === cur) continue;
      const aff = e.getProperty("wilds:affinity");
      last.set(e.id, t);
      if (!allowed(aff, f)) { mimicStats.refused++; dbg(`mimic (${TIERS[aff]}) touched ${FORMS[f].name}: refused`); continue; }
      e.setProperty("wilds:form", f); e.triggerEvent(`wilds:form_${f}`);
      mimicStats.transforms++;
      try { e.dimension.spawnParticle("minecraft:villager_happy", { x: e.location.x, y: e.location.y + 0.6, z: e.location.z }); } catch { /* */ }
      dbg(`mimic (${TIERS[aff]}) became ${FORMS[f].name}`);
    }
  }
}), 20);

world.afterEvents.entityRemove.subscribe((e) => last.delete(e.removedEntityId), { entityTypes: [MIMIC] });

export function mimicInfo(player) {
  const e = player.dimension.getEntities({ type: MIMIC, location: player.location, maxDistance: 16, closest: 1 })[0];
  if (!e) return player.sendMessage("§eNo Pebble Mimic within 16 blocks.");
  const a = e.getProperty("wilds:affinity"), f = e.getProperty("wilds:form");
  player.sendMessage(`§bMimic: affinity ${TIERS[a]} (rolled: ${e.getProperty("wilds:rolled")}), form ${FORMS[f].name}, size ${e.getProperty("wilds:size") ? "large" : "small"}. ` +
    `Can become: ${FORMS.filter((x) => x.tier <= a).map((x) => x.name).join(", ")}`);
}

/** /scriptevent wilds:mimic_census : affinity counts of every loaded mimic, to compare with 75/20/4/0.9/0.1. */
export function mimicCensus(player) {
  const n = [0, 0, 0, 0, 0];
  for (const e of player.dimension.getEntities({ type: MIMIC })) n[e.getProperty("wilds:affinity")]++;
  const tot = n.reduce((a, b) => a + b, 0) || 1;
  player.sendMessage(`§bLoaded mimics: ${tot}. ` + TIERS.map((t, i) => `${t} ${n[i]} (${((n[i] / tot) * 100).toFixed(1)}%)`).join(", ") +
    `. Transforms ${mimicStats.transforms}, refused ${mimicStats.refused}.`);
}

/** /scriptevent wilds:mimic_spawn <count> : spawn a batch for the census (default 100, max 400). */
export function mimicSpawn(player, count) {
  const n = Math.max(1, Math.min(400, count || 100));
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, r = 3 + Math.random() * 8;
    system.runTimeout(() => { try { player.dimension.spawnEntity(MIMIC, { x: player.location.x + Math.cos(a) * r, y: player.location.y + 1, z: player.location.z + Math.sin(a) * r }); } catch { /* */ } }, Math.floor(i / 20));
  }
  player.sendMessage(`§bSpawning ${n} mimics. Wait a few seconds, then /scriptevent wilds:mimic_census`);
}
