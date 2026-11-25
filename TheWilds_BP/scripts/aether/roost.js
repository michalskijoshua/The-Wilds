// Aetherseed Roost (0.0.20, TW-19/TW-27, Director-approved design).
// A 1x1 block that gives one Original or Bloom Aetherseed a home. Tap the Roost (empty hand or anything but a cage):
//   - empty Roost: "Give a home to the nearest Aetherseed" (Original or Bloom, not already homed, within 8 blocks)
//   - homed Roost: "Let it go" (it keeps its form and simply wanders freely again)
// A homed Aetherseed wanders and pulses as before (radius 5, about 45 s) but stays within 2 blocks of its Roost: if it
// strays further it glides back (collision-safe, core/move.js), never snapping onto it. Breaking the Roost, caging the
// seed, or the seed dying ends the bond. Withered seeds can't be homed. Roosts must be at least 8 blocks apart.
// No cost, no guild needed, no limit on Roosts or caged seeds (population is managed by one seed per Roost + spacing).
//
// Records: world property wilds:roosts = { "<dim>|x,y,z": { dim, x, y, z, seed: entity id | null } }; the seed carries
// wilds:roost = that key. Both sides are checked against each other, so a seed can have one Roost and a Roost one seed.
// An unloaded seed is not "lost": its bond stays until it is seen to be gone (its death, the cage or a broken Roost).
import { world, system, ItemStack } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { guard, jget, jset, dbg } from "../core/util.js";
import { glideToward } from "../core/move.js";

const ROOST = "wilds:aetherseed_roost", SEED = "wilds:aetherseed", REG = "wilds:roosts";
export const ROOST_RULES = { spacing: 8, home: 2, assignRange: 8 };
const keyOf = (dimId, l) => `${dimId}|${l.x},${l.y},${l.z}`;
const reg = () => jget(REG, {});
const save = (r) => jset(REG, r);
const homeOf = (r) => ({ x: r.x + 0.5, y: r.y + 1.6, z: r.z + 0.5 });
const formOf = (s) => s.getProperty("wilds:form");
export const roostStats = { placed: 0, refused: 0, homed: 0, freed: 0, returns: 0 };

// placing: keep Roosts 8 blocks apart
world.afterEvents.playerPlaceBlock.subscribe(guard("roost.place", (e) => { if (e.block.typeId === ROOST) placeRoost(e.block, e.player); }));
/** A Roost block was placed: record it, or take it back (to the player) if it is too close to another. */
export function placeRoost(b, player) {
  const r = reg(), k = keyOf(b.dimension.id, b.location);
  const close = Object.values(r).find((o) => o.dim === b.dimension.id && Math.hypot(o.x - b.location.x, o.y - b.location.y, o.z - b.location.z) < ROOST_RULES.spacing);
  if (close) {
    b.setType("minecraft:air");
    try { player.getComponent("minecraft:inventory").container.addItem(new ItemStack(ROOST, 1)); } catch { b.dimension.spawnItem(new ItemStack(ROOST, 1), b.location); }
    player?.sendMessage?.(`§eToo close to another Roost (at ${close.x} ${close.y} ${close.z}). Roosts need ${ROOST_RULES.spacing} blocks between them.`);
    roostStats.refused++; return "too close";
  }
  r[k] = { dim: b.dimension.id, x: b.location.x, y: b.location.y, z: b.location.z, seed: null }; save(r); roostStats.placed++;
  return k;
}
/** Ends a Roost's bond (and the record if `remove`). */
export function freeRoost(k, remove = false) {
  const r = reg(), o = r[k]; if (!o) return;
  if (o.seed) { const s = world.getEntity(o.seed); try { if (s?.isValid) s.setDynamicProperty("wilds:roost", undefined); } catch { /* */ } roostStats.freed++; }
  if (remove) delete r[k]; else o.seed = null;
  save(r);
}
world.afterEvents.playerBreakBlock.subscribe(guard("roost.break", (e) => {
  if (e.brokenBlockPermutation?.type?.id !== ROOST) return;
  freeRoost(keyOf(e.block.dimension.id, e.block.location), true);
}));
/** A seed leaves its Roost (it died, was caged, or turned Withered). */
export function unhome(seed) {
  let k; try { k = seed.getDynamicProperty("wilds:roost"); } catch { return; }
  if (!k) return;
  const r = reg(); if (r[k]?.seed === seed.id) { r[k].seed = null; save(r); roostStats.freed++; }
  try { seed.setDynamicProperty("wilds:roost", undefined); } catch { /* */ }
}
world.afterEvents.entityDie.subscribe(guard("roost.die", (e) => unhome(e.deadEntity)), { entityTypes: [SEED] });

