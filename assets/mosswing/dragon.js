// IronHome: the Mosswing Dragon flies under its rider (approved 20 Nov 2026; v0.6.7 smoother flight, firmer saddle).
// Steering: look where you want to go. Forward = fly that way (look up to climb, down to dive); jump = climb;
// no input in the air = hover; on the ground he walks. Crouch to dismount. No fall damage.
// Smoothness: gravity is off while he is ridden, and his speed eases toward the target (no jumps from 0 to full).
import { world, system, InputButton, ButtonState, EntityComponentTypes } from "@minecraft/server";

const ID = "ironhome:mosswing";
const FLY = 0.75, CLIMB = 0.38, WALK = 0.24, EASE = 0.18;     // blocks/tick; EASE = share of the gap closed each tick

function input(p) {
  let r;
  try {
    const mv = p.inputInfo.getMovementVector();
    r = { fwd: mv.y, up: p.inputInfo.getButtonState(InputButton.Jump) === ButtonState.Pressed };
  } catch { r = { fwd: 1, up: p.isJumping }; }
  if (r.up) lastUp.set(p.id, system.currentTick);
  return r;
}

function steer(d, p) {
  const { fwd, up } = input(p);
  const v = p.getViewDirection(), yaw = p.getRotation().y;
  const h = Math.hypot(v.x, v.z) || 1, fx = v.x / h, fz = v.z / h;
  try {                                                        // turn smoothly toward the rider's view (no snapping)
    const cur = d.getRotation().y; let dy = ((yaw - cur + 540) % 360) - 180;
    d.setRotation({ x: 0, y: cur + dy * 0.25 });
  } catch { /* */ }
  const ground = d.isOnGround, f = Math.max(0, fwd);
  let tx, ty, tz;
  if (ground && !up) { tx = fx * WALK * f; tz = fz * WALK * f; ty = -0.1; }          // walk, stay planted
  else {
    tx = v.x * FLY * f; tz = v.z * FLY * f; ty = v.y * FLY * f;
    if (up) ty = Math.max(ty, CLIMB);
    if (ground && ty < 0) ty = 0;
  }
  const c = d.getVelocity();
  const nx = c.x + (tx - c.x) * EASE, ny = c.y + (ty - c.y) * EASE, nz = c.z + (tz - c.z) * EASE;
  d.clearVelocity();
  d.applyImpulse({ x: nx, y: ny, z: nz });
}

// Keep the rider in the saddle while airborne: if the game drops a rider who didn't crouch, put them back (retrying
// for up to a second, moving them onto the saddle first). On the ground any dismount stands.
const lastUp = new Map();                                      // player id -> tick of the last rise press
const OWNER = "ironhome:owner";
const seated = new Map(), reseat = new Map();                  // player id -> dragon; player id -> { d, until }
const ridden = new Set();                                      // dragons currently with gravity off
system.runInterval(() => {
  const now = system.currentTick, live = new Set();
  for (const p of world.getAllPlayers()) {
    let d;
    try { d = p.getComponent("minecraft:riding")?.entityRidingOn; } catch { continue; }
    if (d?.typeId === ID && d.isValid) {
      seated.set(p.id, d); reseat.delete(p.id); live.add(d.id);
      if (!d.getDynamicProperty(OWNER)) { d.setDynamicProperty(OWNER, p.id); p.setDynamicProperty("ironhome:dragon", d.id);
        p.sendMessage("§aThe Mosswing accepts you as his rider. A Dragon Horn will call him to you."); }
      if (d.getDynamicProperty(OWNER) === p.id) { const l = d.location; p.setDynamicProperty("ironhome:dragon_at", `${Math.round(l.x)} ${Math.round(l.y)} ${Math.round(l.z)} ${d.dimension.id.replace("minecraft:", "")}`); }
      if (!ridden.has(d.id)) { try { d.triggerEvent("ironhome:ride_on"); ridden.add(d.id); } catch { /* */ } }
      try { steer(d, p); } catch { /* */ }
      continue;
    }
    const was = seated.get(p.id);
    if (was) {
      seated.delete(p.id);
      try {
        if (was.isValid && !was.isOnGround) {
          // thrown off by the game right after a rise press: back in the saddle. Any other dismount is the rider's own:
          // they float down safely.
          if (!p.isSneaking && now - (lastUp.get(p.id) ?? -99) <= 6) reseat.set(p.id, { d: was, until: now + 20 });
          else p.addEffect("slow_falling", 200, { showParticles: false });
        }
      } catch { /* */ }
    }
    const r = reseat.get(p.id);
    if (!r) continue;
    if (now > r.until || !r.d.isValid || p.isSneaking) { reseat.delete(p.id); continue; }
    live.add(r.d.id);
    try {
      const l = r.d.location;
      p.teleport({ x: l.x, y: l.y + 2.4, z: l.z }, { dimension: r.d.dimension, keepVelocity: false });
      r.d.getComponent("minecraft:rideable")?.addRider(p);
    } catch { /* */ }
  }
  for (const id of [...ridden]) {                              // nobody aboard any more: gravity back on
    if (live.has(id)) continue;
    ridden.delete(id);
    try { world.getEntity(id)?.triggerEvent("ironhome:ride_off"); } catch { /* */ }
  }
}, 1);

// ---- the Dragon Horn: calls your Mosswing to your side (if he is in a loaded area of this dimension)
world.afterEvents.itemUse.subscribe((e) => {
  if (e.itemStack?.typeId !== "ironhome:dragon_horn") return;
  const p = e.source, id = p.getDynamicProperty("ironhome:dragon");
  const d = id ? world.getEntity(id) : undefined;
  if (!id) return p.sendMessage("§eYou have no dragon yet. Ride a Mosswing first and he becomes yours.");
  if (!d?.isValid) {
    const at = p.getDynamicProperty("ironhome:dragon_at");
    return p.sendMessage(`§eYour dragon is too far away to hear the horn.${at ? ` You last rode him near ${at}.` : ""}`);
  }
  if (d.dimension.id !== p.dimension.id) return p.sendMessage("§eYour dragon is in another dimension.");
  const v = p.getViewDirection(), l = p.location;
  try { d.teleport({ x: l.x - v.x * 4, y: l.y + 1, z: l.z - v.z * 4 }, { keepVelocity: false }); } catch { d.teleport({ x: l.x, y: l.y + 1, z: l.z }); }
  p.dimension.playSound("mob.enderdragon.flap", l, { volume: 0.8 });
  p.sendMessage("§aYour Mosswing answers the horn.");
});
