// P0-2 Tuskbeast riders and the howdah tower (0.0.5, Director 24 Nov 2026).
//
// Seats: the driver sits on the neck, just behind the head (seat 0, steers). Four passenger seats in the corners of the
// howdah, for anyone: the owner's (or an invited player's) Guilds+ archers and crossbowmen, or invited players.
// Guards sit (Guilds+ plays Mojang's riding pose).
//
// The tower: guards can't aim well from inside the howdah, so the tower shoots for them. Every seated archer or
// crossbowman adds shots: archer 1 arrow every 1.5 s; crossbowman 1 bolt every 2.5 s, faster and +2 damage on a hit.
// Arrows leave from the top of the howdah at the nearest hostile mob in sight (24 blocks), and come out of the Howdah
// chest (open your inventory while driving). The guards' own attacks are left alone.
//
// One tap on the Howdah Flag near a Tuskbeast (8 blocks) or while riding one:
//   - not aboard: you climb on (driver if the neck seat is free), then your own archers and crossbowmen within 24
//     blocks fill the free passenger seats.
//   - aboard with guards in the howdah: the guards climb down.
// Tap a player with the flag: invite them to ride your Tuskbeasts (tap again: un-invite). See owners.js.
import { world, system, guard, dist, guildsPresent, dbg } from "../core/util.js";
import { ownerOf, ownerNameOf, claim, mayRide, toggleInvite } from "./owners.js";

const BEAST = "wilds:tuskbeast", FLAG = "wilds:howdah_flag";
const RANGED = new Set(["guilds:merc_archer", "guilds:merc_crossbowman"]);
const CREW = "wilds:crew";              // beast dynamic property: JSON [merc entity ids]
const BOARD_RANGE = 24, SEATS = 5;      // driver + 4 passengers

const isPlayer = (e) => e?.typeId === "minecraft:player";
const isCrewType = (e) => RANGED.has(e?.typeId) || (e?.isValid && e.matches({ families: ["wilds_archer"] }));
const rideable = (b) => b.getComponent("minecraft:rideable");
const ridingOn = (e) => { try { return e.getComponent("minecraft:riding")?.entityRidingOn; } catch { return undefined; } };
const crewOf = (b) => { try { return JSON.parse(b.getDynamicProperty(CREW) ?? "[]"); } catch { return []; } };
const setCrew = (b, ids) => b.setDynamicProperty(CREW, ids.length ? JSON.stringify(ids) : undefined);

export function allBeasts() {
  const out = [];
  for (const d of ["overworld", "nether", "the_end"]) { try { out.push(...world.getDimension(d).getEntities({ type: BEAST })); } catch { /* */ } }
  return out;
}

/** A point on the beast, given in its own frame (x right, y up, z forward), in world coordinates. */
function onBeast(beast, ox, oy, oz) {
  const r = (beast.getRotation().y * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r), l = beast.location;
  return { x: l.x + ox * c - oz * s, y: l.y + oy, z: l.z + ox * s + oz * c };
}

function findBeast(player) {
  const r = ridingOn(player);
  if (r?.typeId === BEAST) return r;
  return player.dimension.getEntities({ type: BEAST, location: player.location, maxDistance: 8, closest: 1 })[0];
}

const besideBeast = (beast, i) => onBeast(beast, i % 2 ? 3 : -3, 0.5, i < 2 ? 0 : -2);

function dismountCrew(beast, player) {
  const rd = rideable(beast), crew = rd.getRiders().filter(isCrewType);
  crew.forEach((m, i) => { try { rd.ejectRider(m); m.teleport(besideBeast(beast, i)); } catch { /* */ } });
  setCrew(beast, []);
  player?.sendMessage(`§7${crew.length} guard${crew.length === 1 ? "" : "s"} climbed down.`);
}

/** The driver's seat (seat 0) is for players only (Director 24 Nov 2026). With a player aboard, a player sits there.
 *  With only guards aboard, an invisible seat keeper holds it, so the guards stay in the howdah. When a rider gets off,
 *  Minecraft slides everyone forward one seat; this puts them back within half a second. */
