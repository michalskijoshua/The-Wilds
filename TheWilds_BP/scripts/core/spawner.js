// A reusable "one per square" wild spawner (0.0.12), the same idea as the Tuskbeast's (tusk/wild.js):
// the overworld is cut into squares; each square holds at most one of a kind. It appears the first time a player is in
// a fitting spot inside the square, a little way from them. When it dies (or is caged) the square is empty for a while,
// then a new one may come. One small world record per square: wilds:sq:<key>:<cx>,<cz> = { s, t }.
//   s: "pending" (may appear) | "live" | "gone" (t = when) | "none" (this square never has one: the chance said no)
// The record is written before the spawn, so two players or a crash never make two.
import { world, system, guard, jget, jset, dbg } from "./util.js";

export const biomeAt = (dim, loc) => { try { return dim.getBiome(loc)?.id?.replace("minecraft:", ""); } catch { return undefined; } };
export function groundAt(dim, x, z) {
  try { const b = dim.getTopmostBlock({ x, z }); if (!b || b.isLiquid || b.typeId.includes("leaves")) return undefined; return b.location.y + 1; } catch { return undefined; }
}
const spawners = new Map();                              // key -> spawner

/**
 * cfg: { key, square, returnMs, chance (0..1, per square), fits(biome, dim, spot) -> bool,
 *        spawn(dim, spot, biome) -> entity, minR = 24, maxR = 36 }
 */
export function squareSpawner(cfg) {
  const { key, square, returnMs, chance = 1, fits, spawn, minR = 24, maxR = 36 } = cfg;
  const rk = (cx, cz) => `wilds:sq:${key}:${cx},${cz}`;
  const squareOf = (x, z) => ({ cx: Math.floor(x / square), cz: Math.floor(z / square) });

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
    key,
    visit(p) {
      if (p.dimension.id !== "minecraft:overworld") return;
      const { cx, cz } = squareOf(p.location.x, p.location.z);
      let rec = jget(rk(cx, cz), null);
      if (!rec) rec = { s: Math.random() < chance ? "pending" : "none" };
      if (rec.s === "gone" && Date.now() - (rec.t ?? 0) >= returnMs) rec = { s: "pending" };
      jset(rk(cx, cz), rec);
      if (rec.s !== "pending") return;
      const here = biomeAt(p.dimension, p.location); if (!here || !fits(here, p.dimension, p.location)) return;
      const found = spotNear(p, cx, cz); if (!found) return;
      jset(rk(cx, cz), { s: "live" });                                            // record first, then spawn
      try {
        const e = spawn(p.dimension, found.spot, found.biome);
        e.setDynamicProperty("wilds:sq", `${key}|${cx},${cz}`);
        dbg(`${key}: appeared in square ${cx},${cz} at ${Math.floor(found.spot.x)} ${found.spot.y} ${Math.floor(found.spot.z)} (${found.biome})`);
      } catch (err) { jset(rk(cx, cz), { s: "pending" }); dbg(`${key}: spawn failed, will retry: ${err}`); }
    },
    info(p) { const { cx, cz } = squareOf(p.location.x, p.location.z); return `${key} square ${cx},${cz} (${biomeAt(p.dimension, p.location)}): ${JSON.stringify(jget(rk(cx, cz), null))}`; },
    age(p, ms) { const { cx, cz } = squareOf(p.location.x, p.location.z), rec = jget(rk(cx, cz), null); if (rec?.s === "gone") { rec.t = Date.now() - ms; jset(rk(cx, cz), rec); } return api.info(p); },
  };
  spawners.set(key, api);
  return api;
}

/** Its square is empty again (it died or was caged): a new one may come after that kind's return time. */
export function squareTaken(entity) {
  let tag; try { tag = entity.getDynamicProperty("wilds:sq"); } catch { return; }
  if (!tag) return;
  const [key, sq] = tag.split("|");
  jset(`wilds:sq:${key}:${sq}`, { s: "gone", t: Date.now() });
  try { entity.setDynamicProperty("wilds:sq", undefined); } catch { /* */ }
  dbg(`${key}: square ${sq} is empty now`);
}
world.afterEvents.entityDie.subscribe(guard("sq.die", (e) => squareTaken(e.deadEntity)));
system.runInterval(guard("squares", () => {
  const players = world.getAllPlayers();
  for (const s of spawners.values()) for (const p of players) s.visit(p);
}), 100);
