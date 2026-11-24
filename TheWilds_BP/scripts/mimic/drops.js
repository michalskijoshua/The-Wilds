// Pebble Mimic drops (0.0.17, Director 24 Nov 2026): killed by a player swinging a pickaxe (any pickaxe), a Mimic
// drops what it looks like. Killed any other way (sword, fist, arrows, lava...): nothing.
// Large: the full amount. Small: half (rounded up). The ore Mimics drop 1 ore whatever their size.
import { world, ItemStack } from "@minecraft/server";
import { guard, dbg } from "../core/util.js";
import { FORMS } from "./affinity.js";

export const DROPS = {                                     // form name -> [item, amount for a large Mimic]
  stone: ["minecraft:cobblestone", 15], mossy: ["minecraft:mossy_cobblestone", 15], sand: ["minecraft:sand", 15],
  clay: ["minecraft:clay_ball", 15], coal: ["minecraft:coal", 15],
  copper: ["minecraft:copper_ore", 1], iron: ["minecraft:iron_ore", 1], gold: ["minecraft:gold_ore", 1],
  diamond: ["minecraft:diamond_ore", 1], netherite: ["minecraft:ancient_debris", 1],
};
export const isPickaxe = (id) => /_pickaxe$/.test(id ?? "");
/** What a Mimic of this form and size drops when the killer held `held`. [] = nothing. */
export function dropsFor(form, large, held) {
  if (!isPickaxe(held)) return [];
  const [item, n] = DROPS[FORMS[form]?.name] ?? [];
  if (!item) return [];
  return [[item, n === 1 || large ? n : Math.ceil(n / 2)]];
}
export const dropStats = { kills: 0, dropped: 0 };

world.afterEvents.entityDie.subscribe(guard("mimic.drops", (e) => {
  const m = e.deadEntity, src = e.damageSource, killer = src?.damagingEntity;
  if (killer?.typeId !== "minecraft:player" || src.cause !== "entityAttack") return;
  let held; try { held = killer.getComponent("minecraft:equippable")?.getEquipment("Mainhand")?.typeId; } catch { /* */ }
  let form, large, at, dim;
  try { form = m.getProperty("wilds:form"); large = m.getProperty("wilds:size") === 1; at = m.location; dim = m.dimension; } catch { return; }
  dropStats.kills++;
  for (const [item, n] of dropsFor(form, large, held)) { dim.spawnItem(new ItemStack(item, n), at); dropStats.dropped += n; }
  dbg(`a ${FORMS[form]?.name} Mimic was killed with ${held ?? "a bare hand"}`);
}), { entityTypes: ["wilds:pebble_mimic"] });