const KEEPER = "wilds:seat_keeper";
const isKeeper = (e) => e?.typeId === KEEPER;
const shuffling = new Set();                               // beasts whose riders are being put back in order
function arrange(beast) {
  const rd = rideable(beast), riders = rd.getRiders();
  const players = riders.filter(isPlayer), keepers = riders.filter(isKeeper), others = riders.filter((r) => !isPlayer(r) && !isKeeper(r));
  if (players.length) {
    if (isPlayer(riders[0]) && !keepers.length) return;                        // a player drives: all well
    for (const k of keepers) { try { rd.ejectRider(k); k.remove(); } catch { /* */ } }
    if (isPlayer(riders[0])) return;
  } else if (others.length) {
    if (isKeeper(riders[0]) && keepers.length === 1) return;                   // the keeper holds the driver's seat
    for (const k of keepers.slice(1)) { try { rd.ejectRider(k); k.remove(); } catch { /* */ } }
  } else {
    for (const k of keepers) { try { rd.ejectRider(k); k.remove(); } catch { /* */ } }   // nobody aboard: no keeper
    return;
  }
  let keeper = players.length ? undefined : keepers[0];
  [...players, ...others, ...(keeper ? [keeper] : [])].forEach((r) => { try { rd.ejectRider(r); } catch { /* */ } });
  shuffling.add(beast.id);
  system.runTimeout(guard("reorder", () => {
    shuffling.delete(beast.id);
    if (!beast.isValid) return;
    if (!players.length && !keeper?.isValid) keeper = beast.dimension.spawnEntity(KEEPER, beast.location);
    for (const r of [...players, ...(keeper ? [keeper] : []), ...others]) if (r.isValid) rd.addRider(r);
  }), 2);
}
const playerFirst = arrange;

function boardCrew(beast, player) {
  const rd = rideable(beast);
  if (!mayRide(player, beast)) return player.sendMessage(`§eThis Tuskbeast belongs to ${ownerNameOf(beast)}. Ask them to invite you.`);
  if (!ownerOf(beast)) claim(beast, player);
  if (!rd.getRiders().some((r) => r.id === player.id)) {
    if (rd.getRiders().filter((r) => !isKeeper(r)).length >= SEATS) return player.sendMessage("§eEvery seat is taken.");
    const k = rd.getRiders().find(isKeeper); if (k) { try { rd.ejectRider(k); k.remove(); } catch { /* */ } }
    if (!rd.addRider(player)) return player.sendMessage("§eCould not climb aboard here.");
    playerFirst(beast);
  }
  if (!guildsPresent()) return;
  const free = SEATS - rd.getRiders().filter((r) => !isKeeper(r)).length - (rd.getRiders().some(isPlayer) ? 0 : 1);
  if (free <= 0) return player.sendMessage("§7The howdah is full.");
  const cands = beast.dimension.getEntities({ families: ["ironhome_mercenary"], location: beast.location, maxDistance: BOARD_RANGE })
    .filter((m) => RANGED.has(m.typeId) && m.hasTag(`ih_merc:${player.id}`) && !ridingOn(m))
    .sort((a, b) => dist(a.location, beast.location) - dist(b.location, beast.location))
    .slice(0, free);
  if (!cands.length) return player.sendMessage("§7No archers or crossbowmen of yours within 24 blocks.");
  const crew = crewOf(beast);
  cands.forEach((m, i) => {
    m.teleport(besideBeast(beast, i));
    system.runTimeout(guard("seat", () => {
      if (!m.isValid || !beast.isValid) return;
      if (rideable(beast).addRider(m)) { if (!crew.includes(m.id)) crew.push(m.id); setCrew(beast, crew); }
      else player.sendMessage(`§e${m.nameTag || "A guard"} could not take a seat.`);
    }), 4 + i);
  });
  player.sendMessage(`§a${cands.length} guard${cands.length === 1 ? "" : "s"} climbing into the howdah.`);
}

