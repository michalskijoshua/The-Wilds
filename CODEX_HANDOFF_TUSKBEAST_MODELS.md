# Codex handoff: Tuskbeast model updates for standing archers and the Wounded state

Date: 23 Nov 2026. From: Claude Code (The Wilds, Phase 0). Owner and Creative Director: the user; they approve all changes.

## Decision this is built on

**Archers stand on the howdah deck. They don't sit.** The owner prefers standing. Guilds+ mercenary models have no
riding or sitting animation (their client entities run only breathe, walk and swing), so a mounted mercenary already
renders standing. **No mercenary model changes are needed.** The player driver still sits on the driver seat.

## Rules

- Edit the source `.bbmodel` files and re-export geo, animation and texture. Keep the geometry and animation IDs
  unchanged: `geometry.<variant>_tuskbeast[_armored]`, `animation.<variant>_tuskbeast[_armored].<clip>`.
- Bump each guide's version, keep the old files, and list every change in the guide.
- Run the audit again (cuboids, triangles, floor clearance per clip). Don't raise the Badlands armoured cuboid count
  (191 now).
- Don't change approved looks or proportions. If a change would alter the silhouette, propose it first.

## 1. Standing anchors (all three armoured builds)

Add two locators per build at the **deck floor**, where an archer's feet go, separate from the existing seat markers.
Keep `seat_driver` as it is.

| Build | Deck top (model units) | Roof underside | Clear height | Current archer markers |
|---|---|---|---|---|
| Savanna / Acacia Canopy | y 111 (deck cube x ±27, z -46.5..18.5) | y 148.5 | 37.5 px = 2.34 blocks: OK | `seat_archer_left/right` (±16, 117, -28) |
| Badlands / Mesa Lookout | y 109 (x ±27, z -46.5..18.5) | y 143.5 | 34.5 px = 2.16 blocks: OK | (±16, 115, -28) |
| Tundra / Armored Snowhide | y 110 (x ±28, z -48.75..0.75) | sloped roof panels at y 144, rolled ±19° | **check**: the slope may drop below 31 px over x ±13 | (±13, 116, -22) |

Needed per build:
1. Locators `stand_archer_left` and `stand_archer_right` at deck-top height, centred where each archer will stand.
2. A clear standing column at each spot: at least 10 × 10 px of flat deck, and nothing between the deck and
   **deck + 31 px** (a mercenary is 1.9 blocks tall). On Tundra, raise or reshape the roof if the slope cuts into it.
3. A railing or parapet no taller than **12 px** at the archers' sides and front, so they can shoot over it and down
   at mobs. Mobs aim from eye height, about 26 px above the deck.
4. Optional, to reduce shots through the driver: raise the two archer spots onto a **rear platform 8–12 px higher**
   than the deck, so their line of fire passes over the driver's head. The script already stops arrow damage to the
   driver, so this is about looks and fewer wasted arrows. Do it only if it fits the silhouette.

## 2. Wounded state and siege stance (all 6 models: 3 variants × unarmoured and armoured)

Missing today. It blocks the Wounded state's look and the siege stance. The Wounded state triggers at 25 % health and
lifts at 40 %. It slows the beast to 40 % speed and it can still be ridden.

| Clip | Type | Purpose |
|---|---|---|
| `kneel` | one-shot, about 1.2 s | Forelegs fold, body lowers, tusks down. Ends in the kneel pose. Used for siege stance and resting while Wounded. |
| `kneel_hold` | loop, about 3 s | Breathing in the kneel pose. Body height stays within 4 px. |
| `kneel_rise` | one-shot, about 1.2 s | Back to standing, matching the `idle` first frame. |
| `wounded_idle` | loop, about 4 s | Head low, ears back, heavier breathing, slight sway. |
| `wounded_walk` | loop, same stride length as `walk` | A visible limp, played at the slower speed. |

Constraints:
- **The howdah, its anchors and riders must stay level and above the floor in every frame.** Riders follow the seat
  positions from the entity file, not the bones. Keep the torso (which carries the tower) within ±3° pitch and ±6 px
  height of the idle pose in `wounded_idle` and `wounded_walk`. In `kneel*`, report the exact torso drop at the
  anchors, so the seats can be lowered to match during the stance.
- Feet on the floor (audit `floor_min` ≥ -0.5) and no leg crossing, as for the existing clips.
- Add clip markers for timing: the kneel touchdown and the rise lift-off.

## 3. Nothing needed now

- **Pebble Mimic:** size is a scale only, so no new geometry. Converting the 10 variant `.bbmodel`s (free format) to
  Bedrock is a later production job.
- **Aetherseed, Oni Cairn and the other landmarks:** Phase 0 uses placeholders. No work yet.
- **Guilds+ mercenaries:** no change (see the decision above).

## Return to Claude Code

For each build: the new geo, animation and texture files, the updated guide listing the locator coordinates, and the
audit JSON. Use the same folder layout as now
(`The Wilds - Models/Mobs/<Variant> Tuskbeast/Armored|Unarmored/`).