/** Homes the nearest eligible seed to the Roost at key k. Returns a message. */
export function assignNearest(k) {
  const r = reg(), o = r[k]; if (!o) return "§eThis Roost isn't recorded. Break it and place it again.";
  if (o.seed && world.getEntity(o.seed)?.isValid) return "§7This Roost already has an Aetherseed.";
  const dim = world.getDimension(o.dim);
  const s = dim.getEntities({ type: SEED, location: homeOf(o), maxDistance: ROOST_RULES.assignRange })
    .filter((x) => formOf(x) !== 2 && !x.getDynamicProperty("wilds:roost"))
    .sort((a, b) => Math.hypot(a.location.x - o.x, a.location.z - o.z) - Math.hypot(b.location.x - o.x, b.location.z - o.z))[0];
  if (!s) return "§eNo Original or Bloom Aetherseed without a home within 8 blocks. (A Withered one needs bone meal first.)";
  o.seed = s.id; save(r); s.setDynamicProperty("wilds:roost", k); roostStats.homed++;
  return "§aThe Aetherseed has a home now. It will stay close to this Roost.";
}

world.beforeEvents.playerInteractWithBlock.subscribe((e) => {
  if (e.block.typeId !== ROOST || !e.isFirstEvent || e.itemStack?.typeId?.startsWith("wilds:cage")) return;
  if (e.player.isSneaking && e.itemStack) return;                                  // sneak + item: normal block use
  e.cancel = true;
  const p = e.player, k = keyOf(e.block.dimension.id, e.block.location);
  system.run(guard("roost.menu", () => menu(p, k).catch(() => {})));
});
async function menu(p, k) {
  const o = reg()[k], homed = o?.seed && world.getEntity(o.seed)?.isValid;
  const f = new ActionFormData().title("Aetherseed Roost")
    .body(homed ? "An Aetherseed lives here. It helps the plants around it." : "Empty. Bring an Original or Bloom Aetherseed close, then give it a home.");
  const acts = [];
  if (homed) { f.button("§6Let it go§r\n§8It wanders freely again"); acts.push(() => { freeRoost(k); p.sendMessage("§7The Aetherseed is free to wander."); }); }
  else { f.button("§2Give a home to the nearest Aetherseed§r\n§8Original or Bloom, within 8 blocks"); acts.push(() => p.sendMessage(assignNearest(k))); }
  f.button("Close"); acts.push(() => {});
  const r = await f.show(p);
  if (r.canceled || r.selection === undefined) return;
  const o2 = reg()[k]; if (!o2 || !p.isValid || p.dimension.id !== o2.dim || Math.hypot(p.location.x - o2.x, p.location.z - o2.z) > 10) return;   // re-checked
  acts[r.selection]();
}

// homed seeds stay within 2 blocks; records are kept honest
let beat = 0;
system.runInterval(guard("roost.home", () => {
  beat++;
  const r = reg();
  for (const [k, o] of Object.entries(r)) {
    if (!o.seed) continue;
    const s = world.getEntity(o.seed);
    if (!s?.isValid) continue;                                                    // unloaded: leave the bond alone
    try {
      if (s.getDynamicProperty("wilds:roost") !== k || formOf(s) === 2) { freeRoost(k); if (formOf(s) === 2) s.setDynamicProperty("wilds:roost", undefined); continue; }
      const h = homeOf(o), d = Math.hypot(s.location.x - h.x, s.location.y - h.y, s.location.z - h.z);
      if (d > ROOST_RULES.home) { glideToward(s, h, 0.35, ROOST_RULES.home - 0.5); roostStats.returns++; }
    } catch (err) { dbg(`roost ${k}: ${err}`); }
  }
  if (beat % 20 === 0) {                                                          // every 10 s: Roost blocks still there? seeds pointing at a real Roost?
    let changed = false;
    for (const [k, o] of Object.entries(r)) {
      let b; try { b = world.getDimension(o.dim).getBlock(o); } catch { continue; }
      if (b && b.typeId !== ROOST) { freeRoost(k, true); changed = true; }          // broken by something other than a player
    }
    if (changed) return;
    for (const d of ["overworld", "nether", "the_end"]) {
      let list; try { list = world.getDimension(d).getEntities({ type: SEED }); } catch { continue; }
      const now = reg();
      for (const s of list) { const k = s.getDynamicProperty("wilds:roost"); if (k && now[k]?.seed !== s.id) s.setDynamicProperty("wilds:roost", undefined); }
    }
  }
}), 10);
export const roostList = () => reg();
