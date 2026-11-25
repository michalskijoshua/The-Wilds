// The Wilds: shared helpers. Every world key, event id and tag starts with "wilds:" (Guilds+ uses guilds*: and ih_*).
import { world, system, EntityTypes } from "@minecraft/server";

export const NS = "wilds";
export const VERSION = "0.0.20-p0";

/** Wrap a callback so one error never kills a loop or an event subscription. */
export const guard = (label, fn) => (...a) => {
  try { return fn(...a); } catch (err) { console.warn(`[wilds] ${label}: ${err}`); }
};

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

/** Debug log for testers: chat for players with the wilds:debug tag, always the content log. */
export function dbg(msg) {
  console.info(`[wilds] ${msg}`);
  for (const p of world.getAllPlayers()) if (p.hasTag("wilds:debug")) p.sendMessage(`§7[wilds] ${msg}`);
}

/** Plays one of The Wilds' sounds (TheWilds_RP/sounds/sound_definitions.json) at a spot; never throws. */
export function sfx(dim, id, at, volume = 1) { try { dim.playSound(id, at, { volume, pitch: 0.92 + Math.random() * 0.16 }); } catch { /* */ } }

export const OVERWORLD = () => world.getDimension("overworld");
export const now = () => Date.now();
export { world, system };
