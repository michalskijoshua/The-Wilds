# Changelog

## 0.0.19 (25 Nov 2026): Checkpoint A, critical stabilization (v0.0.18 audit)

Statuses and test details per issue: `AUDIT_TRACKER.md`.
- TW-01: APIs checked against Mojang's 2.6.0 packages; `BiomeTypes` removed; `min_engine_version` 1.26.10.
- TW-03: new `core/txn.js` (re-check, pay first, refund, one exchange per creature): cage catch/release, Aetherseed bone
  meal, Frost Lynx treats.
- TW-04: the Frost Lynx's owner is the player who fed it (recorded at the feeding), saved as a player id.
- TW-05 (+ TW-49, TW-52): spawn records with id, dimension, spot, times and misses; failed spawns and lost creatures
  free their square; unloaded is never dead; records written only on change; the Tuskbeast moved onto the shared
  spawner with its old records carried over.
- TW-09, TW-10: a Tuskbeast only ignores damage from its own riders; other riders and guards hurt it normally.
- TW-12, TW-13, TW-15: owners send down every guard, invited riders only their own; sent-down guards leave the crew at
  once; re-seat after a load only 10 s and within 4 blocks; menus re-check before acting.
- TW-22: summoned zombies vanish only when their seed's spell has ended (death, cage, healing), not when it's unloaded.
- TW-24: pulse deduplication keyed by dimension; new flowers count as touched.
- Test hooks: `tusk_hit`, `senddown`, `txn`, `sq_check`, `sq_remove`, `sq_fake`, `sq_legacy`, `zombies`.

## 0.0.18 (24 Nov 2026): Codex's icons and sounds

- **13 inventory icons** (`TheWilds_RP/textures/items/wilds/`): the empty Cage, 3 caged Aetherseeds, 8 caged Bloomlings,
  Frost Lynx Fur. They replace the iron-bars and rabbit-hide placeholders.
- **49 sounds** (`TheWilds_RP/sounds/wilds/`), 27 events in `sounds/sound_definitions.json` (`wilds.<creature>.<name>`,
  every numbered take a variation).
  - Built in (`TheWilds_RP/sounds.json`): Bloomling idle, hurt, death, hop (as steps); Frost Lynx idle, hurt, death.
  - By script (the Aetherseed's sounds depend on its form, which the built-in events can't): Aetherseed idle every 8-22 s,
    hurt and death per form; each form's pulse; the Withered torch snuff and zombie call; Bloomling nibbling a flower;
    Frost Lynx hiss as a wild one bolts from a player (at most every 12 s), purr near its owner every 15-35 s, eating raw
    meat (taming and treats), a happy chirp after a trick, the pounce/bite.
- `CODEX_HANDOFF_ASSETS.md` marked delivered. Server: every sound and icon file found, 0 errors. Sounds and icons
  can only be seen and heard on a device.

## 0.0.17 (24 Nov 2026): Pebble Mimic drops

Director's design: a Mimic killed by a player swinging **any pickaxe** drops what it looks like; killed any other way,
nothing (`scripts/mimic/drops.js`).
- Large: stone 15 cobblestone, mossy 15 mossy cobblestone, sand 15 sand, clay 15 clay balls, coal 15 coal.
  Small: half (8). Copper, iron, gold, diamond: 1 of that ore; netherite: 1 Ancient Debris (any size).
- Test hook `mimic_drops`. Server test, 0 errors: the table is right for all 10 forms, large and small, with a pickaxe;
  nothing with a sword; 15 cobblestone really drop; a Mimic killed by a command drops nothing. A real pickaxe kill needs
  a player: check on Android.

## 0.0.16 (24 Nov 2026): spawn eggs, one per look

- **24 eggs** (`wilds:egg_<creature>_<look>`, `tools/egg_build.py`): Tuskbeast x3 kinds, Aetherseed x3 forms,
  Bloomling x8 looks, Pebble Mimic x10 forms. Listed with the spawn eggs in Creative (`menu_category` group
  `minecraft:itemGroup.name.mobEgg`, no experimental toggle; loaded with no content-log warnings on the server).
