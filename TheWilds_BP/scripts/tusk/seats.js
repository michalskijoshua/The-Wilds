// P0-2 Tuskbeast mounted archers.
// Finding (Guilds+ 0.9.6, ironhome/mercenaries.js): mercenaries fight through NATIVE mob AI
// (behavior.nearest_attackable_target + behavior.ranged_attack in guilds:merc_archer.json). The script there only does
// hiring, the roster (world property guilds:mercs), posts, patrol walking and supplies. So Path A should work: a seated
// mercenary keeps its own ranged goal, like a skeleton riding a spider.
//
// One tap on the Howdah Flag:
//   - not aboard: you climb into the driver seat, then up to two of YOUR ranged mercenaries within 24 blocks board.
//   - aboard with archers: the archers climb down beside the beast.
// Without Guilds+ the flag just seats you; the two archer seats are open to other players (tap the beast).
//
// Path B (fallback, off by default): `/scriptevent wilds:archers B` makes Wilds fire for seated archers:
// nearest hostile with line of sight, every 1.5 s, arrow spread, arrows taken from the Howdah chest.
import { world, system, guard, dist, guildsPresent, dbg, jget, jset } from "../core/util.js";

const BEAST = "wilds:tuskbeast", FLAG = "wilds:howdah_flag";
const RANGED = new Set(["guilds:merc_archer", "guilds:merc_crossbowman"]);
const CREW = "wilds:crew";              // beast dynamic property: JSON [merc entity ids]
const MODE = "wilds:archer_mode";       // world dynamic property: "A" | "B"
const BOARD_RANGE = 24, SEATS = 3;

const isPlayer = (e) => e?.typeId === "minecraft:player";
const isCrewType = (e) => RANGED.has(e?.typeId) || e?.matches?.({ families: ["wilds_archer"] });
const rideable = (b) => b.getComponent("minecraft:rideable");
const ridingOn = (e) => { try { return e.getComponent("minecraft:riding")?.entityRidingOn; } catch { return undefined; } };
const crewOf = (b) => { try { return JSON.parse(b.getDynamicProperty(CREW) ?? "[]"); } catch { return []; } };
const setCrew = (b, ids) => b.setDynamicProperty(CREW, ids.length ? JSON.stringify(ids) : undefined);
// Default B since 0.0.3: on server 1.26.65 seated mercenaries' own AI fired 2 arrows in ~3 minutes (Path A fails),
// while Path B fired 40 and killed zombies while the beast moved. "A" stays available for comparison.
export const archerMode = () => jget(MODE, "B");

export function allBeasts() {
  const out = [];
  for (const d of ["overworld", "nether", "the_end"]) { try { out.push(...world.getDimension(d).getEntities({ type: BEAST })); } catch { /* */ } }
  return out;
}

function findBeast(player) {
  const r = ridingOn(player);
  if (r?.typeId === BEAST) return r;
  return player.dimension.getEntities({ type: BEAST, location: player.location, maxDistance: 8, closest: 1 })[0];
}

function besideBeast(beast, i) {
  const a = (beast.getRotation().y * Math.PI) / 180 + (i ? Math.PI / 2 : -Math.PI / 2);
  return { x: beast.location.x - Math.sin(a) * 3, y: beast.location.y + 0.5, z: beast.location.z + Math.cos(a) * 3 };
}

function dismountCrew(beast, player) {
  const rd = rideable(beast), crew = rd.getRiders().filter(isCrewType);
  crew.forEach((m, i) => { try { rd.ejectRider(m); m.teleport(besideBeast(beast, i % 2)); } catch { /* */ } });
  setCrew(beast, []);
  player?.sendMessage(`§7${crew.length} archer${crew.length === 1 ? "" : "s"} climbed down.`);
}

