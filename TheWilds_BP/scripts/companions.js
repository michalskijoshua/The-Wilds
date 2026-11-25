// Companions (0.0.21, Checkpoint C: TW-30 to TW-33). Reusable for future pets: a species registers once.
//
// Knocked out instead of dying (TW-30): damage that would kill a TAMED companion is cancelled before it lands
// (world.beforeEvents.entityHurt, so one huge hit works too) and it is knocked out at 1 health: it can't move, fight or
// do tricks, takes no damage, drops nothing, stays its owner's. Feeding its healing food heals it (4 each); at 10 health
// (half) it gets up. No healing on its own. Wild ones stay mortal.
// Rescue: lethal fall or combat damage knocks it out where it is. Lava, fire, drowning, suffocation and the void move it
// first: to safe ground within 8 blocks, else next to its owner, else to its Wander home, else to the last safe spot it
// stood on (checked every 5 s); it stays knocked out. A rescue
// can happen at most once every 3 s per companion (no teleport loops). Ordinary combat never teleports.
// Registry (TW-33): world property wilds:companions = { uid: { sp, variant, name, owner, ownerName, hp, down, mode, home,
// last: { dim, x, y, z }, seen, recall } }. uid is stored on the creature (wilds:uid). Written only when something changes.
// Recall (Whistle, and Guilds+ later): a loaded companion is moved to safe ground near the caller. An unloaded one gets a short-lived ticking area at its last known spot so it loads, then it is moved; if that fails the
// recall waits in the record and happens the next time it loads. Never a replacement, never a heal, owner only.
import { world, system } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { guard, jget, jset, dbg, VERSION } from "./core/util.js";
import { entityById } from "./core/util.js";

const REG = "wilds:companions";
export const SPECIES = new Map();          // typeId -> { name, food:Set, heal, recoverAt, downEvent, upEvent, modeEvent(m), downClip }
export function registerCompanion(typeId, cfg) { SPECIES.set(typeId, { heal: 4, recoverAt: 10, ...cfg, food: new Set(cfg.food) }); }
export const compStats = { downs: 0, saved: 0, rescues: 0, recalls: 0, queued: 0, writes: 0 };
const reg = () => jget(REG, {});
const save = (r) => { jset(REG, r); compStats.writes++; };
const isTame = (e) => { try { return !!e.getComponent("minecraft:is_tamed"); } catch { return false; } };
export const ownerOf = (e) => { try { return e.getDynamicProperty("wilds:owner"); } catch { return undefined; } };
export const isDown = (e) => { try { return !!e.getDynamicProperty("wilds:down"); } catch { return false; } };
const HAZARD = new Set(["lava", "fire", "fireTick", "magma", "drowning", "suffocation", "void"]);
const uidOf = (e) => { let u = e.getDynamicProperty("wilds:uid"); if (!u) { u = `c${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`; e.setDynamicProperty("wilds:uid", u); } return u; };

