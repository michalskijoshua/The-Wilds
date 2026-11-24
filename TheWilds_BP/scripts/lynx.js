// Frost Lynx (0.0.14, Batch C, Director 24 Nov 2026).
//   Wild: snowy spruce (cold_taiga), one per 500 x 500 square, back 1 real day after it dies. Flees players (at 11
//         blocks; 4 when you sneak; a sneaking player holding raw meat is not feared). Never fights back. Hunts
//         rabbits, chickens and Bloomlings at dusk and night (entity file).
//   Taming: raw meat (beef, porkchop, mutton, chicken, rabbit), about 1 in 3 per feed (vanilla tameable). The tamer owns it.
//   Tamed: tap with an empty hand for Follow / Stay / Wander. Defends its owner. Does not hunt. Raw meat from its owner
//         = a random trick (and a little health).
//   Drops Fur. Not cageable.
// Animations started from here (Entity.playAnimation), never from client conditions: pin_and_bite when it bites,
// sniff/eat while being tamed, taming_nuzzle when tamed, the tricks.
import { world, system } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { guard, dbg, sfx, dist } from "./core/util.js";
import { squareSpawner, squareTaken } from "./core/spawner.js";

const LYNX = "wilds:frost_lynx";
export const MEAT = ["minecraft:beef", "minecraft:porkchop", "minecraft:mutton", "minecraft:chicken", "minecraft:rabbit"];
export const TRICKS = ["trick_spin", "trick_offer_paw", "listen_and_peek"];
export const lynxStats = { tamed: 0, tricks: 0, bites: 0, anims: 0 };
const anim = (e, clip) => {
  const name = `animation.wilds_frost_lynx.${clip}`;
  try { e.playAnimation(name, { blendOutTime: 0.2 }); lynxStats.anims++; return true; } catch { /* */ }
  try { e.runCommand(`playanimation @s ${name} default 0.2`); lynxStats.anims++; return true; } catch { return false; }
};
const tameOf = (e) => e.getComponent("minecraft:tameable");
const ownerId = (e) => { try { return tameOf(e)?.tamedToPlayerId ?? e.getDynamicProperty("wilds:owner"); } catch { return e.getDynamicProperty("wilds:owner"); } };
const isTamed = (e) => !!e.getComponent("minecraft:is_tamed");
const creative = (p) => { try { return String(p.getGameMode()).toLowerCase() === "creative"; } catch { return false; } };

export const LYNX_BIOMES = ["cold_taiga", "cold_taiga_hills", "cold_taiga_mutated"];
export const lynxSpawner = squareSpawner({
  key: "frost_lynx", square: 500, returnMs: 24 * 3600 * 1000, fits: (b) => LYNX_BIOMES.includes(b),
  spawn: (dim, spot) => dim.spawnEntity(LYNX, spot),
});

// tamed: remember the owner (also for players who are offline) and greet
world.afterEvents.dataDrivenEntityTrigger.subscribe(guard("lynx.tame", (e) => {
  const l = e.entity; if (!l?.isValid) return;
  const p = tameOf(l)?.tamedToPlayer;
  if (p) { l.setDynamicProperty("wilds:owner", p.id); l.setDynamicProperty("wilds:mode", "follow"); p.sendMessage("§aThe Frost Lynx trusts you now! Tap it with an empty hand to tell it to Follow, Stay or Wander."); }
  anim(l, "taming_nuzzle"); lynxStats.tamed++;
  squareTaken(l);                                          // it left the wild: its square may get a new wild one later
}), { entityTypes: [LYNX], eventTypes: ["wilds:on_tame"] });

