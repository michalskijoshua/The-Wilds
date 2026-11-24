// P0-5 Landmark placement and Oni persistence.
// The overworld is cut into fixed 1,500 x 1,500 cells. A hash of the cell coordinates (no world seed: scripts cannot read
// it) decides which landmark kinds the cell holds and an anchor point for each. The first time a player stands in the
// cell, its plan is written to world data (one small property per cell: wilds:lm:<cx>,<cz>). A kind is placed the first
// time a player is in a fitting biome inside that cell: at the anchor if the anchor is loaded and fits, otherwise at a
// fitting spot near the player on the side toward the anchor. The record is written BEFORE the spawn, so a crash,
// a second player or a Realm restart can never place it twice. A felled landmark returns after 3 real days (Director
// 24 Nov 2026). Tuskbeasts are no longer landmarks: they are solitary, one per square (tusk/wild.js).
// Placeholders: the landmark is a coloured marker block with a floating name. No creature models in Phase 0.
import { world, system, guard, jget, jset, dbg, dist2d } from "../core/util.js";

export const CELL = 1500;
export const RETURN_FELLED = true, RETURN_MS = 3 * 24 * 3600 * 1000;   // felled wonders return after 3 real days
export const KINDS = [
  // chance = share of cells that hold this kind (proposal, except Oni: cherry groves only, approved)
  { key: "oni", name: "Oni Cairn", chance: 1.0, biomes: ["cherry_grove"] },
  { key: "colossus", name: "Meadow Colossus", chance: 0.5, biomes: ["meadow", "plains", "sunflower_plains", "flower_forest"] },
  { key: "serpent", name: "Serpentwreath", chance: 0.15, biomes: ["jagged_peaks", "frozen_peaks", "stony_peaks", "snowy_slopes"] },
  { key: "storm", name: "Stormmantle", chance: 0.35, biomes: ["windswept_hills", "windswept_gravelly_hills", "windswept_forest", "stony_peaks"] },
];
const MARKER = "wilds:landmark_marker";