- **Icons:** Minecraft's egg template coloured from each look's own texture (most common colour = shell, a lively,
  different one = spots). No Codex sprites.
- **Hatching** (`scripts/eggs.js`): tap the ground; the creature comes out in that look. Tuskbeast eggs give the chosen
  kind (wild ones still follow the biome); Mimics come out large, in the chosen form, and keep it (it counts as their one
  change; their affinity is raised to allow that form). Used up as normal except in Creative.
- The engine's single egg for the Tuskbeast, Aetherseed, Bloomling and Mimic is hidden; the Frost Lynx keeps its own.
- Test hook: `eggs` (hatches all 24 in a row). Server test: all 24 came out in the right look and form, Mimics large,
  Tuskbeast kinds kept after the biome check, 0 errors.

## 0.0.15 (24 Nov 2026): Batch D, the Bloomling

- **Model:** Codex's 8 Bedrock looks (`tools/bloomling_build.py`): original, Ember Tulip, Sunbonnet, Moonbell, Froststar,
  Poppy Patch, Clover Puff, Dusk Orchid, picked by `q.mark_variant`; clips idle, hop, graze, hurt, death; turned 180°;
  the same `armor_offset.default_neck` marker on every model.
- **Behaviour** (`wilds:bloomling`, `scripts/bloomling.js`): passive, 3 health, rabbit-sized. Flees players who
  don't sneak (6 blocks), wolves, foxes, cats, ocelots, lynxes and zombies; panics when hurt. Eats small flowers (the
  flower block is removed; the graze move plays). Fed any small flower it breeds; the baby takes one parent's look at
  random (script); babies grow up in 20 minutes. Drops what a rabbit drops. Can't be tamed. Can be caged
  (`wilds:cage_bloomling_<look>`, 8 items, placeholder icons); a caged baby comes out grown.
- **Spawning** (script, not light-level rules): every 20 s per player, while fewer than 8 are within 48 blocks, a 6 in
  10 chance of a group of 2-4 of one look, 20-40 blocks away, from the looks allowed there and then:
  Original (plains, forest, mountains, spruce; day), Ember Tulip (plains, savanna; night), Sunbonnet (within 6 blocks
  of a sunflower any time; savanna any time), Moonbell (cherry grove, dappled forest; night), Froststar (on snow, any
  time), Poppy Patch (spruce, dappled forest; day), Clover Puff (birch, forest, spruce; night), Dusk Orchid (spruce,
  jungle, plains, swamp; night). No daytime Bloomlings in jungle, cherry grove or swamp. Day = in-game 0-12000.
  Wild ones fade away when far, like rabbits; released, bred and spawn-egg ones stay.
- Test hooks: `bloom_looks`, `bloom_spawn`, `bloom_visit`, `bloom_breed`, `bloom_list`.
- Server test, 0 errors: 11 babies from Moonbell x Clover Puff came out 5 Moonbell / 6 Clover Puff, never anything
  else; a caged Froststar came out a Froststar with its health; 4 Bloomlings on poppies grazed 7 times in 60 s; a lynx
  caught a Moonbell at night; real biomes at noon and midnight gave exactly the allowed looks (plains: original by
  day, Ember Tulip / Dusk Orchid by night; snowy plains: Froststar; savanna: Sunbonnet, plus Ember Tulip at night); a
  sunflower placed in an ocean area allowed Sunbonnets; a night spawn try made 2 Clover Puffs in a forest.

## 0.0.14 (24 Nov 2026): Batch C, the Frost Lynx

- **Model:** the Director's Frost Lynx (23 clips) converted by `tools/lynx_build.py` (turned 180°, scale 1.3).
  Client switches use vanilla queries only (ground speed, hurt, alive, `q.is_tamed`, and `q.skin_id == 1` = told to
  Stay); the bite, the pounce, sniffing food, the taming nuzzle and the tricks are started by the script
  (`Entity.playAnimation`).
