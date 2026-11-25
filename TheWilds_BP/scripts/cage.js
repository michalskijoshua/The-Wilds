// Cages (0.0.13, Batch B, Director 24 Nov 2026).
// Tap a cageable creature with an empty Cage: it goes inside, and the cage becomes a full cage of that creature's look
// (its own item and icon), remembering the creature's health and when it was caught (world play time).
// Tap the ground with a full cage: the creature comes out with the same look and health, and you get the empty cage back.
// Wilting: an Original or Bloom Aetherseed kept in a cage for more than 30 minutes of play time comes out Withered.
// Nothing ticks while it is carried: the times are only compared on release.
// Cageable: Aetherseed, Bloomling (0.0.15; a caged baby comes out grown). Not cageable: Frost Lynx, Tuskbeast, Pebble Mimic, the giants.
// Why a cage and not a lead: a floating mob may not take a lead in Bedrock; the cage does not depend on that.
import { world, system, ItemStack } from "@minecraft/server";
import { guard, dbg } from "./core/util.js";
import { near, lock, unlock, pay, give, heldAt } from "./core/txn.js";
import { squareTaken } from "./core/spawner.js";
import { spawnSeed, dismissZombies } from "./aether/life.js";
import { spawnBloomling, LOOKS as BLOOM_LOOKS } from "./bloomling.js";

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
  "wilds:bloomling": {
    kind: "bloomling", looks: BLOOM_LOOKS,
    lookOf: (e) => BLOOM_LOOKS[e.getComponent("minecraft:mark_variant")?.value ?? 0] ?? "original",
    release: (dim, at, look) => spawnBloomling(dim, at, look, false),
  },
};
const byKind = Object.fromEntries(Object.values(CAGEABLE).map((d) => [d.kind, d]));
export const fullCageId = (kind, look) => `wilds:cage_${kind}_${look}`;
const parseFull = (id) => { for (const d of Object.values(CAGEABLE)) for (const l of d.looks) if (id === fullCageId(d.kind, l)) return { def: d, look: l }; return undefined; };
export const cageStats = { caught: 0, released: 0, wilted: 0 };

/** Puts the creature in a cage. Returns the full cage item (the creature is gone). */
/** The full cage for this creature, without touching the creature. */
export function cageItem(e) {
  const def = CAGEABLE[e.typeId]; if (!def) return undefined;
  const look = def.lookOf(e), h = e.getComponent("minecraft:health");
  const hp = Math.max(1, Math.round(h?.currentValue ?? 1)), max = Math.round(h?.effectiveMax ?? hp);
  const item = new ItemStack(fullCageId(def.kind, look), 1);
  item.setDynamicProperty("wilds:hp", hp);
  item.setDynamicProperty("wilds:caught", world.getAbsoluteTime());
  item.setLore([`§7Health ${hp}/${max}`]);
  return item;
}
/** The creature leaves the world (after its cage item exists). */
function takeIn(e) {
  CAGEABLE[e.typeId].before?.(e);
  squareTaken(e);                                          // its home square may get a new one later
  try { e.dimension.spawnParticle("minecraft:basic_smoke_particle", e.location); } catch { /* */ }
  e.remove();
  cageStats.caught++;
}
/** Puts the creature in a cage. Returns the full cage item (the creature is gone). Used by tests. */
export function capture(e) { const item = cageItem(e); if (item) takeIn(e); return item; }

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

// Catching: the empty cage is taken first, then the full cage is made and given, then the creature leaves.
// If the creature is gone by then (another player caught it, it died), the empty cage goes back.
world.beforeEvents.playerInteractWithEntity.subscribe((e) => {
  if (e.itemStack?.typeId !== EMPTY) return;
  const t = e.target, p = e.player, slot = p.selectedSlotIndex;
  if (t?.typeId === "minecraft:player") return;
  e.cancel = true;
  system.run(guard("cage.catch", () => catchWith(p, slot, t)));
});
/** One catch, re-checked now (TW-03). Returns what happened. */
export function catchWith(p, slot, t) {
  if (!t.isValid || !p.isValid) return "gone";
  if (!CAGEABLE[t.typeId]) { p.sendMessage("§eThat creature won't fit in a cage."); return "won't fit"; }
  if (!near(p, t, 6)) return "too far";
  if (!lock(t)) return "busy";
  try {
    const refund = pay(p, slot, EMPTY, 1); if (!refund) return "no empty cage in that slot";
    const item = cageItem(t);
    if (!item || !t.isValid) { refund(); return "creature gone, cage given back"; }
    give(p, item, slot);
    takeIn(t);
    dbg(`${p.name} caged a ${item.typeId}`);
    return "caught";
  } finally { unlock(t); }
}

// Releasing: the full cage in the slot that was used must still be the same cage (same catch time); the creature
// comes out first, and only then does the full cage turn into an empty one.
world.beforeEvents.playerInteractWithBlock.subscribe((e) => {
  const id = e.itemStack?.typeId; if (!id?.startsWith("wilds:cage_") || !e.isFirstEvent) return;
  e.cancel = true;
  const p = e.player, b = e.block, f = e.blockFace, slot = p.selectedSlotIndex;
  const caught = e.itemStack.getDynamicProperty("wilds:caught");
  const off = { Up: [0, 1, 0], Down: [0, -1, 0], North: [0, 0, -1], South: [0, 0, 1], East: [1, 0, 0], West: [-1, 0, 0] }[f] ?? [0, 1, 0];
  const at = { x: b.location.x + off[0] + 0.5, y: b.location.y + off[1], z: b.location.z + off[2] + 0.5 };
  system.run(guard("cage.release", () => releaseWith(p, slot, id, caught, at)));
});
/** One release, re-checked now (TW-03): same slot, same cage (same catch time), close enough. */
export function releaseWith(p, slot, id, caught, at) {
  const h = heldAt(p, slot, id); if (!h || h.it.getDynamicProperty("wilds:caught") !== caught) return "that cage is not in that slot any more";
  if (Math.hypot(p.location.x - at.x, p.location.y - at.y, p.location.z - at.z) > 8) return "too far";
  const c = release(h.it, p.dimension, at);
  if (!c) return "could not let it out";
  const again = heldAt(p, slot, id);
  if (again) { again.inv.setItem(slot, new ItemStack(EMPTY, 1)); return "released"; }
  try { c.remove(); } catch { /* */ }                                            // the cage left the slot meanwhile: undo
  return "undone";
}
