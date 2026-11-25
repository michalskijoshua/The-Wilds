// What Guilds+ supports, feature by feature (TW-55/TW-56, 0.0.22). Finding one Guilds+ id no longer means "everything
// works": each feature is checked on its own, and missing ones are simply switched off. Nothing is renamed.
//   mercenaries   the guard entities exist (guilds:merc_archer, guilds:merc_crossbowman)
//   ownership     guards carry ih_merc:<owner id> (Guilds+ 0.9.18 source: yes, with the guards)
//   stop          guards accept the guilds:stop event (Guilds+ 0.9.18 entity files: yes)
//   crops         Guilds+ crop blocks exist (guilds_farming:crop_corn ...)
//   membership    a guild-member tag exists: NOT in Guilds+ 0.9.18 (checked); only on Guilds+'s own say-so (hello)
//   alliances, wounded, companions.table: only on Guilds+'s own say-so
// Guilds+ can announce what it supports with /scriptevent wilds:guilds_hello {"version":"...","caps":["membership.v1",...]}
// (GUILDS_PATCH_PROPOSAL.md part 5).
import { world, system, EntityTypes, BlockTypes } from "@minecraft/server";
import { guard, report } from "./util.js";

const has = (fn) => { try { return !!fn(); } catch { return false; } };
const declared = new Set();
let guildsVersion;
export function caps() {
  const merc = has(() => EntityTypes.get("guilds:merc_archer")) && has(() => EntityTypes.get("guilds:merc_crossbowman"));
  return {
    mercenaries: merc, ownership: merc, stop: merc,
    crops: has(() => BlockTypes.get("guilds_farming:crop_corn")),
    membership: declared.has("membership.v1"), alliances: declared.has("alliances.v1"),
    wounded: declared.has("wounded.v1"), companionsTable: declared.has("companions.table.v1"),
    guildsVersion,
  };
}
export const hasCap = (name) => !!caps()[name];
system.afterEvents.scriptEventReceive.subscribe(guard("guilds.hello", (e) => {
  if (e.id !== "wilds:guilds_hello") return;
  try { const m = JSON.parse(e.message || "{}"); guildsVersion = m.version; for (const c of m.caps ?? []) declared.add(String(c)); } catch (err) { report("guilds hello", err); }
}), { namespaces: ["wilds"] });