function boardCrew(beast, player) {
  const rd = rideable(beast);
  let riders = rd.getRiders();
  if (!riders.some((r) => r.id === player.id)) {
    if (riders.length >= SEATS) return player.sendMessage("§eEvery seat is taken.");
    if (riders.length && !isPlayer(riders[0])) { riders.forEach((r) => rd.ejectRider(r)); }   // keep the driver seat for a player
    if (!rd.addRider(player)) return player.sendMessage("§eCould not climb aboard here.");
    riders = rd.getRiders();
  }
  if (!guildsPresent()) return player.sendMessage("§7The two archer seats are open: friends can tap the Tuskbeast to climb up.");
  const free = SEATS - riders.length;
  if (free <= 0) return player.sendMessage("§7The archer seats are full.");
  const cands = beast.dimension.getEntities({ families: ["ironhome_mercenary"], location: beast.location, maxDistance: BOARD_RANGE })
    .filter((m) => RANGED.has(m.typeId) && m.hasTag(`ih_merc:${player.id}`) && !ridingOn(m))
    .sort((a, b) => dist(a.location, beast.location) - dist(b.location, beast.location))
    .slice(0, free);
  if (!cands.length) return player.sendMessage("§7No archers or crossbowmen of yours within 24 blocks.");
  const crew = crewOf(beast);
  cands.forEach((m, i) => {
    m.teleport(besideBeast(beast, i % 2));
    system.runTimeout(guard("seat", () => {
      if (!m.isValid || !beast.isValid) return;
      if (rideable(beast).addRider(m)) { if (!crew.includes(m.id)) crew.push(m.id); setCrew(beast, crew); }
      else player.sendMessage(`§e${m.nameTag || "An archer"} could not take a seat.`);
    }), 2 + i);
  });
  player.sendMessage(`§a${cands.length} archer${cands.length === 1 ? "" : "s"} climbing into the howdah.`);
}

world.afterEvents.itemUse.subscribe(guard("flag", (e) => {
  if (e.itemStack?.typeId !== FLAG) return;
  const p = e.source, beast = findBeast(p);
  if (!beast) return p.sendMessage("§eStand next to a Tuskbeast (within 8 blocks), or ride one, then tap the flag.");
  const crewAboard = rideable(beast).getRiders().filter(isCrewType);
  if (crewAboard.length) dismountCrew(beast, p); else boardCrew(beast, p);
}));