// ---- safe ground
const SOFT = /^minecraft:(air|short_grass|tall_grass|fern|large_fern|snow_layer|.*_flower|.*tulip|poppy|dandelion|blue_orchid|allium|azure_bluet|oxeye_daisy|cornflower|lily_of_the_valley|.*_carpet)$/;
const BAD_FLOOR = /lava|water|fire|magma|cactus|campfire|sweet_berry|powder_snow|air$|light_block/;
function safeAt(dim, x, y, z) {
  try {
    const feet = dim.getBlock({ x, y, z }), head = dim.getBlock({ x, y: y + 1, z }), floor = dim.getBlock({ x, y: y - 1, z });
    if (!feet || !head || !floor) return false;
    if (!(feet.isAir || SOFT.test(feet.typeId)) || !(head.isAir || SOFT.test(head.typeId))) return false;
    if (floor.isAir || floor.isLiquid || BAD_FLOOR.test(floor.typeId)) return false;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = dim.getBlock({ x: x + dx, y, z: z + dz }); if (n && /lava|fire/.test(n.typeId)) return false; }
    return true;
  } catch { return false; }
}
/** The nearest safe spot around a point (radius r), or undefined. */
export function safeNear(dim, at, r = 8) {
  const cx = Math.floor(at.x), cy = Math.floor(at.y), cz = Math.floor(at.z);
  for (let d = 0; d <= r; d++) for (let dx = -d; dx <= d; dx++) for (let dz = -d; dz <= d; dz++) {
    if (Math.max(Math.abs(dx), Math.abs(dz)) !== d) continue;
    for (const dy of [0, 1, -1, 2, -2, 3, -3, 4, -4]) if (safeAt(dim, cx + dx, cy + dy, cz + dz)) return { x: cx + dx + 0.5, y: cy + dy, z: cz + dz + 0.5 };
  }
  // the void or deep water: try straight above, up to the top
  try { const top = dim.getTopmostBlock({ x: cx, z: cz }); if (top && !top.isLiquid && safeAt(dim, cx, top.location.y + 1, cz)) return { x: cx + 0.5, y: top.location.y + 1, z: cz + 0.5 }; } catch { /* */ }
  return undefined;
}

// ---- knocked out
export function knockOut(e) {
  const sp = SPECIES.get(e.typeId); if (!sp) return;
  if (!isDown(e)) { e.setDynamicProperty("wilds:down", true); e.triggerEvent(sp.downEvent); compStats.downs++; }
  try { e.getComponent("minecraft:health").setCurrentValue(1); } catch { /* */ }
  try { e.extinguishFire(); } catch { /* */ }
  note(e);
  const o = entityById(ownerOf(e) ?? ""); try { o?.sendMessage(`§e${e.nameTag || sp.name} is knocked out! Feed it ${sp.foodName} to help it up.`); } catch { /* */ }
}
export function getUp(e) {
  const sp = SPECIES.get(e.typeId); if (!sp || !isDown(e)) return;
  e.setDynamicProperty("wilds:down", undefined); e.triggerEvent(sp.upEvent);
  e.triggerEvent(sp.modeEvent(e.getDynamicProperty("wilds:mode") ?? "follow"));
  note(e);
}
/** Healing food while knocked out. Returns the new health. */
export function healDown(e) {
  const sp = SPECIES.get(e.typeId), h = e.getComponent("minecraft:health"); if (!sp || !h) return undefined;
  h.setCurrentValue(Math.min(h.effectiveMax, h.currentValue + sp.heal));
  if (h.currentValue >= sp.recoverAt) getUp(e);
  note(e);
  return h.currentValue;
}
const lastRescue = new Map();
system.runInterval(() => { const old = system.currentTick - 200; for (const [k, t] of lastRescue) if (t < old) lastRescue.delete(k); }, 1200);   // TW-50
export function rescue(e, why) {
  const t = system.currentTick; if (t - (lastRescue.get(e.id) ?? -999) < 60) return "too soon";
  lastRescue.set(e.id, t);
  const dim = e.dimension;
  let to = safeNear(dim, e.location, 8), where = "nearby";
  if (!to) { const o = entityById(ownerOf(e) ?? ""); if (o?.isValid) { const s = safeNear(o.dimension, o.location, 6); if (s) { to = { ...s, dim: o.dimension }; where = "by its owner"; } } }
  if (!to) { const h = e.getDynamicProperty("wilds:home"); if (h) { const hp = JSON.parse(h), hd = world.getDimension(hp.dim), s = safeNear(hd, hp, 8); if (s) { to = { ...s, dim: hd }; where = "at its home"; } } }
  if (!to) { const ls = e.getDynamicProperty("wilds:safe"); if (ls) { const sp = JSON.parse(ls), sd = world.getDimension(sp.dim), s = safeNear(sd, sp, 4); if (s) { to = { ...s, dim: sd }; where = "at its last safe spot"; } } }
  if (!to) return "nowhere safe";
  e.teleport({ x: to.x, y: to.y, z: to.z }, to.dim ? { dimension: to.dim } : undefined);
  try { e.extinguishFire(); } catch { /* */ }
  compStats.rescues++; dbg(`${e.typeId} rescued from ${why} ${where}`);
  return `moved ${where}`;
}
world.beforeEvents.entityHurt.subscribe((ev) => {
  const e = ev.hurtEntity; if (!SPECIES.has(e?.typeId) || !isTame(e)) return;
  const cause = ev.damageSource?.cause, down = isDown(e);
  let hp; try { hp = e.getComponent("minecraft:health").currentValue; } catch { return; }
  if (!down && hp - ev.damage > 0) return;                                     // ordinary damage: let it land
  ev.cancel = true;                                                              // lethal, or already knocked out: no damage
  compStats.saved++;
  system.run(guard("companion.down", () => {
    if (!e.isValid) return;
    if (!down) knockOut(e);
    if (HAZARD.has(cause)) rescue(e, cause);
  }));
});