function flagOnBeast(p, beast) {
  const crewAboard = rideable(beast).getRiders().filter(isCrewType);
  if (crewAboard.length && ridingOn(p)?.id === beast.id) dismountCrew(beast, p); else boardCrew(beast, p);
}

let lastTap = -10;                                       // a tap on an entity can also fire itemUse: handle it once
world.afterEvents.playerInteractWithEntity.subscribe(guard("flag.tap", (e) => {
  if (e.itemStack?.typeId !== FLAG) return;
  lastTap = system.currentTick;
  const p = e.player, t = e.target;
  if (isPlayer(t)) toggleInvite(p, t);
  else if (t?.typeId === BEAST) flagOnBeast(p, t);
}));
world.afterEvents.itemUse.subscribe(guard("flag", (e) => {
  if (e.itemStack?.typeId !== FLAG || system.currentTick - lastTap < 3) return;
  const p = e.source, beast = findBeast(p);
  if (!beast) return p.sendMessage("§eStand next to a Tuskbeast (within 8 blocks), or ride one, then tap the flag. Tap a friend with it to invite them.");
  flagOnBeast(p, beast);
}));

// ---- riders: only the owner and invited players; a player drives; crew dropped by a reload climbs back on
// Re-seating only happens in the first 30 s after a beast loads (that is when a reload drops riders). A guard who gets
// off later (the Guilds+ Commander's Horn "Return to posts", a command) leaves the crew for good.
const RESEAT_WINDOW = 600, seenAt = new Map();          // beast id -> tick this loop first saw it loaded
system.runInterval(guard("riders", () => {
  for (const beast of allBeasts()) {
    const rd = rideable(beast);
    for (const r of rd.getRiders()) {
      if (!isPlayer(r)) continue;
      if (!ownerOf(beast)) claim(beast, r);
      else if (!mayRide(r, beast)) { rd.ejectRider(r); r.sendMessage(`§eThis Tuskbeast belongs to ${ownerNameOf(beast)}. Ask them to invite you.`); }
    }
    playerFirst(beast);
  }
  for (const d of ["overworld", "nether", "the_end"]) {                       // a seat keeper off its beast has no job
    try { for (const k of world.getDimension(d).getEntities({ type: KEEPER })) if (!ridingOn(k)) k.remove(); } catch { /* */ }
  }
}), 10);
system.runInterval(guard("crew", () => {
  const now = system.currentTick, beasts = allBeasts(), here = new Set(beasts.map((b) => b.id));
  for (const id of seenAt.keys()) if (!here.has(id)) seenAt.delete(id);      // unloaded: fresh again when it loads
  for (const beast of beasts) {
    if (!seenAt.has(beast.id)) seenAt.set(beast.id, now);
    const fresh = now - seenAt.get(beast.id) <= RESEAT_WINDOW;
    const ids = crewOf(beast); if (!ids.length || shuffling.has(beast.id)) continue;
    const rd = rideable(beast), keep = [];
    for (const id of ids) {
      const m = world.getEntity(id);
      if (!m) { keep.push(id); continue; }                                           // unloaded: keep the record
      if (!m.isValid) continue;
      const on = ridingOn(m);
      if (on?.id === beast.id) { keep.push(id); continue; }
      if (fresh && !on && dist(m.location, beast.location) <= BOARD_RANGE && rd.getRiders().length < SEATS) {
        if (rd.addRider(m)) { keep.push(id); dbg(`re-seated ${m.nameTag || m.typeId} after reload`); }
      }
    }
    if (keep.length !== ids.length) setCrew(beast, keep);
  }
}), 40);

world.afterEvents.entityDie.subscribe(guard("crew.die", (e) => {
  let id; try { id = e.deadEntity.id; } catch { return; }
  for (const b of allBeasts()) { const c = crewOf(b); if (c.includes(id)) setCrew(b, c.filter((x) => x !== id)); }
}));

