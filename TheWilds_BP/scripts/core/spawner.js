// A reusable "one per square" wild spawner (0.0.12; records and reconciliation 0.0.19, TW-05/TW-49).
// The overworld is cut into squares; each square holds at most one of a kind. It appears the first time a player is in
// a fitting spot inside the square, a little way from them. When it dies, is caged or tamed, the square is empty for a
// while, then a new one may come.
//
// One world record per square and kind: wilds:sq:<key>:<cx>,<cz>
//   { v: 2, s, sp, sq, id, dim, x, y, z, t, seen, lx, ly, lz, miss, legacy }
//   s: "pending" (may appear) | "live" | "gone" | "none" (this square never has one: the chance said no)
//   id: the creature's entity id; x/y/z: where it appeared; t: when reserved (live) or when it left (gone);
//   seen / lx ly lz: when and where it was last confirmed; miss: checks in a row it was missing.
// Rules:
//   - The record is written before the spawn; a spawn that fails puts the square back to pending (and a reservation
//     with no creature id after 60 s is treated as a failed spawn).
//   - An unloaded creature is never "dead". It only counts as lost after 3 checks in a row (30 s apart) in which the
//     spot where it was last seen is loaded, a player is within 48 blocks of that spot, and the creature is nowhere.
//     Lost = gone (a new one may come after the return time). Death, cage and taming are recorded straight away.
//   - Records are only written when something changes (TW-49), and only squares near players are checked.
import { world, system, guard, jget, jset, dbg } from "./util.js";

export const biomeAt = (dim, loc) => { try { return dim.getBiome(loc)?.id?.replace("minecraft:", ""); } catch { return undefined; } };
export function groundAt(dim, x, z) {
  try { const b = dim.getTopmostBlock({ x, z }); if (!b || b.isLiquid || b.typeId.includes("leaves")) return undefined; return b.location.y + 1; } catch { return undefined; }
}
const spawners = new Map();                              // key -> spawner
export const spawnerStats = { writes: 0, lost: 0, failed: 0, adopted: 0 };
const save = (k, rec) => { jset(k, rec); spawnerStats.writes++; };
const CHECK_TICKS = 600, LOST_AFTER = 3, FAILED_MS = 60000, WATCH_R = 48;

/**
 * cfg: { key, square, returnMs, chance (0..1, per square), fits(biome, dim, spot) -> bool,
 *        spawn(dim, spot, biome) -> entity, minR = 24, maxR = 36, legacy?(cx, cz) -> older record or undefined }
 */