/** Deterministic 0..1 from integers (32-bit mix). Same cell, same answer, on every device and every restart. */
export function hash01(a, b, salt) {
  let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(salt | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b); h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
export const cellOf = (x, z) => ({ cx: Math.floor(x / CELL), cz: Math.floor(z / CELL) });
const recKey = (cx, cz) => `wilds:lm:${cx},${cz}`;

export function plan(cx, cz) {
  const kinds = {};
  KINDS.forEach((k, i) => {
    const present = hash01(cx, cz, 100 + i) < k.chance;
    const ax = cx * CELL + 100 + Math.floor(hash01(cx, cz, 200 + i) * (CELL - 200));
    const az = cz * CELL + 100 + Math.floor(hash01(cx, cz, 300 + i) * (CELL - 200));
    kinds[k.key] = present ? { state: "pending", ax, az } : { state: "absent" };
  });
  return { v: 1, kinds };
}

function biomeAt(dim, loc) {
  try { const b = dim.getBiome(loc); return b?.id?.replace("minecraft:", ""); } catch { return undefined; }
}
function groundAt(dim, x, z) {
  try { const b = dim.getTopmostBlock({ x, z }); if (!b || b.isLiquid) return undefined; return b.location.y + 1; } catch { return undefined; }
}
function fits(dim, kind, x, z, y) { const id = biomeAt(dim, { x, y: y ?? 64, z }); return id !== undefined && kind.biomes.includes(id); }

function chooseSpot(p, kind, entry, cx, cz) {
  const dim = p.dimension, px = Math.floor(p.location.x), pz = Math.floor(p.location.z), py = Math.floor(p.location.y);
  if (dist2d({ x: entry.ax, z: entry.az }, p.location) < 64) {                     // anchor loaded: use it if it fits
    const y = groundAt(dim, entry.ax, entry.az);
    if (y !== undefined && fits(dim, kind, entry.ax, entry.az, y)) return { x: entry.ax, y, z: entry.az };
  }
  if (!fits(dim, kind, px, pz, py)) return undefined;                               // player not in a fitting biome
  const d = Math.hypot(entry.ax - px, entry.az - pz) || 1;
  for (const r of [32, 24, 16]) {
    const x = Math.floor(px + ((entry.ax - px) / d) * r), z = Math.floor(pz + ((entry.az - pz) / d) * r);
    const c = cellOf(x, z); if (c.cx !== cx || c.cz !== cz) continue;
    const y = groundAt(dim, x, z);
    if (y !== undefined && fits(dim, kind, x, z, y)) return { x, y, z };
  }
  return undefined;
}

const busy = new Set();
function place(p, cx, cz, rec, kind, i) {
  const entry = rec.kinds[kind.key];
  const spot = chooseSpot(p, kind, entry, cx, cz); if (!spot) return;
  const key = `${cx},${cz}:${kind.key}`; if (busy.has(key)) return; busy.add(key);
  entry.state = "placed"; entry.x = spot.x; entry.y = spot.y; entry.z = spot.z; entry.t = Date.now();
  jset(recKey(cx, cz), rec);                                                          // record first, then spawn
  try {
    const m = p.dimension.spawnEntity(MARKER, spot);
    m.setProperty("wilds:kind", i);
    m.setDynamicProperty("wilds:lm_key", key);
    m.nameTag = `${kind.name} (placeholder)`;
    dbg(`placed ${kind.name} in cell ${cx},${cz} at ${spot.x} ${spot.y} ${spot.z}`);
  } catch (err) {
    entry.state = "pending"; jset(recKey(cx, cz), rec); dbg(`spawn failed, will retry: ${err}`);
  } finally { busy.delete(key); }
}

system.runInterval(guard("landmarks", () => { for (const p of world.getAllPlayers()) visit(p); }), 100);

/** One check for one visitor (a player, or a stand-in {dimension, location} in server tests). */
export function visit(p) {
  {
    if (p.dimension.id !== "minecraft:overworld") return;
    const { cx, cz } = cellOf(p.location.x, p.location.z);
    let rec = jget(recKey(cx, cz), null);
    if (!rec) { rec = plan(cx, cz); jset(recKey(cx, cz), rec); dbg(`cell ${cx},${cz} planned: ${Object.entries(rec.kinds).filter(([, v]) => v.state === "pending").map(([k]) => k).join(", ") || "nothing"}`); }
    KINDS.forEach((k, i) => {
      const e = rec.kinds[k.key];
      if (!e) return;
      if (RETURN_FELLED && e.state === "felled" && Date.now() - (e.ft ?? 0) >= RETURN_MS) e.state = "pending";
      if (e.state === "pending") place(p, cx, cz, rec, k, i);
    });
  }
}

world.afterEvents.entityDie.subscribe(guard("lm.die", (e) => {
  const key = e.deadEntity.getDynamicProperty("wilds:lm_key"); if (!key) return;
  const [cell, kind] = key.split(":"); const [cx, cz] = cell.split(",").map(Number);
  const rec = jget(recKey(cx, cz), null); if (!rec?.kinds[kind]) return;
  rec.kinds[kind].state = "felled"; rec.kinds[kind].ft = Date.now(); jset(recKey(cx, cz), rec);
  dbg(`${kind} in cell ${cell} felled; it will ${RETURN_FELLED ? "return in 3 days" : "not return"}`);
}), { entityTypes: [MARKER] });

export function landmarkInfo(player) {
  const { cx, cz } = cellOf(player.location.x, player.location.z);
  const rec = jget(recKey(cx, cz), null), biome = biomeAt(player.dimension, player.location);
  const lines = [`§bCell ${cx},${cz} (x ${cx * CELL}..${cx * CELL + CELL - 1}, z ${cz * CELL}..${cz * CELL + CELL - 1}). Biome here: ${biome ?? "§cunreadable§b"}`];
  if (!rec) lines.push("No record yet (walk a moment).");
  else for (const k of KINDS) {
    const e = rec.kinds[k.key];
    lines.push(`${k.name}: ${e.state}${e.state === "placed" || e.state === "felled" ? ` at ${e.x} ${e.y} ${e.z}` : e.state === "pending" ? ` (anchor ${e.ax} ${e.az})` : ""}`);
  }
  player.sendMessage(lines.join("\n"));
}

/** Count markers per kind among loaded entities and the records, to spot duplicates. */
export function landmarkAudit(player) {
  const seen = {};
  for (const m of player.dimension.getEntities({ type: MARKER })) { const k = m.getDynamicProperty("wilds:lm_key"); seen[k] = (seen[k] ?? 0) + 1; }
  const dups = Object.entries(seen).filter(([, n]) => n > 1);
  const cells = world.getDynamicPropertyIds().filter((id) => id.startsWith("wilds:lm:")).length;
  player.sendMessage(`§bRecorded cells: ${cells}. Loaded markers: ${Object.keys(seen).length}. Duplicates: ${dups.length ? dups.map(([k, n]) => `${k} x${n}`).join(", ") : "none"}.`);
}