// ---- the howdah tower
export const stats = { nativeShots: 0, towerShots: 0, bolts: 0, boltHits: 0 };
const RANGE = 24, SPREAD = 4, TOWER = [0, 10.1, -0.9];   // top of the howdah roof (9.56 blocks), its middle
const GUN = {                                              // per seated guard
  "guilds:merc_archer": { every: 30, speed: 2.4, bonus: 0 },
  "guilds:merc_crossbowman": { every: 50, speed: 3.2, bonus: 2 },
};
const nextShot = new Map();                                // guard id -> tick of his next tower shot
const lastOut = new Map();
const bolts = new Map();                                   // arrow id -> [bonus, tick fired] (the arrow is gone by the hit event)

function takeArrow(beast) {
  const c = beast.getComponent("minecraft:inventory")?.container; if (!c) return false;
  for (let i = 0; i < c.size; i++) {
    const it = c.getItem(i);
    if (it?.typeId !== "minecraft:arrow") continue;
    if (it.amount > 1) { it.amount -= 1; c.setItem(i, it); } else c.setItem(i, undefined);
    return true;
  }
  return false;
}
function validTarget(t) {
  if (!t.isValid || isPlayer(t)) return false;
  if (!t.matches({ families: ["monster"] })) return false;                    // hostile mobs only
  if (t.matches({ families: ["ironhome_mercenary"] }) || t.matches({ families: ["wilds"] })) return false;
  return !t.getTags().some((tag) => tag.startsWith("ih_merc:"));
}
function clearLine(dim, from, to) {
  const d = { x: to.x - from.x, y: to.y - from.y, z: to.z - from.z }, len = Math.hypot(d.x, d.y, d.z);
  const dir = { x: d.x / len, y: d.y / len, z: d.z / len };
  if (dim.getBlockFromRay(from, dir, { maxDistance: len, includeLiquidBlocks: false, includePassableBlocks: false })) return false;
  try { return dim.getEntitiesFromRay(from, dir, { maxDistance: len, type: "minecraft:player" }).length === 0; } catch { return true; }  // never through a player
}
function towerTarget(beast, from) {
  const dim = beast.dimension;
  return dim.getEntities({ location: from, maxDistance: RANGE, families: ["monster"] }).filter(validTarget)
    .sort((a, b) => dist(a.location, from) - dist(b.location, from))
    .find((x) => clearLine(dim, from, { x: x.location.x, y: x.location.y + 1, z: x.location.z }));
}
function fire(beast, from, t, shooter, gun) {
  const dim = beast.dimension;
  const aim = { x: t.location.x - from.x, y: t.location.y + 1 - from.y, z: t.location.z - from.z };
  const len = Math.hypot(aim.x, aim.y, aim.z);
  aim.y += len * 0.02;                                                         // arc for gravity
  const n = Math.hypot(aim.x, aim.y, aim.z), dir = { x: aim.x / n, y: aim.y / n, z: aim.z / n };
  const arrow = dim.spawnEntity("minecraft:arrow", { x: from.x + dir.x * 0.6, y: from.y + dir.y * 0.6, z: from.z + dir.z * 0.6 });
  arrow.setDynamicProperty("wilds:scripted", true);
  if (gun.bonus) { bolts.set(arrow.id, [gun.bonus, system.currentTick]); stats.bolts++; }
  const pr = arrow.getComponent("minecraft:projectile");
  pr.owner = shooter;                                                          // the guard: friendly-fire guard and Guilds+ know him
  pr.shoot({ x: dir.x * gun.speed, y: dir.y * gun.speed, z: dir.z * gun.speed }, { uncertainty: SPREAD });
  stats.towerShots++;
}
system.runInterval(guard("tower", () => {
  const now = system.currentTick;
  for (const beast of allBeasts()) {
    const crew = rideable(beast).getRiders().filter((r) => GUN[r.typeId]);
    if (!crew.length) continue;
    const ready = crew.filter((m) => (nextShot.get(m.id) ?? 0) <= now);
    if (!ready.length) continue;
    const from = onBeast(beast, ...TOWER), t = towerTarget(beast, from);
    if (!t) continue;
    for (const m of ready) {
      if (!takeArrow(beast)) {
        if (now - (lastOut.get(beast.id) ?? -9999) > 1200) {
          lastOut.set(beast.id, now);
          rideable(beast).getRiders().find(isPlayer)?.sendMessage("§eThe Howdah chest is out of arrows. Open your inventory while driving to fill it.");
        }
        break;
      }
      const gun = GUN[m.typeId];
      fire(beast, from, t, m, gun);
      nextShot.set(m.id, now + gun.every);
    }
  }
}), 5);
system.runInterval(() => { const old = system.currentTick - 200; for (const [k, v] of bolts) if (v[1] < old) bolts.delete(k); }, 200);
// crossbow bolts hit harder (+2), on top of their faster flight
world.afterEvents.projectileHitEntity.subscribe(guard("bolt", (e) => {
  let id; try { id = e.projectile.id; } catch { return; }
  const b = bolts.get(id); if (!b) return;
  bolts.delete(id);
  const hit = e.getEntityHit()?.entity, src = e.source; if (!hit?.isValid || isPlayer(hit)) return;
  // half a second later: a mob ignores most of a second hit inside its 0.5 s hurt cooldown
  system.runTimeout(guard("bolt2", () => {
    if (!hit.isValid) return;
    hit.applyDamage(b[0], src?.isValid ? { cause: "entityAttack", damagingEntity: src } : { cause: "entityAttack" });
    stats.boltHits++;
  }), 11);
}));

