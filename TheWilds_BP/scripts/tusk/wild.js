// Wild Tuskbeasts (0.0.7, Director 24 Nov 2026): solitary and rare. The overworld is cut into 750 x 750 squares. Each
// square holds at most ONE wild Tuskbeast. It appears the first time a player is in savanna inside that square, about
// 32-40 blocks away from them. When it is tamed or dies, the square is empty for 3 real days, then a new one can appear.
// One small world record per square: wilds:tb:<cx>,<cz> = { s: "pending" | "wild" | "gone", t: time gone, x, y, z }.
// The record is written before the spawn, so two players or a crash never make two.
// Three kinds, by biome: Savanna (savanna), Badlands (badlands, Bedrock "mesa"), Tundra (snowy plains and ice
// spikes, Bedrock "ice_plains"). Any Tuskbeast that
// appears (also from a spawn egg) takes the kind of the biome it stands in; elsewhere it stays Savanna.
import { world, system, guard, jget, jset, dbg } from "../core/util.js";

export const SQUARE = 750, RETURN_MS = 3 * 24 * 3600 * 1000;
export const KIND_BIOMES = {
  savanna: ["savanna", "savanna_plateau", "savanna_mutated", "savanna_plateau_mutated"],          // Bedrock biome ids
  badlands: ["mesa", "mesa_bryce", "mesa_plateau", "mesa_plateau_mutated", "mesa_plateau_stone", "mesa_plateau_stone_mutated"],
  tundra: ["ice_plains", "ice_plains_spikes", "ice_mountains"],
};
const BIOMES = Object.values(KIND_BIOMES).flat();
export const kindOf = (biome) => Object.keys(KIND_BIOMES).find((k) => KIND_BIOMES[k].includes(biome));
const key = (cx, cz) => `wilds:tb:${cx},${cz}`;
const squareOf = (x, z) => ({ cx: Math.floor(x / SQUARE), cz: Math.floor(z / SQUARE) });

const biomeAt = (dim, loc) => { try { return dim.getBiome(loc)?.id?.replace("minecraft:", ""); } catch { return undefined; } };
function groundAt(dim, x, z) {
  try { const b = dim.getTopmostBlock({ x, z }); if (!b || b.isLiquid || b.typeId.includes("leaves")) return undefined; return b.location.y + 1; } catch { return undefined; }
}

function spotNear(p, cx, cz) {
  const dim = p.dimension, a0 = Math.random() * Math.PI * 2;
  for (let i = 0; i < 8; i++) {
    const a = a0 + (i * Math.PI) / 4, r = 32 + Math.random() * 8;
    const x = Math.floor(p.location.x + Math.cos(a) * r), z = Math.floor(p.location.z + Math.sin(a) * r);
    const s = squareOf(x, z); if (s.cx !== cx || s.cz !== cz) continue;
    const y = groundAt(dim, x, z); if (y === undefined) continue;
    if (!BIOMES.includes(biomeAt(dim, { x, y, z }))) continue;
    return { x: x + 0.5, y, z: z + 0.5 };
  }
  return undefined;
}

/** One check for one visitor (a player, or a stand-in {dimension, location} in server tests). */
export function wildVisit(p) {
  if (p.dimension.id !== "minecraft:overworld") return;
  const { cx, cz } = squareOf(p.location.x, p.location.z);
  let rec = jget(key(cx, cz), { s: "pending" });
  if (rec.s === "gone" && Date.now() - (rec.t ?? 0) >= RETURN_MS) rec = { s: "pending" };
  if (rec.s !== "pending") return;
  if (!BIOMES.includes(biomeAt(p.dimension, p.location))) return;
  const spot = spotNear(p, cx, cz); if (!spot) return;
  jset(key(cx, cz), { s: "wild", x: Math.floor(spot.x), y: spot.y, z: Math.floor(spot.z) });   // record first, then spawn
  try {
    const b = p.dimension.spawnEntity("wilds:tuskbeast", spot);
    b.setDynamicProperty("wilds:tb_square", `${cx},${cz}`);
    dbg(`a wild Tuskbeast appeared in square ${cx},${cz} at ${Math.floor(spot.x)} ${spot.y} ${Math.floor(spot.z)}`);
  } catch (err) { jset(key(cx, cz), { s: "pending" }); dbg(`wild spawn failed, will retry: ${err}`); }
}

/** Its square is empty again (tamed or dead): a new wild one may appear there after 3 real days. */
export function wildTaken(beast) {
  let sq; try { sq = beast.getDynamicProperty("wilds:tb_square"); } catch { return; }
  if (!sq) return;
  jset(`wilds:tb:${sq}`, { s: "gone", t: Date.now() });
  try { beast.setDynamicProperty("wilds:tb_square", undefined); } catch { /* */ }
  dbg(`square ${sq}: its wild Tuskbeast is gone; another may come in 3 days`);
}

// every new Tuskbeast takes its biome's kind (look), once
world.afterEvents.entitySpawn.subscribe(guard("kind", (e) => {
  const b = e.entity; if (b?.typeId !== "wilds:tuskbeast") return;
  system.runTimeout(guard("kind2", () => {
    if (!b.isValid || b.getDynamicProperty("wilds:kind")) return;
    const k = kindOf(biomeAt(b.dimension, b.location)) ?? "savanna";
    b.triggerEvent(`wilds:kind_${k}`); b.setDynamicProperty("wilds:kind", k);
  }), 2);
}));
world.afterEvents.entityDie.subscribe(guard("wild.die", (e) => wildTaken(e.deadEntity)), { entityTypes: ["wilds:tuskbeast"] });
system.runInterval(guard("wild", () => { for (const p of world.getAllPlayers()) wildVisit(p); }), 100);

export function wildInfo(p) {
  const { cx, cz } = squareOf(p.location.x, p.location.z), rec = jget(key(cx, cz), null);
  p.sendMessage(`square ${cx},${cz} biome ${biomeAt(p.dimension, p.location)}: ${rec ? JSON.stringify(rec) : "no record"}`);
}
/** Test hook: pretend the square's beast left this long ago (ms). */
export function wildAge(p, ms) {
  const { cx, cz } = squareOf(p.location.x, p.location.z), rec = jget(key(cx, cz), null);
  if (rec?.s === "gone") { rec.t = Date.now() - ms; jset(key(cx, cz), rec); }
  wildInfo(p);
}
