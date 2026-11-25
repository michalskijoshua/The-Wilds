// Shared breeding and growing up (0.0.20, TW-37/TW-39/TW-40, used by the Bloomling and the Pebble Mimic, ready for more).
// Breeding itself stays native (minecraft:breedable). Scripts can't read a baby's remaining growth or an animal's
// breeding cooldown in @minecraft/server 2.6.0, so this keeps its own clock in play time (core/clock.js):
//   - Feeding: a player feeding a breeding item to an adult records "fed at" on it. An adult that bred less than
//     REST ago is not in the mood (the feed is refused, nothing used up).
//   - Birth: the parents are the two adults fed within the last LOVE ticks closest to where the baby appeared (the
//     real pair), not just any nearby adults. Both start their rest. The baby's birth time is recorded.
//   - Growing up: a baby grows up GROW ticks after birth (the entity file's own timer is longer, a safety net).
//   - Cage: snapshot() and restore() keep name, baby or adult, growth left and rest left, so time in a cage is paused.
import { world, system } from "@minecraft/server";
import { guard, dbg } from "./util.js";

import { playTicks } from "./clock.js";
const now = () => playTicks();                         // our own play clock (getAbsoluteTime stops with the daylight cycle off)
export const LIFE = new Map();            // typeId -> { breedItems:Set, grow: ticks, rest: ticks, growEvent, onBirth?(baby, parents) }
export const LOVE = 700;                  // a little over vanilla's 30 s in love
export function registerLife(typeId, cfg) { LIFE.set(typeId, { rest: 6000, grow: 24000, growEvent: "wilds:grow_up", ...cfg, breedItems: new Set(cfg.breedItems) }); }
export const isBaby = (e) => { try { return !!e.getComponent("minecraft:is_baby"); } catch { return false; } };
export const lifeStats = { fed: 0, refused: 0, births: 0, grown: 0 };

world.beforeEvents.playerInteractWithEntity.subscribe((e) => {
  const t = e.target, cfg = LIFE.get(t?.typeId); if (!cfg || !cfg.breedItems.has(e.itemStack?.typeId)) return;
  if (isBaby(t)) {                                         // feeding a baby speeds it up by a tenth, as in vanilla
    system.run(() => { const at = t.isValid ? t.getDynamicProperty("wilds:born_at") : undefined; if (at !== undefined) t.setDynamicProperty("wilds:born_at", at - cfg.grow / 10); });
    return;
  }
  const bred = t.getDynamicProperty("wilds:bred_at");
  if (bred !== undefined && now() - bred < cfg.rest) {
    e.cancel = true; lifeStats.refused++;
    const p = e.player; system.run(() => { try { p.sendMessage("§7It needs a rest before it can have another baby."); } catch { /* */ } });
    return;
  }
  system.run(() => { if (t.isValid) { t.setDynamicProperty("wilds:fed_at", now()); lifeStats.fed++; } });
});

/** The real parents of a newborn: adults of its kind fed within LOVE ticks, closest first (at most 2). */
export function parentsOf(baby) {
  const t = now();
  return baby.dimension.getEntities({ type: baby.typeId, location: baby.location, maxDistance: 6 })
    .filter((x) => x.id !== baby.id && !isBaby(x) && t - (x.getDynamicProperty("wilds:fed_at") ?? -1e9) <= LOVE)
    .sort((a, b) => Math.hypot(a.location.x - baby.location.x, a.location.z - baby.location.z) - Math.hypot(b.location.x - baby.location.x, b.location.z - baby.location.z))
    .slice(0, 2);
}
/** Call when a baby appears from breeding. Returns its parents (maybe fewer than 2 if they can't be found). */
export function born(baby) {
  const cfg = LIFE.get(baby.typeId), parents = parentsOf(baby), t = now();
  for (const p of parents) { p.setDynamicProperty("wilds:bred_at", t); p.setDynamicProperty("wilds:fed_at", undefined); }
  baby.setDynamicProperty("wilds:born_at", t);
  lifeStats.births++;
  cfg?.onBirth?.(baby, parents);
  return parents;
}
system.runInterval(guard("growing", () => {
  const t = now();
  for (const [type, cfg] of LIFE) for (const d of ["overworld", "nether", "the_end"]) {
    let list; try { list = world.getDimension(d).getEntities({ type }); } catch { continue; }
    for (const b of list) {
      try {
        const at = b.getDynamicProperty("wilds:born_at"); if (at === undefined || !isBaby(b)) continue;
        if (t - at >= cfg.grow) { b.triggerEvent(cfg.growEvent); b.setDynamicProperty("wilds:born_at", undefined); lifeStats.grown++; }
      } catch (err) { dbg(`growing ${type}: ${err}`); }                       // TW-54: one bad entity never stops the rest
    }
  }
}), 100);

/** What a cage must remember about a creature (TW-39/TW-40). */
export function snapshot(e) {
  const cfg = LIFE.get(e.typeId), t = now(), s = { name: e.nameTag || undefined };
  if (!cfg) return s;
  s.baby = isBaby(e);
  const at = e.getDynamicProperty("wilds:born_at");
  if (s.baby) s.growLeft = Math.max(1, cfg.grow - (at === undefined ? 0 : t - at));
  const bred = e.getDynamicProperty("wilds:bred_at");
  if (bred !== undefined && t - bred < cfg.rest) s.restLeft = cfg.rest - (t - bred);
  return s;
}
/** Puts a snapshot back on a released creature: time in the cage did not count. */
export function restore(e, s) {
  if (!s) return;
  if (s.name) e.nameTag = s.name;
  const cfg = LIFE.get(e.typeId); if (!cfg) return;
  const t = now();
  if (s.baby) e.setDynamicProperty("wilds:born_at", t - (cfg.grow - s.growLeft));
  if (s.restLeft) e.setDynamicProperty("wilds:bred_at", t - (cfg.rest - s.restLeft));
}
