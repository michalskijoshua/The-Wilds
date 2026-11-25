// The Wilds' own play clock (0.0.20). world.getAbsoluteTime() stops when the daylight cycle is off and jumps with
// /time set (seen on the server), so it can't time growing up, resting or wilting. This counts game ticks while the
// world is running, saved in the world (wilds:clock) every 5 s; after a load it carries on from the saved value.
import { world, system } from "@minecraft/server";
const KEY = "wilds:clock";
let base, start;
function init() { if (base === undefined) { base = Number(world.getDynamicProperty(KEY) ?? 0); start = system.currentTick; } }
/** Play time in ticks since The Wilds first ran in this world. */
export function playTicks() { init(); return base + (system.currentTick - start); }
system.runInterval(() => { try { world.setDynamicProperty(KEY, playTicks()); } catch { /* not ready yet */ } }, 100);
