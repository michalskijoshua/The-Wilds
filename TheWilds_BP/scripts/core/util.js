// The Wilds: shared helpers. Every world key, event id and tag starts with "wilds:" (Guilds+ uses guilds*: and ih_*).
import { world, system, EntityTypes } from "@minecraft/server";

export const NS = "wilds";
export const VERSION = "0.0.22-p0";

/** Errors are always reported, but the same one at most once a minute (with a count), so a broken entity can't flood
 *  the log (TW-53/54). */
const errSeen = new Map();
export function report(label, err) {
  const k = `${label}: ${err}`, now = Date.now(), r = errSeen.get(k);
  if (r && now - r.t < 60000) { r.n++; return; }
  console.warn(`[wilds] ${k}${r?.n ? ` (and ${r.n} more times)` : ""}`);
  errSeen.set(k, { t: now, n: 0 });
  if (errSeen.size > 200) errSeen.clear();
}
/** Wrap a callback so one error never kills a loop or an event subscription. */
export const guard = (label, fn) => (...a) => {
  try { return fn(...a); } catch (err) { report(label, err); }
};
/** TW-54: runs fn for each item on its own, so one bad (invalid, unloaded) entity never stops the others. */
export function each(label, list, fn) {
  for (const x of list) { try { fn(x); } catch (err) { report(label, err); } }
}

export const jget = (key, dflt) => {
  try { const v = world.getDynamicProperty(key); return v === undefined ? dflt : JSON.parse(v); } catch { return dflt; }
};
export const jset = (key, val) => world.setDynamicProperty(key, val === undefined ? undefined : JSON.stringify(val));

export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
export const dist2d = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

/** Runtime check: is Guilds+ loaded? Never imports or edits anything of theirs, only asks the engine. */
let guildsCache;
export function guildsPresent() {
  if (guildsCache === undefined) {
    try { guildsCache = !!EntityTypes.get("guilds:merc_archer"); } catch { return false; }   // too early: ask again later
  }
  return guildsCache;
}

/** Debug log (TW-53): off by default. "/scriptevent wilds:log on" (operators) writes it to the content log; players with
 *  the wilds:debug tag also see it in chat. Errors are not affected (see report). */
let logOn, logCheck = -1e9;
export const logging = () => { if (Date.now() - logCheck > 5000) { logCheck = Date.now(); try { logOn = !!world.getDynamicProperty("wilds:log"); } catch { /* */ } } return logOn; };
export function setLogging(on) { world.setDynamicProperty("wilds:log", on ? true : undefined); logCheck = -1e9; }
export function dbg(msg) {
  if (logging()) console.info(`[wilds] ${msg}`);
  for (const p of world.getAllPlayers()) if (p.hasTag("wilds:debug")) p.sendMessage(`§7[wilds] ${msg}`);
}

/** Plays one of The Wilds' sounds (TheWilds_RP/sounds/sound_definitions.json) at a spot; never throws. */
export function sfx(dim, id, at, volume = 1) { try { dim.playSound(id, at, { volume, pitch: 0.92 + Math.random() * 0.16 }); } catch { /* */ } }

/** world.getEntity that never throws (ids from records may be stale or not entity ids at all). */
export function entityById(id) { if (!id) return undefined; try { return world.getEntity(String(id)); } catch { return undefined; } }

export const OVERWORLD = () => world.getDimension("overworld");
export const now = () => Date.now();
export { world, system };
