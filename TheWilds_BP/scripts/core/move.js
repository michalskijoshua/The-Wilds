// Collision-safe gliding for floating creatures (TW-20, 0.0.20). One small step toward a target, only if no solid
// block (walls, closed doors, ceilings, fences) is in the way; if the way ahead is blocked it tries to rise a little
// (to float over a fence or a step, at most 2 blocks above where it is heading, so it never climbs a wall);
// otherwise it waits (its own wandering can take it through an opening). Never moves into a block.
const ray = (dim, from, to) => {
  const d = { x: to.x - from.x, y: to.y - from.y, z: to.z - from.z }, len = Math.hypot(d.x, d.y, d.z);
  if (len < 1e-3) return false;
  try { return !!dim.getBlockFromRay(from, { x: d.x / len, y: d.y / len, z: d.z / len }, { maxDistance: len + 0.3, includeLiquidBlocks: false, includePassableBlocks: false }); } catch { return true; }
};
const freeAt = (dim, l) => { try { const b = dim.getBlock({ x: Math.floor(l.x), y: Math.floor(l.y), z: Math.floor(l.z) }); return !!b && (b.isAir || /light_block|short_grass|tall_grass|fern|flower|tulip|poppy|dandelion|snow_layer/.test(b.typeId)); } catch { return false; } };
export const moveStats = { moved: 0, rose: 0, blocked: 0 };

/** One step (at most `step` blocks) toward `target`. Returns "moved" | "rose" | "blocked" | "there". */
export function glideToward(e, target, step = 0.4, stopAt = 0) {
  const dim = e.dimension, l = e.location;
  const d = { x: target.x - l.x, y: target.y - l.y, z: target.z - l.z }, len = Math.hypot(d.x, d.y, d.z);
  if (len <= stopAt + 0.05) return "there";
  const k = Math.min(step, len - stopAt) / len, next = { x: l.x + d.x * k, y: l.y + d.y * k, z: l.z + d.z * k };
  const eye = { x: l.x, y: l.y + 0.3, z: l.z }, eyeNext = { x: next.x, y: next.y + 0.3, z: next.z };
  if (!ray(dim, eye, eyeNext) && freeAt(dim, next) && freeAt(dim, eyeNext)) {
    e.teleport(next, { facingLocation: target }); moveStats.moved++; return "moved";
  }
  const up = { x: l.x, y: l.y + step, z: l.z };                                  // over a fence or a step, never up a wall:
  if (up.y <= target.y + 2 && !ray(dim, eye, { x: up.x, y: up.y + 0.3, z: up.z }) && freeAt(dim, up) && freeAt(dim, { ...up, y: up.y + 0.3 })) {
    e.teleport(up, { facingLocation: target }); moveStats.rose++; return "rose";
  }
  moveStats.blocked++; return "blocked";
}
