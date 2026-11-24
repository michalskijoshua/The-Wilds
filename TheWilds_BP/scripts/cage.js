// Cages (0.0.13, Batch B, Director 24 Nov 2026).
// Tap a cageable creature with an empty Cage: it goes inside, and the cage becomes a full cage of that creature's look
// (its own item and icon), remembering the creature's health and when it was caught (world play time).
// Tap the ground with a full cage: the creature comes out with the same look and health, and you get the empty cage back.
// Wilting: an Original or Bloom Aetherseed kept in a cage for more than 30 minutes of play time comes out Withered.
// Nothing ticks while it is carried: the times are only compared on release.
// Cageable: Aetherseed (Bloomling joins in Batch D). Not cageable: Frost Lynx, Tuskbeast, Pebble Mimic, the giants.
// Why a cage and not a lead: a floating mob may not take a lead in Bedrock; the cage does not depend on that.
import { world, system, ItemStack } from "@minecraft/server";
import { guard, dbg } from "./core/util.js";
import { squareTaken } from "./core/spawner.js";
import { spawnSeed, dismissZombies } from "./aether/life.js";

export const EMPTY = "wilds:cage";
export const WILT_TICKS = 30 * 60 * 20;                    // 30 minutes of play time
const SEED_FORMS = ["original", "bloom", "withered"];
export const CAGEABLE = {
  "wilds:aetherseed": {
    kind: "aetherseed", looks: SEED_FORMS,
    lookOf: (e) => SEED_FORMS[e.getProperty("wilds:form")] ?? "original",
    before: (e) => dismissZombies(e),
    wilt: (look, kept) => (look !== "withered" && kept > WILT_TICKS ? "withered" : look),
    release: (dim, at, look) => spawnSeed(dim, { x: at.x, y: at.y + 1, z: at.z }, look),
  },
};
const byKind = Object.fromEntries(Object.values(CAGEABLE).map((d) => [d.kind, d]));
export const fullCageId = (kind, look) => `wilds:cage_${kind}_${look}`;
const parseFull = (id) => { for (const d of Object.values(CAGEABLE)) for (const l of d.looks) if (id === fullCageId(d.kind, l)) return { def: d, look: l }; return undefined; };
export const cageStats = { caught: 0, released: 0, wilted: 0 };

/** Puts the creature in a cage. Returns the full cage item (the creature is gone). */
export function capture(e) {
  const def = CAGEABLE[e.typeId]; if (!def) return undefined;
  const look = def.lookOf(e), h = e.getComponent("minecraft:health");
  const hp = Math.max(1, Math.round(h?.currentValue ?? 1)), max = Math.round(h?.effectiveMax ?? hp);
  const item = new ItemStack(fullCageId(def.kind, look), 1);
  item.setDynamicProperty("wilds:hp", hp);
  item.setDynamicProperty("wilds:caught", world.getAbsoluteTime());
  item.setLore([`§7Health ${hp}/${max}`]);
  def.before?.(e);
  squareTaken(e);                                          // its home square may get a new one later
  try { e.dimension.spawnParticle("minecraft:basic_smoke_particle", e.location); } catch { /* */ }
  e.remove();
  cageStats.caught++;
  return item;
}

/** Lets the creature out at a spot. Returns the creature. */
export function release(item, dim, at) {
  const p = parseFull(item.typeId); if (!p) return undefined;
  const caught = item.getDynamicProperty("wilds:caught"), kept = caught === undefined ? 0 : world.getAbsoluteTime() - caught;
  const look = p.def.wilt ? p.def.wilt(p.look, kept) : p.look;
  if (look !== p.look) cageStats.wilted++;
  const e = p.def.release(dim, at, look);
  const hp = item.getDynamicProperty("wilds:hp"), h = e.getComponent("minecraft:health");
  if (hp !== undefined && h) h.setCurrentValue(Math.min(h.effectiveMax, hp));
  cageStats.released++;
  return e;
}

function swapHeld(player, item) {                          // the one held cage becomes `item`
  const inv = player.getComponent("minecraft:inventory")?.container, slot = player.selectedSlotIndex, held = inv?.getItem(slot);
  if (!inv) return;
  if (held && held.amount > 1) {
    held.amount -= 1; inv.setItem(slot, held);
    const left = inv.addItem(item); if (left) player.dimension.spawnItem(left, player.location);
  } else inv.setItem(slot, item);
}

world.beforeEvents.playerInteractWithEntity.subscribe((e) => {
  if (e.itemStack?.typeId !== EMPTY) return;
  const t = e.target, p = e.player;
  if (t?.typeId === "minecraft:player") return;
  e.cancel = true;
  system.run(guard("cage.catch", () => {
    if (!t.isValid) return;
    if (!CAGEABLE[t.typeId]) return p.sendMessage("§eThat creature won't fit in a cage.");
    const item = capture(t);
    if (item) { swapHeld(p, item); dbg(`${p.name} caged a ${item.typeId}`); }
  }));
});

world.beforeEvents.playerInteractWithBlock.subscribe((e) => {
  const id = e.itemStack?.typeId; if (!id?.startsWith("wilds:cage_") || !e.isFirstEvent) return;
  e.cancel = true;
  const p = e.player, b = e.block, f = e.blockFace;
  const off = { Up: [0, 1, 0], Down: [0, -1, 0], North: [0, 0, -1], South: [0, 0, 1], East: [1, 0, 0], West: [-1, 0, 0] }[f] ?? [0, 1, 0];
  const at = { x: b.location.x + off[0] + 0.5, y: b.location.y + off[1], z: b.location.z + off[2] + 0.5 };
  system.run(guard("cage.release", () => {
    const inv = p.getComponent("minecraft:inventory")?.container, slot = p.selectedSlotIndex, held = inv?.getItem(slot);
    if (held?.typeId !== id) return;
    const c = release(held, p.dimension, at);
    if (c) inv.setItem(slot, new ItemStack(EMPTY, 1));
  }));
});