// ---- registry
/** Writes this companion's record if something that matters changed. */
export function note(e) {
  if (!SPECIES.has(e.typeId) || !isTame(e)) return;
  const r = reg(), u = uidOf(e), old = r[u] ?? {}, l = e.location;
  const hp = Math.round(e.getComponent("minecraft:health")?.currentValue ?? 0);
  const rec = { sp: e.typeId, variant: e.getComponent("minecraft:mark_variant")?.value ?? 0, name: e.nameTag || undefined, owner: ownerOf(e),
    ownerName: e.getDynamicProperty("wilds:owner_name"), hp, down: isDown(e), mode: e.getDynamicProperty("wilds:mode") ?? "follow",
    home: e.getDynamicProperty("wilds:home") ? JSON.parse(e.getDynamicProperty("wilds:home")) : undefined,
    last: { dim: e.dimension.id, x: Math.floor(l.x), y: Math.floor(l.y), z: Math.floor(l.z) }, id: e.id, recall: old.recall };
  const moved = !old.last || old.last.dim !== rec.last.dim || Math.hypot(old.last.x - rec.last.x, old.last.z - rec.last.z) > 8;
  if (!moved && old.hp === rec.hp && old.down === rec.down && old.mode === rec.mode && old.name === rec.name && old.owner === rec.owner && old.id === rec.id && JSON.stringify(old.home) === JSON.stringify(rec.home)) return;
  r[u] = { ...rec, seen: Date.now() }; save(r);
}
export const companionsOf = (ownerId) => Object.entries(reg()).filter(([, c]) => c.owner === ownerId && !c.gone);
// the moment a companion unloads (it walked out of range, or was carried off), its record gets that spot
world.beforeEvents.entityRemove.subscribe((ev) => {
  const e = ev.removedEntity; if (!SPECIES.has(e?.typeId)) return;
  let u, l, d; try { u = e.getDynamicProperty("wilds:uid"); l = e.location; d = e.dimension.id; } catch { return; }
  if (!u) return;
  system.run(() => { const r = reg(); if (r[u]) { r[u].last = { dim: d, x: Math.floor(l.x), y: Math.floor(l.y), z: Math.floor(l.z) }; r[u].seen = Date.now(); save(r); } });
});
world.afterEvents.entityDie.subscribe(guard("companion.die", (e) => {                 // only possible by commands now
  let u; try { u = e.deadEntity.getDynamicProperty("wilds:uid"); } catch { return; }
  if (!u) return; const r = reg(); if (r[u]) { r[u].gone = Date.now(); save(r); }
}));