// ---- keep the crew: a player who climbs back on must be the driver; crew that fell off (reload) climbs back on
system.runInterval(guard("crew", () => {
  for (const beast of allBeasts()) {
    const ids = crewOf(beast); if (!ids.length) continue;
    const rd = rideable(beast), riders = rd.getRiders();
    if (riders.length && !isPlayer(riders[0]) && riders.some(isPlayer)) {          // a player mounted behind the archers
      const crew = riders.filter(isCrewType);
      crew.forEach((m) => rd.ejectRider(m));
      system.runTimeout(guard("reseat", () => crew.forEach((m) => { if (m.isValid && beast.isValid) rd.addRider(m); })), 3);
      continue;
    }
    const keep = [];
    for (const id of ids) {
      const m = world.getEntity(id);
      if (!m) { keep.push(id); continue; }                                           // unloaded: keep the record
      if (!m.isValid) continue;
      const on = ridingOn(m);
      if (on?.id === beast.id) { keep.push(id); continue; }
      if (!on && dist(m.location, beast.location) <= BOARD_RANGE && rd.getRiders().length < SEATS) {
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

// ---- measurement for the test: count arrows that seated archers fire natively (Path A evidence)
export const stats = { nativeShots: 0, scriptShots: 0, lastNative: 0 };
world.afterEvents.entitySpawn.subscribe(guard("shotcount", (e) => {
  const a = e.entity;
  if (a?.typeId !== "minecraft:arrow") return;
  system.run(guard("shotcount2", () => {
    if (!a.isValid) return;
    const owner = a.getComponent("minecraft:projectile")?.owner;
    if (!owner || !isCrewType(owner) || ridingOn(owner)?.typeId !== BEAST) return;
    if (a.getDynamicProperty("wilds:scripted")) return;
    stats.nativeShots++; stats.lastNative = Date.now();
    dbg(`seated ${owner.nameTag || owner.typeId} fired (native AI). total ${stats.nativeShots}`);
  }));
}));

// ---- Path B: Wilds fires for seated archers
const INTERVAL = 30, RANGE = 20, SPEED = 2.4, SPREAD = 4;
const lastOut = new Map();
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
function lineOfSight(dim, from, to) {
  const d = { x: to.x - from.x, y: to.y - from.y, z: to.z - from.z }, len = Math.hypot(d.x, d.y, d.z);
  const dir = { x: d.x / len, y: d.y / len, z: d.z / len };
  const hit = dim.getBlockFromRay(from, dir, { maxDistance: len, includeLiquidBlocks: false, includePassableBlocks: false });
  return !hit;
}
function playerInLine(dim, from, t) {                                         // Path B never shoots through a player
  const d = { x: t.location.x - from.x, y: t.location.y + 1 - from.y, z: t.location.z - from.z }, len = Math.hypot(d.x, d.y, d.z);
  try {
    return dim.getEntitiesFromRay(from, { x: d.x / len, y: d.y / len, z: d.z / len }, { maxDistance: len, type: "minecraft:player" }).length > 0;
  } catch { return false; }
}
function fireFor(beast, archer) {
  const dim = beast.dimension, head = archer.getHeadLocation();
  const targets = dim.getEntities({ location: head, maxDistance: RANGE, families: ["monster"] }).filter(validTarget)
    .sort((a, b) => dist(a.location, head) - dist(b.location, head));
  const t = targets.find((x) => lineOfSight(dim, head, { x: x.location.x, y: x.location.y + 1, z: x.location.z }) && !playerInLine(dim, head, x));
  if (!t) return;
  if (!takeArrow(beast)) {
    const k = beast.id, n = Date.now();
    if (n - (lastOut.get(k) ?? 0) > 60000) {
      lastOut.set(k, n);
      const driver = rideable(beast).getRiders().find(isPlayer); driver?.sendMessage("§eThe Howdah chest is out of arrows.");
    }
    return;
  }
  const aim = { x: t.location.x - head.x, y: t.location.y + 1 - head.y, z: t.location.z - head.z };
  const len = Math.hypot(aim.x, aim.y, aim.z);
  aim.y += len * 0.02;                                                         // arc for gravity
  const n = Math.hypot(aim.x, aim.y, aim.z), dir = { x: aim.x / n, y: aim.y / n, z: aim.z / n };
  const at = { x: head.x + dir.x * 1.2, y: head.y + dir.y * 1.2, z: head.z + dir.z * 1.2 };
  const arrow = dim.spawnEntity("minecraft:arrow", at);
  arrow.setDynamicProperty("wilds:scripted", true);
  const pr = arrow.getComponent("minecraft:projectile");
  pr.owner = archer;
  pr.shoot({ x: dir.x * SPEED, y: dir.y * SPEED, z: dir.z * SPEED }, { uncertainty: SPREAD });
  stats.scriptShots++;
}
system.runInterval(guard("pathB", () => {
  if (archerMode() !== "B") return;
  for (const beast of allBeasts()) {
    for (const r of rideable(beast).getRiders()) if (isCrewType(r)) fireFor(beast, r);
  }
}), INTERVAL);

/** Server test hook: seat an owner's ranged mercenaries on a beast with no player present. Returns the number seated. */
export function testSeat(beast, ownerId) {
  const rd = rideable(beast), crew = crewOf(beast);
  const cands = beast.dimension.getEntities({ families: ["ironhome_mercenary"], location: beast.location, maxDistance: BOARD_RANGE })
    .filter((m) => RANGED.has(m.typeId) && m.hasTag(`ih_merc:${ownerId}`) && !ridingOn(m));
  let n = 0;
  for (const m of cands) {
    if (rd.getRiders().length >= SEATS) break;
    if (rd.addRider(m)) { n++; crew.push(m.id); }
  }
  setCrew(beast, crew);
  return n;
}
export function setArcherMode(m) { jset(MODE, m === "B" ? "B" : "A"); }
export function seatReport() {
  const beasts = allBeasts();
  return beasts.map((b) => {
    const rs = rideable(b).getRiders().map((r) => (isPlayer(r) ? r.name : r.nameTag || r.typeId));
    return `Tuskbeast at ${Math.floor(b.location.x)} ${Math.floor(b.location.y)} ${Math.floor(b.location.z)}: seats [${rs.join(", ")}], crew record ${crewOf(b).length}`;
  });
}
