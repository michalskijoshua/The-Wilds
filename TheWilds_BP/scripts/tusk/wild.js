// Wild Tuskbeasts (0.0.7, Director 24 Nov 2026): solitary and rare. The overworld is cut into 750 x 750 squares. Each
// square holds at most ONE wild Tuskbeast. It appears the first time a player is in savanna inside that square, about
// 32-40 blocks away from them. When it is tamed or dies, the square is empty for 3 real days, then a new one can appear.
// Records and the spawner itself: core/spawner.js (shared with the Aetherseed and the Frost Lynx).
// Three kinds, by biome: Savanna (savanna), Badlands (badlands, Bedrock "mesa"), Tundra (snowy plains and ice
// spikes, Bedrock "ice_plains"). Any Tuskbeast that
// appears (also from a spawn egg) takes the kind of the biome it stands in; elsewhere it stays Savanna.
import { world, system, guard, jget, dbg } from "../core/util.js";
import { squareSpawner, squareTaken, biomeAt } from "../core/spawner.js";

export const SQUARE = 750, RETURN_MS = 3 * 24 * 3600 * 1000;
export const KIND_BIOMES = {
  savanna: ["savanna", "savanna_plateau", "savanna_mutated", "savanna_plateau_mutated"],          // Bedrock biome ids
  badlands: ["mesa", "mesa_bryce", "mesa_plateau", "mesa_plateau_mutated", "mesa_plateau_stone", "mesa_plateau_stone_mutated"],
  tundra: ["ice_plains", "ice_plains_spikes", "ice_mountains"],
};
const BIOMES = Object.values(KIND_BIOMES).flat();
export const kindOf = (biome) => Object.keys(KIND_BIOMES).find((k) => KIND_BIOMES[k].includes(biome));

// 0.0.19 (TW-05): the shared square spawner. Records from before 0.0.19 (wilds:tb:<cx>,<cz>) are read once and carried over.
export const tuskSpawner = squareSpawner({
  key: "tuskbeast", square: SQUARE, returnMs: RETURN_MS, fits: (b) => BIOMES.includes(b), minR: 32, maxR: 40,
  spawn: (dim, spot) => dim.spawnEntity("wilds:tuskbeast", spot),
  legacy: (cx, cz) => {
    const old = jget(`wilds:tb:${cx},${cz}`, null); if (!old) return undefined;
    if (old.s === "wild") return { v: 2, s: "live", sp: "tuskbeast", sq: `${cx},${cz}`, id: null, legacy: true, legacyTag: "wilds:tb_square", dim: "minecraft:overworld", x: old.x, y: old.y, z: old.z, t: Date.now() };
    return { v: 2, s: old.s, t: old.t };
  },
});
export const wildVisit = (p) => tuskSpawner.visit(p);
export const wildTaken = (beast) => squareTaken(beast);
export const wildInfo = (p) => p.sendMessage(tuskSpawner.info(p));
export const wildAge = (p, ms) => p.sendMessage(tuskSpawner.age(p, ms));

// every new Tuskbeast takes its biome's kind (look), once
world.afterEvents.entitySpawn.subscribe(guard("kind", (e) => {
  const b = e.entity; if (b?.typeId !== "wilds:tuskbeast") return;
  system.runTimeout(guard("kind2", () => {
    if (!b.isValid || b.getDynamicProperty("wilds:kind")) return;
    const k = kindOf(biomeAt(b.dimension, b.location)) ?? "savanna";
    b.triggerEvent(`wilds:kind_${k}`); b.setDynamicProperty("wilds:kind", k);
  }), 2);
}));