// ---- measurement for the test: count arrows that seated guards still fire themselves (their own attacks)
world.afterEvents.entitySpawn.subscribe(guard("shotcount", (e) => {
  const a = e.entity;
  if (a?.typeId !== "minecraft:arrow") return;
  system.run(guard("shotcount2", () => {
    if (!a.isValid || a.getDynamicProperty("wilds:scripted")) return;
    const owner = a.getComponent("minecraft:projectile")?.owner;
    if (!owner || !isCrewType(owner) || ridingOn(owner)?.typeId !== BEAST) return;
    stats.nativeShots++;
  }));
}));

/** Server test hook: seat an owner's ranged mercenaries on a beast with no player present. Returns the number seated. */
export function testSeat(beast, ownerId) {
  const rd = rideable(beast), crew = crewOf(beast);
  const cands = beast.dimension.getEntities({ families: ["ironhome_mercenary"], location: beast.location, maxDistance: BOARD_RANGE })
    .filter((m) => RANGED.has(m.typeId) && m.hasTag(`ih_merc:${ownerId}`) && !ridingOn(m));
  let n = 0;
  for (const m of cands) {
    if (rd.getRiders().length >= SEATS - 1) break;
    if (rd.addRider(m)) { n++; crew.push(m.id); }
  }
  setCrew(beast, crew);
  return n;
}
/** Server test hook: where the tower and the seats are, in world coordinates. */
export function towerReport(beast) {
  const f = (v) => `${v.x.toFixed(1)} ${v.y.toFixed(1)} ${v.z.toFixed(1)}`;
  return `beast ${f(beast.location)} yaw ${beast.getRotation().y.toFixed(0)}, tower ${f(onBeast(beast, ...TOWER))}, head side ${f(onBeast(beast, 0, 0, 4))}`;
}
export function seatReport() {
  return allBeasts().map((b) => {
    const rs = rideable(b).getRiders().map((r) => (isPlayer(r) ? r.name : r.nameTag || r.typeId));
    return `Tuskbeast at ${Math.floor(b.location.x)} ${Math.floor(b.location.y)} ${Math.floor(b.location.z)}: seats [${rs.join(", ")}], crew record ${crewOf(b).length}, owner ${ownerNameOf(b)}`;
  });
}