export function squareSpawner(cfg) {
  const { key, square, returnMs, chance = 1, fits, spawn, minR = 24, maxR = 36, legacy } = cfg;
  const rk = (cx, cz) => `wilds:sq:${key}:${cx},${cz}`;
  const squareOf = (x, z) => ({ cx: Math.floor(x / square), cz: Math.floor(z / square) });
  function read(cx, cz) {
    let rec = jget(rk(cx, cz), null);
    if (!rec && legacy) { const old = legacy(cx, cz); if (old) { rec = old; save(rk(cx, cz), rec); } }   // older worlds
    return rec;
  }

  function spotNear(p, cx, cz) {
    const dim = p.dimension, a0 = Math.random() * Math.PI * 2;
    for (let i = 0; i < 8; i++) {
      const a = a0 + (i * Math.PI) / 4, r = minR + Math.random() * (maxR - minR);
      const x = Math.floor(p.location.x + Math.cos(a) * r), z = Math.floor(p.location.z + Math.sin(a) * r);
      const s = squareOf(x, z); if (s.cx !== cx || s.cz !== cz) continue;
      const y = groundAt(dim, x, z); if (y === undefined) continue;
      const spot = { x: x + 0.5, y, z: z + 0.5 }, biome = biomeAt(dim, spot);
      if (biome && fits(biome, dim, spot)) return { spot, biome };
    }
    return undefined;
  }
  const api = {
    key, square,
    visit(p) {
      if (p.dimension.id !== "minecraft:overworld") return;
      const { cx, cz } = squareOf(p.location.x, p.location.z);
      let rec = read(cx, cz), changed = false;
      if (!rec) { rec = { v: 2, s: Math.random() < chance ? "pending" : "none" }; changed = true; }
      if (rec.s === "gone" && Date.now() - (rec.t ?? 0) >= returnMs) { rec = { v: 2, s: "pending" }; changed = true; }
      if (changed) save(rk(cx, cz), rec);
      if (rec.s !== "pending") return;
      const here = biomeAt(p.dimension, p.location); if (!here || !fits(here, p.dimension, p.location)) return;
      const found = spotNear(p, cx, cz); if (!found) return;
      const now = Date.now(), { spot } = found;
      const live = { v: 2, s: "live", sp: key, sq: `${cx},${cz}`, id: null, dim: p.dimension.id, x: Math.floor(spot.x), y: spot.y, z: Math.floor(spot.z), t: now, seen: now, lx: spot.x, ly: spot.y, lz: spot.z, miss: 0 };
      save(rk(cx, cz), live);                                                     // reserve first, then spawn
      try {
        const e = spawn(p.dimension, spot, found.biome);
        e.setDynamicProperty("wilds:sq", `${key}|${cx},${cz}`);
        live.id = e.id; save(rk(cx, cz), live);
        dbg(`${key}: appeared in square ${cx},${cz} at ${live.x} ${live.y} ${live.z} (${found.biome})`);
      } catch (err) { save(rk(cx, cz), { v: 2, s: "pending" }); spawnerStats.failed++; dbg(`${key}: spawn failed, will retry: ${err}`); }
    },
    /** Checks the live records of the squares around a player (TW-05). */
    reconcile(p) {
      if (p.dimension.id !== "minecraft:overworld") return;
      const c = squareOf(p.location.x, p.location.z), now = Date.now();
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
        const cx = c.cx + dx, cz = c.cz + dz, rec = read(cx, cz);
        if (rec?.s !== "live") continue;
        const k = rk(cx, cz);
        if (!rec.id && rec.legacy) {                                              // older record: find its creature by its tag
          const e = p.dimension.getEntities({ location: { x: rec.lx ?? rec.x, y: rec.ly ?? rec.y ?? 64, z: rec.lz ?? rec.z }, maxDistance: 96 })
            .find((x) => x.getDynamicProperty("wilds:sq") === `${key}|${cx},${cz}` || (rec.legacyTag && x.getDynamicProperty(rec.legacyTag) === `${cx},${cz}`));
          if (e) { rec.id = e.id; rec.seen = now; e.setDynamicProperty("wilds:sq", `${key}|${cx},${cz}`); save(k, rec); spawnerStats.adopted++; }
          continue;
        }
        if (!rec.id) { if (now - (rec.t ?? 0) > FAILED_MS) { save(k, { v: 2, s: "pending" }); spawnerStats.failed++; } continue; }
        const e = world.getEntity(rec.id);
        if (e?.isValid) {
          const l = e.location, moved = Math.hypot(l.x - (rec.lx ?? l.x), l.z - (rec.lz ?? l.z));
          if (rec.miss || moved > 16 || now - (rec.seen ?? 0) > 300000) { Object.assign(rec, { seen: now, lx: l.x, ly: l.y, lz: l.z, miss: 0, dim: e.dimension.id }); save(k, rec); }
          continue;
        }
        // not found: only count it when its last spot is loaded and watched by a player
        const dim = world.getDimension(rec.dim ?? "minecraft:overworld"), last = { x: rec.lx ?? rec.x, y: rec.ly ?? rec.y, z: rec.lz ?? rec.z };
        let loaded = false; try { loaded = !!dim.getBlock(last); } catch { /* */ }
        const watched = [p, ...world.getAllPlayers()].some((q) => q.dimension.id === dim.id && Math.hypot(q.location.x - last.x, q.location.z - last.z) <= WATCH_R);
        if (!loaded || !watched) continue;
        rec.miss = (rec.miss ?? 0) + 1;
        if (rec.miss >= LOST_AFTER) { save(k, { v: 2, s: "gone", t: now, lost: true }); spawnerStats.lost++; dbg(`${key}: square ${cx},${cz}: its creature is lost`); }
        else save(k, rec);
      }
    },
    info(p) { const { cx, cz } = squareOf(p.location.x, p.location.z); return `${key} square ${cx},${cz} (${biomeAt(p.dimension, p.location)}): ${JSON.stringify(read(cx, cz))}`; },
    age(p, ms) { const { cx, cz } = squareOf(p.location.x, p.location.z), rec = read(cx, cz); if (rec?.s === "gone") { rec.t = Date.now() - ms; save(rk(cx, cz), rec); } return api.info(p); },
  };
  spawners.set(key, api);
  return api;
}

/** Its square is empty again (it died, was caged or tamed): a new one may come after that kind's return time. */
export function squareTaken(entity) {
  let tag, old; try { tag = entity.getDynamicProperty("wilds:sq"); old = entity.getDynamicProperty("wilds:tb_square"); } catch { return; }
  if (!tag && old) tag = `tuskbeast|${old}`;                                     // Tuskbeasts from before 0.0.19
  if (!tag) return;
  const [key, sq] = tag.split("|");
  save(`wilds:sq:${key}:${sq}`, { v: 2, s: "gone", t: Date.now() });
  try { entity.setDynamicProperty("wilds:sq", undefined); entity.setDynamicProperty("wilds:tb_square", undefined); } catch { /* */ }
  dbg(`${key}: square ${sq} is empty now`);
}
world.afterEvents.entityDie.subscribe(guard("sq.die", (e) => squareTaken(e.deadEntity)), { entityTypes: ["wilds:tuskbeast", "wilds:aetherseed", "wilds:frost_lynx"] });   // TW-52: only our square creatures
system.runInterval(guard("squares", () => {
  const players = world.getAllPlayers();
  for (const s of spawners.values()) for (const p of players) { try { s.visit(p); } catch (err) { console.warn(`[wilds] ${s.key} visit: ${err}`); } }
}), 100);
system.runInterval(guard("squares.check", () => {
  const players = world.getAllPlayers();
  for (const s of spawners.values()) for (const p of players) { try { s.reconcile(p); } catch (err) { console.warn(`[wilds] ${s.key} check: ${err}`); } }
}), CHECK_TICKS);
export const allSpawners = () => [...spawners.values()];
