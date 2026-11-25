// Safe item exchanges (TW-03, 0.0.19). Interactions are answered a tick later (system.run), and by then the player may
// have switched slots, used the item, walked away or logged out, or another player may be using the same creature.
// Every exchange re-checks everything when it actually happens, takes the payment before giving anything, and puts it
// back if the rest fails. One exchange per creature at a time.
const busy = new Map();                                    // entity id -> tick the lock was taken
import { system } from "@minecraft/server";

export const creative = (p) => { try { return String(p.getGameMode()).toLowerCase() === "creative"; } catch { return false; } };
export const near = (p, e, max = 6) => {
  try { return p.isValid && e.isValid && p.dimension.id === e.dimension.id && Math.hypot(p.location.x - e.location.x, p.location.y - e.location.y, p.location.z - e.location.z) <= max; } catch { return false; }
};
/** Lock a creature for one exchange. Returns false if another one is running (a stale lock older than 2 s is ignored). */
export function lock(e) {
  const t = busy.get(e.id); if (t !== undefined && system.currentTick - t < 40) return false;
  busy.set(e.id, system.currentTick); return true;
}
export const unlock = (e) => busy.delete(e.id);

/** The item in the slot the player used, if it is still there and still the same kind. */
export function heldAt(p, slot, typeId) {
  try {
    if (!p.isValid || p.selectedSlotIndex !== slot) return undefined;
    const inv = p.getComponent("minecraft:inventory")?.container, it = inv?.getItem(slot);
    return it?.typeId === typeId ? { inv, it } : undefined;
  } catch { return undefined; }
}
/** Takes n of typeId from that slot (not in Creative). Returns a function that puts them back, or undefined if it can't pay. */
export function pay(p, slot, typeId, n = 1) {
  if (creative(p)) return heldAt(p, slot, typeId) ? () => {} : undefined;
  const h = heldAt(p, slot, typeId); if (!h || h.it.amount < n) return undefined;
  const before = h.it.clone();
  if (h.it.amount > n) { h.it.amount -= n; h.inv.setItem(slot, h.it); } else h.inv.setItem(slot, undefined);
  return () => { try { const now = h.inv.getItem(slot); if (!now) h.inv.setItem(slot, before); else { const left = h.inv.addItem(before); if (left) p.dimension.spawnItem(left, p.location); } } catch { /* */ } };
}
/** Gives an item: into the given slot if it is empty, else anywhere in the inventory, else at the player's feet. */
export function give(p, item, slot) {
  const inv = p.getComponent("minecraft:inventory")?.container;
  if (inv && slot !== undefined && !inv.getItem(slot)) { inv.setItem(slot, item); return; }
  const left = inv?.addItem(item); if (left || !inv) p.dimension.spawnItem(left ?? item, p.location);
}

system.runInterval(() => { const old = system.currentTick - 200; for (const [k, t] of busy) if (t < old) busy.delete(k); }, 1200);   // TW-50: stale locks