export function setMode(l, mode) {
  l.triggerEvent(`wilds:mode_${mode}`); l.setDynamicProperty("wilds:mode", mode);
  if (mode === "stay") anim(l, "sit_down");
}
async function menu(p, l) {
  const cur = l.getDynamicProperty("wilds:mode") ?? "follow";
  const f = new ActionFormData().title("Frost Lynx").body(`Now: ${cur === "follow" ? "following you" : cur === "stay" ? "staying put" : "wandering"}.\nRaw meat makes it do a trick.`)
    .button("§2Follow§r\n§8Walks with you").button("§6Stay§r\n§8Sits right here").button("§9Wander§r\n§8Roams nearby");
  const r = await f.show(p);
  if (!r.canceled && r.selection !== undefined) setMode(l, ["follow", "stay", "wander"][r.selection]);
}
export function reward(p, l) {
  const h = l.getComponent("minecraft:health"); if (h) h.setCurrentValue(Math.min(h.effectiveMax, h.currentValue + 4));
  const t = TRICKS[Math.floor(Math.random() * TRICKS.length)];
  anim(l, t); lynxStats.tricks++;
  sfx(l.dimension, "wilds.frost_lynx.eat", l.location);
  system.runTimeout(() => { if (l.isValid) sfx(l.dimension, "wilds.frost_lynx.trick", l.location); }, 16);
  if (p && !creative(p)) {
    const inv = p.getComponent("minecraft:inventory")?.container, slot = p.selectedSlotIndex, it = inv?.getItem(slot);
    if (it && MEAT.includes(it.typeId)) { if (it.amount > 1) { it.amount -= 1; inv.setItem(slot, it); } else inv.setItem(slot, undefined); }
  }
  return t;
}
world.beforeEvents.playerInteractWithEntity.subscribe((e) => {
  const l = e.target, p = e.player; if (l?.typeId !== LYNX) return;
  const item = e.itemStack?.typeId;
  if (!isTamed(l)) { if (item && MEAT.includes(item)) system.run(() => { if (l.isValid) { anim(l, "sniff_offered_food"); sfx(l.dimension, "wilds.frost_lynx.eat", l.location); } }); return; }   // vanilla taming does the rest
  if (ownerId(l) !== p.id) return;
  if (!item) { e.cancel = true; system.run(guard("lynx.menu", () => { menu(p, l).catch(() => {}); })); }
  else if (MEAT.includes(item)) { e.cancel = true; system.run(guard("lynx.treat", () => { if (l.isValid) reward(p, l); })); }
});
// the bite
world.afterEvents.entityHurt.subscribe(guard("lynx.bite", (e) => {
  const a = e.damageSource?.damagingEntity; if (a?.typeId !== LYNX) return;
  anim(a, isTamed(a) ? "pin_and_bite" : "rabbit_pounce"); lynxStats.bites++;
  sfx(a.dimension, "wilds.frost_lynx.pounce", a.location);
}));
export const lynxInfo = (l) => `lynx ${Math.floor(l.location.x)},${Math.floor(l.location.y)},${Math.floor(l.location.z)}: tamed ${isTamed(l)}, owner ${ownerId(l) ?? "-"}, mode ${l.getDynamicProperty("wilds:mode") ?? "-"}, staying ${l.getComponent("minecraft:skin_id")?.value === 1}, speed ${l.getComponent("minecraft:movement")?.defaultValue ?? l.getComponent("minecraft:movement")?.currentValue}, hp ${l.getComponent("minecraft:health")?.currentValue}`;

// ---- sounds (Codex, 0.0.18): a hiss when a wild lynx bolts from a player, a purr near its owner now and then
const lastHiss = new Map();
system.runInterval(guard("lynx.sounds", () => {
  const now = Date.now(), players = world.getAllPlayers();
  for (const d of ["overworld", "nether", "the_end"]) {
    let ls; try { ls = world.getDimension(d).getEntities({ type: LYNX }); } catch { continue; }
    for (const l of ls) {
      if (!l.isValid) continue;
      if (!isTamed(l)) {
        const near = players.some((p) => p.dimension.id === l.dimension.id && !p.isSneaking && dist(p.location, l.location) <= 11);
        if (near && now - (lastHiss.get(l.id) ?? 0) > 12000) { lastHiss.set(l.id, now); sfx(l.dimension, "wilds.frost_lynx.flee", l.location); }
      } else {
        const owner = world.getEntity(ownerId(l) ?? "");
        const due = l.getDynamicProperty("wilds:next_purr") ?? 0;
        if (owner?.isValid && owner.dimension.id === l.dimension.id && dist(owner.location, l.location) <= 4 && now >= due) {
          if (due) sfx(l.dimension, "wilds.frost_lynx.purr", l.location, 0.9);
          l.setDynamicProperty("wilds:next_purr", now + 15000 + Math.random() * 20000);
        }
      }
    }
  }
}), 20);
