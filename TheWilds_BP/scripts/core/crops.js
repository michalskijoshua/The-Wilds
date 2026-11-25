// The crop registry (TW-25, 0.0.20): every crop an Aetherseed may grow (Original) or shrink (Withered), in one place.
// Each entry: block id -> { state (its growth state), min, max, soil (blocks it must stand on), grow? (custom handling) }.
// Guilds+ crops: read from the Guilds+ 0.9.18 build (blocks/hearthfarm/crops/*.json): 21 crops named
// guilds_farming:crop_<name>, growth state guilds_farming:age 0..3, placed on farmland. If Guilds+ is not installed these
// blocks never exist in the world, so the entries simply never match.
const FARMLAND = ["minecraft:farmland"];
const vanilla = (name, max = 7) => [`minecraft:${name}`, { state: "growth", min: 0, max, soil: FARMLAND }];
const GUILDS_CROPS = ["barley", "bell_pepper", "blueberry", "cabbage", "chili_pepper", "corn", "cucumber", "garlic", "green_beans", "lettuce",
  "mint", "oats", "onion", "peanut", "peas", "radish", "raspberry", "rice", "strawberry", "tomato", "turnip"];
export const CROPS = new Map([
  vanilla("wheat"), vanilla("carrots"), vanilla("potatoes"), vanilla("beetroot"), vanilla("melon_stem"), vanilla("pumpkin_stem"),
  ...GUILDS_CROPS.map((n) => [`guilds_farming:crop_${n}`, { state: "guilds_farming:age", min: 0, max: 3, soil: FARMLAND, from: "Guilds+" }]),
]);
/** The crop's stage, or undefined if this block is not a registered crop (or its state can't be read). */
export function stageOf(b) {
  const c = CROPS.get(b?.typeId); if (!c) return undefined;
  try { return b.permutation.getState(c.state); } catch { return undefined; }
}
/** Moves a crop by `step` stages (within its range). Returns true if it changed. */
export function growBy(b, step) {
  const c = CROPS.get(b.typeId), g = stageOf(b); if (!c || g === undefined) return false;
  if (c.grow) return c.grow(b, step);
  const to = Math.max(c.min, Math.min(c.max, g + step)); if (to === g) return false;
  b.setPermutation(b.permutation.withState(c.state, to)); return true;
}
/** Can this crop move `step` stages from where it is, standing on what it stands on? */
export function canGrow(b, under, step) {
  const c = CROPS.get(b?.typeId), g = stageOf(b); if (!c || g === undefined) return false;
  if (c.soil && !c.soil.includes(under?.typeId)) return false;
  return step > 0 ? g < c.max : g > c.min;
}