// ---- recall
async function bringTo(u, dest, caller) {
  const r = reg(), c = r[u]; if (!c) return "unknown companion";
  if (caller && c.owner !== caller.id) return "not yours";
  let e = c.id ? entityById(c.id) : undefined;
  if (!e?.isValid) {                                                             // unloaded: load its last spot for a moment
    const area = `wilds_recall_${u}`, dim = world.getDimension(c.last.dim), m = world.tickingAreaManager;
    const opts = { dimension: dim, from: { x: c.last.x - 8, y: c.last.y - 8, z: c.last.z - 8 }, to: { x: c.last.x + 8, y: c.last.y + 8, z: c.last.z + 8 } };
    try { if (!m.hasTickingArea(area) && m.hasCapacity(opts)) await m.createTickingArea(area, opts); } catch (err) { dbg(`recall area: ${err}`); }
    for (let i = 0; i < 40 && !e?.isValid; i++) {
      await new Promise((res) => system.runTimeout(res, 10));
      e = (c.id ? entityById(c.id) : undefined) ?? dim.getEntities({ type: c.sp, location: c.last, maxDistance: 24 }).find((x) => x.getDynamicProperty("wilds:uid") === u);
    }
    try { m.removeTickingArea(area); } catch { /* */ }
  }
  if (!e?.isValid) { r[u].recall = { x: dest.x, y: dest.y, z: dest.z, dimId: dest.dimId ?? dest.dim.id }; save(r); compStats.queued++; return "it couldn't be reached; it will come the next time its area loads"; }
  const s = safeNear(dest.dim, dest, 6); if (!s) return "no safe ground there";
  e.teleport(s, { dimension: dest.dim });
  const r2 = reg(); if (r2[u]) { delete r2[u].recall; save(r2); }
  note(e); compStats.recalls++;
  return "recalled";
}
export const recallCompanion = (u, dest, caller) => bringTo(u, dest, caller);

// every 5 s: keep records fresh, carry out waiting recalls, settle older companions (0.0.21 split the guard behaviour)
system.runInterval(guard("companions", () => {
  const r = reg();
  for (const type of SPECIES.keys()) for (const d of ["overworld", "nether", "the_end"]) {
    let list; try { list = world.getDimension(d).getEntities({ type }); } catch { continue; }
    for (const e of list) {
      try {
        if (!isTame(e)) continue;
        if (!e.getDynamicProperty("wilds:c21")) { e.setDynamicProperty("wilds:c21", true); if (!isDown(e)) e.triggerEvent("wilds:guard_on"); }
        note(e);
        if (!isDown(e) && e.isOnGround && !e.isInWater && safeAt(e.dimension, Math.floor(e.location.x), Math.floor(e.location.y), Math.floor(e.location.z)))   // last safe spot (void rescue)
          e.setDynamicProperty("wilds:safe", JSON.stringify({ dim: e.dimension.id, x: Math.floor(e.location.x), y: Math.floor(e.location.y), z: Math.floor(e.location.z) }));
        const u = e.getDynamicProperty("wilds:uid"), q = u && r[u]?.recall;
        if (q) bringTo(u, { ...q, dim: world.getDimension(q.dimId) }).catch(() => {});
      } catch (err) { dbg(`companion ${e.id}: ${err}`); }                         // TW-54: one bad companion never stops the rest
    }
  }
}), 100);

// ---- Wander home (TW-32): the entity file keeps it roaming; if it is more than 12 blocks from its home (in the same
// dimension), small pushes walk it back. Pushes are physics, so walls and fences still stop it (no teleport).
export const HOME_RADIUS = 12;
system.runInterval(guard("companion.home", () => {
  for (const type of SPECIES.keys()) for (const d of ["overworld", "nether", "the_end"]) {
    let list; try { list = world.getDimension(d).getEntities({ type }); } catch { continue; }
    for (const e of list) {
      try {
        if (!isTame(e) || isDown(e) || e.getDynamicProperty("wilds:mode") !== "wander") continue;
        const h = JSON.parse(e.getDynamicProperty("wilds:home") ?? "null"); if (!h || h.dim !== e.dimension.id) continue;
        const dx = h.x + 0.5 - e.location.x, dz = h.z + 0.5 - e.location.z, dd = Math.hypot(dx, dz);
        if (dd <= HOME_RADIUS) continue;
        e.applyImpulse({ x: (dx / dd) * 0.12, y: 0, z: (dz / dd) * 0.12 });
        e.setRotation({ x: 0, y: (Math.atan2(-dx, dz) * 180) / Math.PI });
      } catch (err) { dbg(`home ${e.id}: ${err}`); }
    }
  }
}), 5);

