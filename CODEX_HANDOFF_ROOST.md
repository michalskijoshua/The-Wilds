# Codex handoff: Aetherseed Roost (25 Nov 2026, The Wilds 0.0.20)

From: Claude Code (The Wilds). The Creative Director approves every look.

## What it is
A **Roost** gives one Original or Bloom Aetherseed a permanent home. The seed floats and wanders within 2 blocks of it
and helps the plants around it. It should feel like a **natural creature habitat, not a machine**.

Today the Roost works in game with a **placeholder look** (a plain block: oak log sides, moss top). Only the look is needed.

## The look (Director's specification)
- **Medieval wooden pedestal with a botanical nest** on top: carved wood, moss, small leaves or flowers woven into the nest.
- Footprint **1 × 1 block**; height **1 to 2 blocks** (up to 32 px).
- It must read clearly next to vanilla blocks, in Minecraft's pixel style. A child playtests.
- Optional: a version that looks lived-in (a few glowing petals or seeds in the nest) for when a seed is homed. If you
  make it, deliver it as a second texture with the same model; Claude switches between them.

## Technical
- **Bedrock block geometry** (`geometry.wilds_aetherseed_roost`), one texture (16 × 16 or 32 × 32 px per face, as you
  see fit), `.geo.json` + `.png`, plus the Blockbench source.
- It must fit inside 1 × 1 × 2 blocks (x and z within -8..8 px, y within 0..32 px). The collision stays 1 × 1 × 1.
- No animations needed (blocks can't animate).
- One inventory icon `aetherseed_roost.png` (16 × 16).

## Send back
The `.geo.json`, the texture(s), the icon, the `.bbmodel`, and one preview image for the Director.
