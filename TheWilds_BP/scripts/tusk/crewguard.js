// Crew on a Tuskbeast: no friendly fire on players, and keep mounted guards from trying to patrol.
//
// Friendly fire: archers stand behind the driver, so a native shot at a mob ahead can pass through the driver. We
// cannot change the vanilla arrow or the player, so we stop the damage after the fact. If the game offers
// world.beforeEvents.entityHurt we cancel the hit outright. Otherwise the afterEvent gives the health straight back in
// the same tick, so the player sees a hurt flash but loses nothing. It only acts when the shooter is a crew member who
// is standing on a Tuskbeast. Guards on the ground keep normal Guilds+ behaviour.
//
// Stationary: a mounted guard cannot walk off anyway. The Guilds+ patrol loop still sends him "go to" orders every
// 2 s, so every 2 s we send Guilds+'s own public event guilds:stop to mounted crew. That only uses their event and
// edits nothing. The clean fix is a two-line Guilds+ change: see GUILDS_PATCH_PROPOSAL.md.
import { world, system, guard, dbg } from "../core/util.js";
import { allBeasts } from "./seats.js";

const BEAST = "wilds:tuskbeast";
const RANGED = new Set(["guilds:merc_archer", "guilds:merc_crossbowman"]);
const isCrewType = (e) => RANGED.has(e?.typeId) || (e?.isValid && e.matches({ families: ["wilds_archer"] }));
const mountedOn = (e) => { try { return e.getComponent("minecraft:riding")?.entityRidingOn; } catch { return undefined; } };
export const guardStats = { blocked: 0, refunded: 0, mode: "none" };

function crewShot(src) {
  const shooter = src?.damagingEntity;
  return !!shooter && shooter.isValid && isCrewType(shooter) && mountedOn(shooter)?.typeId === BEAST;
}

if (world.beforeEvents.entityHurt) {
  guardStats.mode = "cancel";
  world.beforeEvents.entityHurt.subscribe((e) => {
    try { if (e.hurtEntity?.typeId === "minecraft:player" && crewShot(e.damageSource)) { e.cancel = true; guardStats.blocked++; } } catch { /* */ }
  });
} else {
  guardStats.mode = "refund";
  world.afterEvents.entityHurt.subscribe(guard("ff", (e) => {
    if (!crewShot(e.damageSource)) return;
    const h = e.hurtEntity.getComponent("minecraft:health");
    if (!h || h.currentValue <= 0) return;                      // too late if the hit was lethal (an arrow almost never is)
    h.setCurrentValue(Math.min(h.effectiveMax, h.currentValue + e.damage));
    guardStats.refunded++;
    dbg(`crew arrow hit ${e.hurtEntity.name}; ${e.damage.toFixed(1)} health given back`);
  }), { entityTypes: ["minecraft:player"] });
}

system.runInterval(guard("crew.still", () => {
  for (const b of allBeasts()) {
    let riders; try { riders = b.getComponent("minecraft:rideable").getRiders(); } catch { continue; }
    for (const r of riders) if (RANGED.has(r.typeId)) { try { r.triggerEvent("guilds:stop"); } catch { /* */ } }
  }
}), 40);
