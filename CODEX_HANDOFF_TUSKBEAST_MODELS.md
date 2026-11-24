# Codex handoff: Tuskbeast models, v2 (sitting crew, neck driver, wild and howdah looks, Wounded)

Date: 24 Nov 2026 (replaces the 23 Nov brief about standing archers). From: Claude Code (The Wilds). Owner and Creative
Director: the user; they approve all changes.

## What changed since v1 (decisions by the Director, tested on Android in The Wilds 0.0.5–0.0.6)

- **The crew sits.** Guilds+ guards now use Mojang's humanoid skeleton and its riding pose. **No standing anchors are
  needed**; drop v1's part 1.
- **The driver sits on the neck**, just in front of the howdah and behind the head, so they can see ahead.
- **4 passenger seats** in the howdah's corners: archers, crossbowmen or invited players.
- **The howdah itself shoots** (a script fires from the roof for each seated archer or crossbowman).
- **Facing:** the model's head is on +Z, the side Bedrock treats as the back. The game turns the whole model 180° when it
  is drawn (an animation on `root`). **Keep the head on +Z** in every build, so the turn stays right for all of them.
- **Wild Tuskbeasts roam without a howdah** and are captured. The howdah is an upgrade added later from a menu. So one
  beast must be able to switch between the unarmoured look and the armoured (howdah) look. See part 2.

## Rules (unchanged)

- Edit the source `.bbmodel` files and re-export geo, animation and texture. Keep the geometry and animation IDs:
  `geometry.<variant>_tuskbeast[_armored]`, `animation.<variant>_tuskbeast[_armored].<clip>`.
- Bump each guide's version, keep the old files, and list every change in the guide.
- Run the audit again (cuboids, triangles, floor clearance per clip). Don't raise the Badlands armoured cuboid count (191).
- Don't change approved looks or proportions. If a change would alter the silhouette, propose it first.
- No `q.attack_time` anywhere (it makes mobs invisible on Android).

## 1. Seat and tower locators (the three armoured builds)

Add these locators. Coordinates are model pixels on the Savanna build as it is now (head on +Z); match the same spots on
Badlands and Tundra. Keep the old `seat_*` locators.

| Locator | Savanna position (px) | What sits there |
|---|---|---|
| `seat_neck` | (0, 104, 32): neck top, between the howdah front (z 23.5) and the head (z 36) | the driver |
| `seat_crew_1` / `_2` | (±14, 111, 9) | front corners of the deck |
| `seat_crew_3` / `_4` | (±14, 111, -35) | back corners of the deck |
| `tower_muzzle` | (0, 162, -14): just above the roof's middle | where the howdah's arrows leave |

Needed:
1. **A neck seat the driver can sit on:** a flat area of about 10 × 10 px on the neck top, with nothing above it up to
   +32 px and a clear view forward over the head. A small saddle pad there is welcome if it fits the silhouette
   (propose it first).
2. **Crew corners:** about 12 × 12 px of flat deck at each, with roof clearance of at least 24 px above the deck (a
   sitting guard). Report the deck-top height at each corner.
3. **Tundra:** check that the sloped roof (y 144, rolled ±19°) clears a sitting guard at the corners.

## 2. Wild and howdah looks on one beast (all three variants)

A captured wild Tuskbeast gets its howdah later, so the game swaps its look in place. Please make the swap clean:
- **Unarmoured and armoured builds share the same skeleton:** the same bone names, parents and pivots for every body
  part (`root`, `body`, `hips`, `neck`, `head`, legs, trunk, tail, ears, tusks).
- **The armoured build's extra parts are in their own bones:** the howdah in `acacia_howdah` (or the variant's
  equivalent), and the armour plates in bones named `armor_*`. Nothing from the howdah or armour inside body bones.
- **One animation set works on both:** every clip animates only the shared bones, so the unarmoured and armoured looks
  can play the same clips (or two sets with identical timings).
- Report anything that can't share, and why.

## 3. Wounded state and siege stance (all 6 models: 3 variants × unarmoured and armoured), unchanged from v1

The Wounded state triggers at 25 % health and lifts at 40 %. It slows the beast to 40 % speed, and it can still be
ridden. Today it has no pose.

| Clip | Type | Purpose |
|---|---|---|
| `kneel` | one-shot, about 1.2 s | Forelegs fold, body lowers, tusks down. Ends in the kneel pose. Siege stance, resting while Wounded. |
| `kneel_hold` | loop, about 3 s | Breathing in the kneel pose. Body height stays within 4 px. |
| `kneel_rise` | one-shot, about 1.2 s | Back to standing, matching the `idle` first frame. |
| `wounded_idle` | loop, about 4 s | Head low, ears back, heavier breathing, slight sway. |
| `wounded_walk` | loop, same stride length as `walk` | A visible limp, played at the slower speed. |

Constraints:
- **The howdah and the neck seat stay level and above the floor in every frame.** Riders follow the seat positions in
  the entity file, not the bones. Keep the torso within ±3° pitch and ±6 px height of the idle pose in `wounded_idle`
  and `wounded_walk`. In `kneel*`, report the exact drop at `seat_neck` and at the crew corners, so the seats can be
  lowered to match.
- Feet on the floor (audit `floor_min` ≥ -0.5) and no leg crossing, as for the existing clips.
- Add clip markers for timing: the kneel touchdown and the rise lift-off.

## Not needed now

- **Guilds+ guards:** no change. They sit with Mojang's riding pose.
- **Pebble Mimic and Aetherseed:** their models exist on the Director's computer but aren't in the project yet. Wiring
  them in is Claude's job once the Director shares them; no Codex work.

## Return to Claude Code

For each build: the new geo, animation and texture files, the updated guide listing the locator coordinates and the
deck heights, and the audit JSON. Same folder layout as now
(`The Wilds - Models/Mobs/<Variant> Tuskbeast/Armored|Unarmored/`).
