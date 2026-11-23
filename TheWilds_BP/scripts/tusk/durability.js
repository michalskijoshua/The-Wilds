// P0-3 Durability without invulnerability (proposal numbers, all in one place).
// Entity file: 300 health (iron golem 100 x3), knockback_resistance 1.0, damage_multiplier 0.4 on all damage,
// no fall or suffocation damage, no damage from its own riders or from Guilds+ mercenaries.
// Here: slow out-of-combat healing and the Wounded state.
import { world, system, guard, dbg } from "../core/util.js";
import { allBeasts } from "./seats.js";

export const TUNING = {
  healDelayMs: 20000,        // no damage for 20 s before healing starts
  healPerTick: 1,            // +1 health every 2 s = a full heal from zero in 10 minutes
  woundedAt: 0.25,           // at or below 25 % health: Wounded (slow, idle)
  recoverAt: 0.4,            // back to normal at 40 % (gap stops flicker)
};
const LAST_HURT = "wilds:last_hurt";

function health(b) { return b.getComponent("minecraft:health"); }
function checkWounded(b) {
  const h = health(b); if (!h) return;
  const frac = h.currentValue / h.effectiveMax, w = b.getProperty("wilds:wounded");
  if (!w && frac > 0 && frac <= TUNING.woundedAt) { b.triggerEvent("wilds:become_wounded"); dbg(`Tuskbeast is Wounded (${Math.round(h.currentValue)}/${h.effectiveMax})`); }
  else if (w && frac >= TUNING.recoverAt) { b.triggerEvent("wilds:recover"); dbg("Tuskbeast recovered from Wounded"); }
}

world.afterEvents.entityHurt.subscribe(guard("tusk.hurt", (e) => {
  const b = e.hurtEntity; if (!b?.isValid) return;
  b.setDynamicProperty(LAST_HURT, Date.now());
  checkWounded(b);
  if (b.getDynamicProperty("wilds:log_hits")) dbg(`hit by ${e.damageSource.damagingEntity?.typeId ?? e.damageSource.cause}: -${e.damage.toFixed(1)} → ${health(b).currentValue.toFixed(1)}`);
}), { entityTypes: ["wilds:tuskbeast"] });

system.runInterval(guard("tusk.heal", () => {
  const t = Date.now();
  for (const b of allBeasts()) {
    const h = health(b); if (!h || h.currentValue <= 0 || h.currentValue >= h.effectiveMax) continue;
    if (t - (b.getDynamicProperty(LAST_HURT) ?? 0) < TUNING.healDelayMs) continue;
    h.setCurrentValue(Math.min(h.effectiveMax, h.currentValue + TUNING.healPerTick));
    checkWounded(b);
  }
}), 40);

/**
 * /scriptevent wilds:durability_test : a simulated beating of the nearest Tuskbeast.
 * Vanilla hostiles do not target a neutral mob on their own, so the test makes four zombies "hit" it once a second
 * each (3 damage per hit, as a Normal-difficulty zombie, through the entity's own damage sensor) and sets off one
 * creeper-sized explosion at the start. Health is reported every 10 s for 3 minutes, then the zombies are removed.
 */
export function durabilityTest(player) {
  const b = player.dimension.getEntities({ type: "wilds:tuskbeast", location: player.location, maxDistance: 32, closest: 1 })[0];
  if (!b) return player.sendMessage("§eNo Tuskbeast within 32 blocks.");
  const dim = b.dimension, at = b.location;
  const zs = [0, 1, 2, 3].map((i) => {
    const a = (i / 4) * Math.PI * 2;
    return dim.spawnEntity("minecraft:zombie", { x: at.x + Math.cos(a) * 3, y: at.y + 0.5, z: at.z + Math.sin(a) * 3 });
  });
  try { dim.createExplosion({ x: at.x + 2, y: at.y + 1, z: at.z }, 3, { breaksBlocks: false }); } catch { /* */ }
  const start = Date.now();
  let sec = 0;
  const id = system.runInterval(guard("durtest", () => {
    sec++;
    if (!b.isValid || (health(b)?.currentValue ?? 0) <= 0) {
      player.sendMessage(`§c[test] Tuskbeast died after ${Math.round((Date.now() - start) / 1000)} s.`);
      zs.forEach((z) => z.isValid && z.remove()); return system.clearRun(id);
    }
    for (const z of zs) if (z.isValid) b.applyDamage(3, { cause: "entityAttack", damagingEntity: z });
    if (sec % 10 === 0) {
      const h = health(b);
      player.sendMessage(`§b[test] ${sec}s: ${h.currentValue.toFixed(1)}/${h.effectiveMax}${b.getProperty("wilds:wounded") ? " §c(Wounded)" : ""}`);
    }
    if (sec >= 180) { player.sendMessage("§b[test] 3 minutes done, it survived."); zs.forEach((z) => z.isValid && z.remove()); system.clearRun(id); }
  }), 20);
  player.sendMessage("§b[test] One creeper blast, then 4 zombies hitting once a second each (12 raw damage/s). Report every 10 s.");
}
