// Spawn eggs, one per look (0.0.16). Tap the ground with one: the creature appears in that look (Tuskbeast kind,
// Aetherseed form, Bloomling look, Pebble Mimic form; Mimics come out large). Used up as normal except in Creative.
// The engine's own single egg for these four is hidden (is_spawnable false); the Frost Lynx keeps its own egg.
import { world, system } from "@minecraft/server";
import { guard } from "./core/util.js";
import { EGGS } from "./eggs_data.js";
import { spawnSeed } from "./aether/life.js";
import { spawnBloomling } from "./bloomling.js";
import { FORMS as MIMIC_FORMS } from "./mimic/affinity.js";

const BY_ID = Object.fromEntries(EGGS.map((e) => [e.id, e]));
const creative = (p) => { try { return String(p.getGameMode()).toLowerCase() === "creative"; } catch { return false; } };
export const eggStats = { hatched: 0 };

/** Makes the creature of one egg at a spot. Returns it. */
export function hatch(id, dim, at) {
  const egg = BY_ID[id]; if (!egg) return undefined;
  let e;
  if (egg.creature === "tuskbeast") {
    e = dim.spawnEntity("wilds:tuskbeast", at);
    e.triggerEvent(`wilds:kind_${egg.look}`); e.setDynamicProperty("wilds:kind", egg.look);   // the chosen kind, not the biome's
  } else if (egg.creature === "aetherseed") e = spawnSeed(dim, { x: at.x, y: at.y + 1, z: at.z }, egg.look);
  else if (egg.creature === "bloomling") e = spawnBloomling(dim, at, egg.look, false);
  else if (egg.creature === "pebble_mimic") {
    const f = MIMIC_FORMS.findIndex((x) => x.name === egg.look);
    e = dim.spawnEntity("wilds:pebble_mimic", at);
    e.triggerEvent("wilds:size_large");
    e.setProperty("wilds:affinity", Math.max(e.getProperty("wilds:affinity"), MIMIC_FORMS[f].tier));   // allowed to be this form
    e.setProperty("wilds:form", f); e.triggerEvent(`wilds:form_${f}`);
    e.setDynamicProperty("wilds:changed", true);                       // it keeps the chosen form (counts as its one change)
  }
  eggStats.hatched++;
  return e;
}
world.beforeEvents.playerInteractWithBlock.subscribe((e) => {
  const id = e.itemStack?.typeId; if (!id?.startsWith("wilds:egg_") || !e.isFirstEvent) return;
  e.cancel = true;
  const p = e.player, b = e.block, f = e.blockFace;
  const off = { Up: [0, 1, 0], Down: [0, -1, 0], North: [0, 0, -1], South: [0, 0, 1], East: [1, 0, 0], West: [-1, 0, 0] }[f] ?? [0, 1, 0];
  const at = { x: b.location.x + off[0] + 0.5, y: b.location.y + off[1], z: b.location.z + off[2] + 0.5 };
  system.run(guard("egg", () => {
    hatch(id, p.dimension, at);
    if (creative(p)) return;
    const inv = p.getComponent("minecraft:inventory")?.container, slot = p.selectedSlotIndex, it = inv?.getItem(slot);
    if (it?.typeId === id) { if (it.amount > 1) { it.amount -= 1; inv.setItem(slot, it); } else inv.setItem(slot, undefined); }
  }));
});