- **Wild** (`scripts/lynx.js`, entity `wilds:frost_lynx`): snowy spruce (`cold_taiga`, `cold_taiga_hills`,
  `cold_taiga_mutated`), one per 500 x 500 square, back 1 real day after it dies or is tamed. Flees players at 11 blocks
  (4 when they sneak; a sneaking player holding raw meat is not feared, and the meat tempts it). Never fights back.
  Hunts rabbits, chickens and Bloomlings at dusk and night only.
- **Taming:** raw beef, porkchop, mutton, chicken or rabbit, about 1 in 3 per feed (vanilla `tameable`). The tamer owns it.
- **Tamed:** 20 health; tap with an empty hand (owner) for **Follow / Stay / Wander**; defends its owner; never hunts;
  raw meat from the owner = a random trick (spin, offer paw, listen and peek) and +4 health.
  Stay = speed 0 and the sit moves. Each mode group carries its own speed, so swapping modes never strips movement.
- **Fur** (`wilds:fur`, "Frost Lynx Fur", placeholder icon: rabbit hide): 1-2 per lynx (+1 with Looting), wild or tamed.
- Not cageable. Test hooks: `lynx_visit`, `lynx_info`, `lynx_tame`, `lynx_mode`, `lynx_trick`.
- Server test, 0 errors: at night it killed a rabbit and a chicken within 20 s (pounce played 3 times); at noon a rabbit
  lived; tamed: Follow / Stay (speed 0) / Wander / Follow all switched; a trick played; a tamed lynx at night left two
  rabbits alone; the cage refused it; it dropped Fur; a real `cold_taiga` square got one lynx, a second visit none.
  Not testable without a player: fleeing, sneaking up, taming by feeding, the menu.

## 0.0.13 (24 Nov 2026): Batch B, the cage; seeds stop glowing; a Mimic changes once

