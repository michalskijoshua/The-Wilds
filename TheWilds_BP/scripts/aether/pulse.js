// P0-6 Aetherseed pulses (proposal numbers).
// Every ~45 s each loaded Aetherseed pulses once: radius 5, at most 3 random eligible targets, ground plants only.
// Original: crops grow one stage. Bloom: saplings ripen (age_bit), flowers spread one copy to a free grass spot.
// Withered (no warning, by decision): crops lose a stage, flowers and saplings become dead bushes.
// Potted plants: a flower pot keeps its plant inside the pot block, so a potted plant is never a plant block in the
// world; on top of that, every target must stand on soil (farmland for crops, dirt-family for the rest).
// No duplicate pulses: one loop, the due time is stored on the seed itself (wilds:next_pulse), and a block is touched
// by at most one seed per loop.
import { world, system, guard, dbg, sfx } from "../core/util.js";

const SEED = "wilds:aetherseed";
export const PULSE = { everyMs: 45000, radius: 5, maxTargets: 3, below: 3, above: 3 };   // below 3: it hovers 1-2 blocks up
const FORM = ["original", "bloom", "withered"];
const CROPS = new Set(["wheat", "carrots", "potatoes", "beetroot", "melon_stem", "pumpkin_stem"].map((b) => `minecraft:${b}`));
const FLOWERS = new Set(["dandelion", "poppy", "blue_orchid", "allium", "azure_bluet", "red_tulip", "orange_tulip", "white_tulip", "pink_tulip",
  "oxeye_daisy", "cornflower", "lily_of_the_valley"].map((b) => `minecraft:${b}`));
const SAPLINGS = new Set(["oak_sapling", "spruce_sapling", "birch_sapling", "jungle_sapling", "acacia_sapling", "dark_oak_sapling", "cherry_sapling"].map((b) => `minecraft:${b}`));
const SOIL = new Set(["grass_block", "dirt", "coarse_dirt", "podzol", "rooted_dirt", "moss_block", "mud", "muddy_mangrove_roots", "dirt_with_roots"].map((b) => `minecraft:${b}`));
export const pulseStats = { pulses: 0, changes: 0, skippedNoTarget: 0 };

function eligible(form, b, under) {
  const id = b.typeId;
  if (CROPS.has(id)) {
    if (under?.typeId !== "minecraft:farmland") return false;
    const g = b.permutation.getState("growth"); if (g === undefined) return false;
    return form === 2 ? g > 0 : form === 0 ? g < 7 : false;
  }
  if (!SOIL.has(under?.typeId)) return false;
  if (FLOWERS.has(id)) return form === 1 || form === 2;
  if (SAPLINGS.has(id)) return form === 2 || (form === 1 && b.permutation.getState("age_bit") === false);
  return false;
}

function apply(form, b, dim) {
  const id = b.typeId, at = { x: b.location.x + 0.5, y: b.location.y + 0.5, z: b.location.z + 0.5 };
  if (CROPS.has(id)) {
    const g = b.permutation.getState("growth");
    b.setPermutation(b.permutation.withState("growth", form === 2 ? g - 1 : g + 1));
  } else if (form === 2) {
    b.setType("minecraft:deadbush");
  } else if (SAPLINGS.has(id)) {
    b.setPermutation(b.permutation.withState("age_bit", true));
  } else if (FLOWERS.has(id)) {                                                // Bloom: one copy on a free grass spot next to it
    const spots = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]].sort(() => Math.random() - 0.5);
    let done = false;
    for (const [dx, dz] of spots) {
      const t = dim.getBlock({ x: b.location.x + dx, y: b.location.y, z: b.location.z + dz });
      const u = dim.getBlock({ x: b.location.x + dx, y: b.location.y - 1, z: b.location.z + dz });
      if (t?.isAir && u?.typeId === "minecraft:grass_block") { t.setType(id); done = true; break; }
    }
    if (!done) return false;
  }
  try { dim.spawnParticle(form === 2 ? "minecraft:basic_smoke_particle" : "minecraft:crop_growth_emitter", at); } catch { /* */ }
  return true;
}

function pulse(seed, touched) {
  const form = seed.getProperty("wilds:form"), dim = seed.dimension;
  const cx = Math.floor(seed.location.x), cy = Math.floor(seed.location.y), cz = Math.floor(seed.location.z);
  const found = [];
  for (let x = cx - PULSE.radius; x <= cx + PULSE.radius; x++)
    for (let z = cz - PULSE.radius; z <= cz + PULSE.radius; z++) {
      if ((x - cx) ** 2 + (z - cz) ** 2 > PULSE.radius ** 2) continue;
      for (let y = cy - PULSE.below; y <= cy + PULSE.above; y++) {
        const k = `${x},${y},${z}`; if (touched.has(k)) continue;
        let b, u; try { b = dim.getBlock({ x, y, z }); if (!b || b.isAir) continue; u = dim.getBlock({ x, y: y - 1, z }); } catch { continue; }
        if (eligible(form, b, u)) found.push(b);
      }
    }
  pulseStats.pulses++;
  if (!found.length) { pulseStats.skippedNoTarget++; return 0; }
  let n = 0;
  for (const b of found.sort(() => Math.random() - 0.5)) {
    if (n >= PULSE.maxTargets) break;
    touched.add(`${b.location.x},${b.location.y},${b.location.z}`);
    try { if (apply(form, b, dim)) n++; } catch (err) { console.warn(`[wilds] pulse apply: ${err}`); }
  }
  pulseStats.changes += n;
  sfx(dim, `wilds.aetherseed.${FORM[form]}_pulse`, seed.location);
  dbg(`${FORM[form]} Aetherseed pulsed: ${n} plant${n === 1 ? "" : "s"}`);
  return n;
}

system.runInterval(guard("aether", () => {
  const t = Date.now(), touched = new Set();
  for (const d of ["overworld", "nether", "the_end"]) {
    let list; try { list = world.getDimension(d).getEntities({ type: SEED }); } catch { continue; }
    for (const s of list) {
      if (!s.isValid) continue;
      const due = s.getDynamicProperty("wilds:next_pulse");
      if (due === undefined) { s.setDynamicProperty("wilds:next_pulse", t + PULSE.everyMs * (0.5 + Math.random() * 0.5)); continue; }   // stagger new seeds
      if (t < due) continue;
      s.setDynamicProperty("wilds:next_pulse", t + PULSE.everyMs);                // set before acting: one pulse per due time
      pulse(s, touched);
    }
  }
}), 20);

export function seedForm(player, name) {
  const s = player.dimension.getEntities({ type: SEED, location: player.location, maxDistance: 16, closest: 1 })[0];
  if (!s) return player.sendMessage("§eNo Aetherseed within 16 blocks.");
  const i = FORM.indexOf(name);
  if (i < 0) return player.sendMessage(`§bThis Aetherseed is ${FORM[s.getProperty("wilds:form")]}. Use original, bloom or withered to change it.`);
  s.triggerEvent(`wilds:form_${name}`);
  s.setDynamicProperty("wilds:next_pulse", Date.now() + 3000);
  player.sendMessage(`§bAetherseed is now ${name}; it pulses in 3 s.`);
}