// ---- Companion Whistle (works with or without Guilds+)
const WHISTLE = "wilds:companion_whistle";
const DIM_NAME = { "minecraft:overworld": "Overworld", "minecraft:nether": "Nether", "minecraft:the_end": "The End" };
const line = (c) => `${c.name ?? SPECIES.get(c.sp)?.name ?? c.sp}${c.down ? " §c(knocked out)" : ""}§r\n§8${c.hp} health, ${c.mode}, ${DIM_NAME[c.last.dim] ?? c.last.dim} ${c.last.x} ${c.last.y} ${c.last.z}`;
async function whistleMenu(p) {
  const list = companionsOf(p.id);
  if (!list.length) return p.sendMessage("§7You have no companions yet. Tame a Frost Lynx with raw meat.");
  const f = new ActionFormData().title("Companions").body("Tap one to call it to you. It keeps its health: a knocked-out one stays knocked out.");
  for (const [, c] of list) f.button(line(c));
  const res = await f.show(p);
  if (res.canceled || res.selection === undefined || !p.isValid) return;
  const [u] = list[res.selection];
  p.sendMessage("§7Calling...");
  const msg = await bringTo(u, { x: p.location.x, y: p.location.y, z: p.location.z, dim: p.dimension, dimId: p.dimension.id }, p);
  p.sendMessage(msg === "recalled" ? "§aIt's here!" : `§e${msg}`);
}
world.afterEvents.itemUse.subscribe(guard("whistle", (e) => {
  if (e.itemStack?.typeId !== WHISTLE) return;
  try { e.source.playSound("note.flute", { volume: 0.8 }); } catch { /* */ }
  whistleMenu(e.source).catch((err) => console.warn(`[wilds] whistle: ${err}`));
}));

// ---- Guilds+ link (optional, by script events; see GUILDS_PATCH_PROPOSAL.md part 5)
//   wilds:companions <playerId>                       -> reply guilds:wilds_companions { player, list: [...] }
//   wilds:recall <playerId> <uid> <dimId> <x> <y> <z>  -> reply guilds:wilds_recall { player, uid, result }
system.afterEvents.scriptEventReceive.subscribe(guard("companion.api", (e) => {
  if (e.id === "wilds:companions") {
    const pid = (e.message ?? "").trim();
    system.sendScriptEvent("guilds:wilds_companions", JSON.stringify({ player: pid, list: companionsOf(pid).map(([u, c]) => ({ uid: u, ...c })) }));
  } else if (e.id === "wilds:recall") {
    const [pid, u, dimId, x, y, z] = (e.message ?? "").trim().split(/\s+/);
    const r = reg()[u]; if (!r || r.owner !== pid) return system.sendScriptEvent("guilds:wilds_recall", JSON.stringify({ player: pid, uid: u, result: "not yours" }));
    bringTo(u, { x: +x, y: +y, z: +z, dim: world.getDimension(dimId), dimId }).then((result) => system.sendScriptEvent("guilds:wilds_recall", JSON.stringify({ player: pid, uid: u, result }))).catch(() => {});
  }
}), { namespaces: ["wilds"] });
world.afterEvents.worldLoad.subscribe(guard("companion.hello", () => system.runTimeout(() => {
  try { system.sendScriptEvent("guilds:wilds_hello", JSON.stringify({ version: VERSION, caps: ["companions.v1", "recall.v1"] })); } catch { /* */ }
}, 60)));