Director's decisions after 0.0.12: the Kindlesprite is the creature that lights up, so **no Aetherseed glows** (the
Withered one stays as built); **a Pebble Mimic keeps its first change forever**; the Batch A numbers are kept.
- **Cage** (`scripts/cage.js`): an empty Cage (`wilds:cage`, stacks to 16; 8 iron bars around 1 string) used on an
  Aetherseed puts it inside and becomes a full cage of that look (`wilds:cage_aetherseed_original|bloom|withered`, its own
  item for its own icon), remembering health and the play time it was caught (item dynamic properties; health also in
  the item's lore). Tap the ground with a full cage: the creature comes out with the same look and health, and you get
  the empty cage back. **Wilting:** an Original or Bloom kept more than 30 minutes of play time comes out Withered
  (compared only on release). Caging a Withered seed sends its zombies away; caging frees its home square for a new one.
  Not cageable (message "That creature won't fit in a cage."): Tuskbeast, Pebble Mimic, and later the Frost Lynx and the
  giants. Icons: placeholder iron bars until Codex delivers (`wilds_cage_empty`, `wilds_cage_<kind>_<look>` in
  `TheWilds_RP/textures/item_texture.json`).
- **No glow:** the travelling light is switched off; the clean-up stays, so lights left by 0.0.12 are removed.
- **Mimic:** after its first change of form it never changes again (`wilds:changed`).
- Test hooks: `cage_catch`, `cage_release [minutes kept]`.
- Server test, 0 errors: no light around an Original seed; a hurt Original (7/12) caught and released at 7/12, still
  Original; after 29 minutes still Original, after 31 minutes Withered; caging a Withered with 2 zombies sent them away;
  the Tuskbeast was refused; two Mimics turned to sand on sandstone and stayed sand after 12 s on coal.

## 0.0.12 (24 Nov 2026): Batch A, the Aetherseed's life in the wild

Approved design from the planning chat's build handoff (24 Nov).
- **Wild spawning** (new `core/spawner.js`: a reusable one-per-square spawner, the Tuskbeast's idea made general):
  Original in `dappled_forest`, Bloom in `cherry_grove`, Withered in `roofed_forest(_mutated)`, `swampland(_mutated)`,
  `mangrove_swamp`. Squares of 320 blocks, 7 in 10 fitting squares get one, back 1 real day after it dies (proposals).
- **Withered near villages:** checked every minute per player; with 3+ villagers within 64 blocks, a 1 in 20 chance,
  at most one per village area per real day, 28-40 blocks out from the village, never in `deep_dark`.
- **Bone meal:** Withered -> Original or Bloom (50/50); Original <-> Bloom. Used up as normal (not in Creative).
- **Glow:** Original and Bloom carry an invisible light block (level 10). Every light is recorded on the seed and in a
  world list and removed when the seed dies, turns Withered, unloads or the world reloads; a sweep every 5 s and after
  each load removes any light whose seed no longer holds it.
- **Withered:** purple specks (`obsidian_glow_dust_particle`), no light; follows players holding a torch (main or off
  hand) within 16 blocks; pops placed torches within 4 blocks (they drop as items; lanterns stay); summons a zombie every
  2-4 min (first after 1-2 min), at most 2, and they vanish when it dies or is healed; never attacks.
- Sounds: still the vanilla stand-ins (bone meal, composter) until Codex delivers.
- Test hooks: `seed_spawn`, `seed_visit`, `seed_age`, `seed_light`, `seed_bonemeal`, `seed_zombie`, `seed_snuff`,
  `seed_village`.
- Server test (BDS 1.26.65.1, with Guilds+ 0.9.18), 0 errors: the light followed a moving seed (always exactly 1 block),
  went out when it turned Withered, came back after bone meal, survived a real restart as 1 block, and was removed when
  the seed died or was carried into an unloaded area; 3 placed torches popped off, the lantern stayed; zombies stopped at
  2 and vanished when the seed died; village spawn refused by chance, then spawned, then refused as "already one";
  real biomes: Bloom in a cherry grove, Withered in a dark forest, Original (lit) in a dappled forest.

## 0.0.11 (24 Nov 2026): Mimic luck, the neck warning (third try)

- **Pebble Mimic luck** (Director): 10 % can reach gold or better. Weights 700/200/50/45/5: common 70 %, uncommon 20 %,
  rare (gold) 5 %, diamond 4.5 %, netherite 0.5 %. Server census of 400: 69.0 / 20.8 / 5.8 / 3.8 / 0.8 %.
- **`armor_offset.default_neck`:** still reported on Android in 0.0.10 with no "neck" bone left, so Minecraft makes it
  on every model. Each of the six Tuskbeast models now carries the same one on its root bone (`tools/tusk_looks.py`).
  Harmless either way (it only places vanilla horse-style armour); to be checked on Android.

## 0.0.10 (24 Nov 2026): hovering Aetherseed, Mimic sizes, the neck warning

Director's Android test of 0.0.9.
- **Aetherseed hovers** 1-2 blocks up and glides over crops (allay-style flight: `can_fly`, `navigation.hover`,
  `behavior.random_hover`, no gravity, no fall damage), and is smaller (scale 0.25, was 0.5). Its pulse reaches 3 blocks
  down (was 2). Server test: hovering 1.4 blocks up, one pulse grew 3 wheat.
- **Pebble Mimic:** small = half a large one (scale 0.25, was 0.13). Large unchanged (0.5).
- **The `armor_offset.default_neck` warning, second try:** Minecraft matches any bone with "neck" in its name, so
  `neck_badlands` still clashed. The neck bone is now called `nape` in all six builds (`tools/tusk_looks.py`).
  No shapes changed. Only visible on a device: to be checked on Android.
- The Spanish, Russian, Chinese etc. "Invalid lang file format" warnings come from another pack, not from The Wilds.

## 0.0.9 (24 Nov 2026): Director's first look at the real models

- **Howdah costs 20 emeralds only**, the same in Creative (it was free in Creative, and the 5-item list was cut off).
- **Steps up through snow:** `minecraft:variable_max_auto_step` 1.5625 (also when ridden). Server test: pushed forward,
  it climbed a block topped with snow.
- **Content-log warnings gone** (seen on Android): the archer-stand markers are removed from the models (unused; seats
  come from the entity file), and the Badlands and Tundra neck bones are renamed `neck_badlands` / `neck_tundra` in
  their model and moves files (Minecraft makes a marker from any bone called neck; the kinds' necks sit 1 px apart).
  No shapes changed. Done by `tools/tusk_looks.py`.
- Text: "Tap sneak to get off" (was `action.hint.exit.wilds:tuskbeast`); the beast is called "Tuskbeast" (all kinds).

## 0.0.8 (24 Nov 2026): the real models (Tuskbeast x 6, Pebble Mimic x 10, Aetherseed x 3)

The Director shared the model folders (Codex's v2.0 Tuskbeasts with the kneel and Wounded clips, and the Blockbench
Mimic and Aetherseed).
- **Tuskbeast: one beast, six looks.** Kind by biome (Savanna, Badlands, Tundra; `q.mark_variant`), and build by howdah
  (unarmoured while wild or tamed, armoured with a howdah; `q.variant`). Wounded plays `wounded_idle` / `wounded_walk`
  (`q.skin_id`). Generated by `tools/tusk_looks.py`. All three kinds share one skeleton; all face +Z (turned in game).
- Wild Tuskbeasts appear in savanna, badlands and snowy plains / ice spikes, and take that kind; spawn eggs too.
- **Bug fix: biome names.** Bedrock calls badlands `mesa`, snowy plains `ice_plains`, windswept hills `extreme_hills`.
  The Badlands and Tundra lists and the Stormmantle's list used Java names and would never have matched.
- **Pebble Mimic:** the 10 form models replace the cube (`tools/wilds_models.py`, using a copy of Guilds+'s
  `bbmodel_convert.py`). Clips: standing idle, slow crawl, hit, death. Small = the size of Codex's Mini model (0.13), large =
  half the full model (0.5): proposal, to confirm.
- **Aetherseed:** the 3 form models (original, bloom, withered) with their glow layer. Clips: idle hover, gentle wander,
  hit, death.
- **Android-safe looks:** Mimic and Aetherseed forms now pick their look with `q.mark_variant` (kept in step with
  `wilds:form` by events), no longer with an entity property.
- Server test: 43 Mimics and Aetherseeds, every look matching its form, also after a Mimic turned gold and a seed
  bloomed; Tuskbeast kind and Wounded switch by event; 0 errors.

## 0.0.7 (24 Nov 2026): wild Tuskbeasts, taming, the Tuskbeast menu and the howdah upgrade

Director's decisions of 24 Nov 2026.
- **Wild and rare:** the overworld is cut into 750 x 750 squares; each holds at most one wild Tuskbeast. It appears the
  first time a player is in savanna in that square, 32-40 blocks away. Tamed or dead: a new one may come after 3 real
  days (`tusk/wild.js`). Tuskbeast herds are gone from the landmark list.
- **Taming, borrowed from the horse** (`minecraft:tamemount`): ride it until it stops throwing you off, or feed it
  (hay bale +15, golden apple +10, golden carrot +5, wheat/apple/sugar +3). The rider who tames it owns it (`tusk/tame.js`).
- **The Tuskbeast menu** replaces the Howdah Flag (removed, with its recipe): sneak + tap your beast with an empty hand
  (`tusk/menu.js`). Owner: Build a Howdah, Climb aboard with my guards, Send guards down, Riders (invite/remove).
  Invited players: Climb aboard with my guards. A wild beast gives a taming hint.
- **The howdah is an upgrade:** 10 emeralds, 8 leather, 6 iron ingots, 32 planks (any wood), 8 string (free in
  Creative). Until then the beast has only the neck seat, no chest and no tower. The howdah is hidden on beasts without one
  (`controller.render.wilds.tuskbeast`, by `q.variant`), until the unarmoured model arrives.
- **Felled wonders return after 3 real days** (`landmarks/cells.js`).
- Guild friends: ready for a Guilds+ member tag (`GUILDS_PATCH_PROPOSAL.md`, part 4). Idle until Guilds+ adds it.
- Server test: wild beasts refuse guards; tamed beasts with no howdah too; the howdah refuses a player without the
  materials and builds in Creative (5 seats, 16-slot chest, survives a restart); the tower fired 10 shots, 4 bolt
  bonuses, 2 of 2 zombies killed; wild spawning in a real savanna: 1 beast, no duplicates on repeat visits; killed or
  tamed empties the square; still empty at 71 hours, a new one at 73 hours.

## 0.0.6 (24 Nov 2026): guards never drive

Director (Android, 0.0.5 "works really well"): after he got off to fill the chest, a guard slid into the driver's seat.
Minecraft moves every rider forward one seat when the first one leaves.
- New invisible `wilds:seat_keeper` holds the driver's seat whenever only guards are aboard. It steps aside the moment a
  player climbs on, and a keeper that is not on a beast is removed (checked every half second).
- Crew put back in order no longer drop off the crew list for that split second.
- Server test: 3 forced knock-offs in a row, the keeper is back each time, 4 guards kept, 1 keeper; the tower still fires
  (16 shots, 5 bolt bonuses in 10 s); the Horn-style dismount clears everyone, keeper included.

## 0.0.5 (24 Nov 2026): the beast faces forward, driver on the neck, the howdah tower

Director's Android test of 0.0.4: the beast looked like it walked tail-first, the driver sat in the howdah and couldn't see, the archers sat at the front.
- **Faces forward:** the model was built with its head on the side Minecraft treats as the back. It is now turned 180°
  when drawn (`animation.wilds.tuskbeast.face_forward` on the root bone). The model file itself is unchanged.
- **Seats:** the driver sits on the neck just behind the head (`[0, 6.6, 2.0]`). 4 passenger seats in the howdah's
  corners (`[±0.9, 6.6, 0.55]`, `[±0.9, 6.6, -2.2]`), for archers, crossbowmen or invited players. Guards sit
  (Guilds+ plays Mojang's riding pose).
- **The howdah tower** replaces Path A/B: each seated archer adds 1 arrow every 1.5 s, each crossbowman 1 bolt every 2.5 s
  (faster flight, +2 damage half a second after the hit). Shots leave from the roof at the nearest hostile mob in sight
  (24 blocks) and come from the Howdah chest. The guards' own attacks are untouched. `wilds:archers` is gone.
- **Owner and invites:** the first player aboard owns the beast. The owner taps a player with the Howdah Flag to invite
  them (tap again to remove), or types `/wilds:invite <name>`, `/wilds:uninvite <name>`, `/wilds:invites` (no cheats
  needed). Anyone else who climbs on is put down. New `tusk/owners.js`.
- Only archers and crossbowmen board.

## 0.0.4 (23 Nov 2026): works with Guilds+ 0.9.7's Horn

- Crew re-seating now only happens in the first 30 s after a Tuskbeast loads (when a reload can drop riders). A crew
  member who gets off later, for example from the Guilds+ Commander's Horn "Return to posts", leaves the crew instead
  of being pulled back up within 2 s. (`tusk/seats.js`)
- Retested with Guilds+ 0.9.7: Wilds arrows no longer use up guard arrows or bows, and no walk markers appear around
  seated guards. Results in `PHASE0_REPORT.md`.

## 23 Nov 2026: Linux server retest (packs unchanged, still 0.0.3)

- No pack changes, so the build stays 0.0.3.
- New Linux tools, twins of the PowerShell ones: `tools/bds_install.sh` (install packs into a server world; `-n` for
  Guilds+ alone, `-f` for a fresh world), `tools/bds_run.sh` (headless server; commands through `wilds_cmd.txt`; log
  in `wilds_server.log`), `tools/bds_send.sh` (send commands and print the new log lines).
- Retest with the newest Guilds+ (0.9.6, branch `claude/quirky-euler-ga1ln8`): Guilds+ loads, 1 error instead of 728,
  The Wilds still adds 0. Path B fires with Guilds+ running. Guilds+ charges its guards for Wilds-fired arrows. Results
  are in `PHASE0_REPORT.md`; the proposed Guilds+ fix is part 3 of `GUILDS_PATCH_PROPOSAL.md`.

## 0.0.3 (23 Nov 2026): server-tested, Path B default

- Archer mode now defaults to **B** (Wilds fires for seated crew): on BDS 1.26.65, Path A did not fire.
- Server test hooks: `/scriptevent wilds:test <cmd> x y z [args]` from the console. Commands: `seat`, `move`, `mode`,
  `report`, `mimic_*`, `durability`, `visit`, `audit`, `seed`, `garden`, `garden_state`. Operator-only and harmless in
  normal play.
- `landmarks/cells.js`: the per-player check is now `visit(p)`, so tests can call it.
- Tools: `bds_install.ps1` (install packs into a server world; `-NoWilds` for a baseline), `bds_run.ps1` (headless
  server; commands through `wilds_cmd.txt`), `bds_send.ps1` (send commands and print the new log lines).
- `test_logs/`: server logs for Guilds+ alone and for Guilds+ with The Wilds.

## 0.0.2 (23 Nov 2026): standing archers, no friendly fire

- Decision (owner): archers **stand** on the howdah. Guilds+ mercenaries have no sitting animation, so they already
  render standing. Archer seats moved down to the deck: `[±1.0, 6.95, -1.75]` (deck top y 111 = 6.94 blocks). The
  driver seat moved to the seat surface: `[0, 7.3, 0.56]`.
- New `scripts/tusk/crewguard.js`:
  - Arrows shot by crew standing on a Tuskbeast no longer hurt players. If the game supports
    `beforeEvents.entityHurt`, the hit is cancelled; otherwise the health is given back the same tick.
  - Mounted crew get Guilds+'s own `guilds:stop` event every 2 s, so they don't try to patrol.
- Path B: never fires if a player is in the line of fire.
- `wilds:status` shows friendly-fire blocks and refunds.
- New docs: `CODEX_HANDOFF_TUSKBEAST_MODELS.md` (standing anchors, kneel and Wounded clips) and
  `GUILDS_PATCH_PROPOSAL.md` (one-line Guilds+ change, not applied).

## 0.0.1 (23 Nov 2026): Phase 0 prototypes

New pack pair: The Wilds BP/RP. BP header `30ecdda1-935a-4d7b-a91a-5d24a0daf938`, RP header `eb9b2d9f-8189-4f9b-a3e4-7f95d0e78436`.
Requires @minecraft/server 2.6.0 and min engine 1.21.90, the same as Guilds+ 0.9.6. No experimental toggles.

- `wilds:tuskbeast`: Savanna armoured model, 3 seats, Wounded state (P0-2, P0-3). The model, animation and texture are
  copied unchanged from the owner's Savanna Tuskbeast/Armored folder.
- `wilds:howdah_flag`: a one-tap board/dismount item, with a shapeless recipe of stick, string and any planks.
- `wilds:pebble_mimic`: affinity rolled at birth, 10 forms, 2 sizes, placeholder cube (P0-4).
- `wilds:landmark_marker`: 1,500-block cell placement with persistent records, placeholder marker (P0-5).
- `wilds:aetherseed`: 3 forms with 45 s targeted pulses, placeholder cube (P0-6).
- Scripts: `core/util.js`, `tusk/seats.js`, `tusk/durability.js`, `mimic/affinity.js`, `landmarks/cells.js`,
  `aether/pulse.js`, `main.js` (test commands).
- Tools: `tools/check_collisions.ps1` (P0-1 static check), `tools/package.ps1` (builds `dist/*.mcaddon`).
