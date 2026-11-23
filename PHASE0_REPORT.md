# The Wilds: Phase 0 report (current build 0.0.3, 23 Nov 2026)

## Server test results, build 0.0.2–0.0.3

These ran on Bedrock Dedicated Server **1.26.65.1** (Windows, Microsoft-signed), with Guilds+ 0.9.6 and The Wilds in
one world. Commands came from the server console through `/scriptevent wilds:test …` hooks; no player was online. Logs
are in `test_logs/`. **Still needed on Android:** anything a player sees or touches (seat heights and standing poses,
the Howdah Flag tap, steering, friendly fire on a real driver), plus Realms and Switch.

| Prototype | Server result | Evidence |
|---|---|---|
| P0-1 Dual-pack load | **PASS for The Wilds.** It adds 0 errors: 728 with Guilds+ alone, 728 with both. **Guilds+ 0.9.6 itself is broken on 1.26.65** (see below). | `test_logs/*.log` |
| P0-2 Archers: Path A (their own AI) | **FAIL.** Seated mercenaries fired 2 arrows in about 3 minutes, with zombies 10–14 blocks away. The same archer on foot fired at once and killed a zombie. | report counter `native` |
| P0-2 Archers: Path B (Wilds fires) | **PASS.** 22 shots and 2 kills in 20 s. It kept firing while the beast moved (40 shots), and both archers stayed seated through movement, an 80-block fall and **two server restarts**. Arrows are drawn from the Howdah chest. | `pathB`, seat report |
| P0-2 Friendly fire | This game version supports cancelling damage (`beforeEvents.entityHurt`), so crew arrows are **blocked outright** for players. Not yet tested with a real player. | `ff=cancel` |
| P0-3 Durability | **PASS, with new numbers.** Bedrock's half-second hit immunity means 4 zombies together land only about 1 hit a second: **1.2 health/s**. That's about 4 minutes to kill it, against about 60 s on paper. A creeper blast cost about 15. Wounded triggered at 71/300, and not at 81/300 (27 %). Healing resumed after 20 s. | durability log |
| P0-4 Mimic affinity | **PASS.** 300 births: 73.0 / 20.3 / 6.0 / 0.7 / 0.0 % (target 75 / 20 / 4 / 0.9 / 0.1). After a restart: 297 kept the same affinity, 0 changed (3 had wandered out of the loaded area). On gold: 384 refusals, 19 rare or diamond mimics became gold, **0 violations**. | `mimic_verify` |
| P0-5 Landmarks | **PASS.** `getBiome` works on this version. A cherry grove cell got its Oni Cairn on the first visit. Repeated visits gave no duplicates. Felled stayed felled after a revisit and after a restart. | `landmark_audit` |
| P0-6 Aetherseed | **PASS.** Original: 3 wheat +1 stage. Bloom: poppies 2 → 4. Withered: 2 wheat −1 stage, 1 poppy became a dead bush. Exactly 3 changes per pulse, then exactly one natural pulse every 45 s. **The flower pots never changed.** | `garden_state` |

**Decision taken under the handoff's own fallback rule:** Path A failed, so **Path B is now the default** (0.0.3).
`/scriptevent wilds:archers A` switches back for comparison. Path C was not needed.

**Guilds+ 0.9.6 on 1.26.65 (not a Wilds issue; Guilds+ was not edited):** its script stops at startup with
`ReferenceError: Import [hearthfarm/contracts_data.js] not found`. That file exists. It's the only Guilds+ script with a
single line longer than 64K characters (80,123); larger files that are split into lines (`book_data.js`, 95 KB) load
fine. Because the script never runs, Guilds+'s custom components are never registered, and 69 blocks, 188 items and
372 recipes fail after it. The likely fix is for the Guilds+ build tool to write `contracts_data.js` across several
lines. Please check whether Guilds+ works on your Android version. While its script is down, mercenaries still fight
(native AI) but have no roster, patrols or menus. That's why the mercenaries in these tests were summoned and tagged
by hand.

Path B arrow tuning, a proposal: 40 shots killed about 4 zombies. The arrow speed is 2.4; 3.0 would hit harder
(arrow damage grows with speed).

---

# Original report, build 0.0.1

**Status: all six prototypes are built and checked offline. None has been tested in Minecraft yet.** I can't run Bedrock
here, so every pass/fail below is waiting on your Android test. Each one has the steps and the exact check.

Package: `dist/TheWilds_v0.0.1.mcaddon` (229 KB). Source: `TheWilds_BP`, `TheWilds_RP`, `tools/`.

## What I checked offline

| Check | Result |
|---|---|
| All JSON files parse | pass (0 errors) |
| All 7 scripts parse | pass |
| Identifier and UUID collisions against Guilds+ 0.9.6 (`tools/check_collisions.ps1`) | pass: 30 Wilds ids against 3,088 Guilds+ ids, no overlaps |
| Every Wilds identifier uses the `wilds:` prefix | pass (geometry ids keep the model's own names) |
| Landmark hash: deterministic, and cell shares match the chances | pass (10,000 cells: 1.000 / 0.500 / 0.149 / 0.349 / 0.699) |
| Zip entries use `/` paths (needed for Android and Switch) | pass |

Guilds+ was read only. No Guilds+ file, identifier, event or vanilla entity was changed. The Wilds stores its data only
under `wilds:` keys and in its own pack-scoped dynamic properties.

## The key P0-2 finding

**Guilds+ mercenaries shoot through native mob AI, not through script.** `guilds:merc_archer` and `guilds:merc_crossbowman`
use `behavior.nearest_attackable_target` (monster family, 24 blocks) and `behavior.ranged_attack` (radius 16).
`ironhome/mercenaries.js` only handles hiring, the roster (world property `guilds:mercs`, keyed by entity id), posts,
patrol walking (marker blocks plus `guilds:goto`/`guilds:stop` events every 2 s), and supplies. `routes.js` is retired and
doesn't touch mercenaries. `main.js` only links the menus. So **Path A is the expected path**: a seated mercenary keeps
its own ranged goal, as a skeleton riding a spider does. Its roster record is keyed by entity id, so mounting changes
nothing in Guilds+.

## Test setup (once)

1. Import the .mcaddon. Make a **test world** (Creative, cheats on) with Guilds+ 0.9.6 BP+RP and The Wilds BP+RP.
2. Run `/scriptevent wilds:debug` to see Wilds messages in chat, then `/scriptevent wilds:status`.
3. All test commands are `/scriptevent wilds:<name>`: `status`, `archers A|B`, `durability_test`, `mimic_info`,
   `mimic_spawn 200`, `mimic_census`, `landmark`, `landmark_audit`, `seed original|bloom|withered`, `debug`.

## P0-1 Dual-pack load: built, needs the Android test

- **Test:** load both packs in one world. `wilds:status` should say "Guilds+ detected". Open the Guilds+ Steward and hire
  one guard. Craft a Howdah Flag (stick + string + any planks). Spawn every Wilds spawn egg.
- **Pass:** no content-log errors from either pack, both packs' menus and items work.
- **Then:** a world with only The Wilds. `wilds:status` should say "Guilds+ not installed", with no errors.

## P0-2 Tuskbeast mounted archers: built (Path A, with Path B ready), needs the Android test

**How it works:** one tap on the **Howdah Flag** within 8 blocks of a Savanna Tuskbeast (armoured model):
you take the driver seat, then up to two of *your* archers or crossbowmen within 24 blocks board. Tap again and they
climb down. If a player mounts behind the archers, the script moves the player into the driver seat. The crew list is
saved on the beast, and any crew member who falls off after a reload climbs back on.

- **Test A:**
  1. Hire 2 archers, spawn a Tuskbeast, hold the flag and tap once.
  2. Ride into a group of zombies.
  3. `wilds:status` counts "native" shots from seated archers.
  4. Save and quit, rejoin, and check the seats again.
  5. Tap the flag to dismount them, and check that their Guilds+ menu still shows post, kit and arrows.
- **Pass:** native shots go up while you're moving, both archers are still seated after rejoining, and Guilds+ state is intact.
- **If they sit but don't shoot:** `/scriptevent wilds:archers B` switches to Path B. Put arrows in the Howdah chest
  (horse-style inventory while riding). Wilds then fires for them every 1.5 s: nearest hostile in a 20-block line of
  sight, with spread, hostile mobs only.
- **Without Guilds+:** the flag seats you, and other players tap the beast to take the two archer seats.

**Update in 0.0.2:** archers now **stand** on the deck (owner's decision). Arrows from mounted crew no longer hurt
players (`wilds:status` counts blocked and refunded hits). Mounted crew get `guilds:stop` every 2 s. Path B skips
shots that would pass through a player. Risks 1 and 2 below are fully fixed only by `GUILDS_PATCH_PROPOSAL.md`.
Risk 3 is handled. For risk 5, the seats are now archers `[±1.0, 6.95, -1.75]` and driver `[0, 7.3, 0.56]`.

**Risks to watch (as found in 0.0.1):**
1. The Guilds+ patrol loop doesn't know a guard is seated. It will keep placing its invisible walk markers nearby and
   firing `guilds:goto`. Expected harmless, but check for markers left behind.
2. A guard low on arrows sets a Guilds+ supply trip it can't walk while seated. It will wait until dismounted.
3. Archers sit behind the driver. A native shot could hit the driver (mercenary arrows aren't blocked on players).
   Path B has the same risk. Watch for it.
4. In Path B, Guilds+ will also count Wilds-fired arrows against the guard's own ammo and bow wear (its
   projectile-hit hook). Decide whether that double count is acceptable.
5. Seat offsets are converted from the guide: driver `[0, 7.0, 0.56]`, archers `[±1.0, 7.0, -1.75]` blocks. The guide
   says y 117 (7.31 blocks). I started at 7.0 because riders sit lower than the seat surface. **Tune in game.** Left and
   right may be mirrored in Bedrock.
6. The collision box is 3.5 wide × 5.5 tall (the model is about 11 blocks tall). It won't fit under most trees.
7. Player steering uses `input_ground_controlled` plus `is_tamed`. If the beast won't steer, the next step is a
   saddle component group.

## P0-3 Durability without invulnerability: built, needs the Android test

Proposal numbers: 300 health (3× iron golem), knockback resistance 1.0, **all damage × 0.4**, no fall or suffocation
damage, no damage from its own riders or from Guilds+ mercenaries. It heals +1 every 2 s after 20 s without damage (a
full heal takes 10 minutes). **Wounded** at 25 % or less: it slows to 40 % speed, and recovers at 40 %.

- **Test:** `wilds:durability_test` next to a beast. It sets off one creeper-sized blast, then 4 zombies hit it once a
  second each (12 raw damage/s). Health is reported every 10 s.
- **Expected:** the blast costs about 10 health. The beating takes about 4.8 effective damage/s, so it dies in
  **about 60 s** and turns Wounded at about 45 s. An iron golem under the same beating dies in about 8 s.
- **Note:** vanilla hostiles don't target a neutral mob, so the real day-to-day threats are skeleton crossfire,
  creepers and players. If 60 s of nonstop beating feels too short, try a multiplier of 0.3 (about 80 s) or 0.25
  (about 100 s).
- **Blocker:** there's no kneel or brace clip. Wounded only slows the beast for now. The siege stance and Wounded pose
  need that clip commissioned.

## P0-4 Pebble Mimic affinity: built, needs the Android test

The affinity roll happens **in the entity file at birth** (`minecraft:entity_spawned`, weights 750/200/40/9/1). That
event never runs again on reload, so the roll can't be repeated, and the value saves with the mob as the property
`wilds:affinity`. Size is small or large (scale 0.6 or 1.3, same geometry), 50/50 (proposal).

Touching a matching block (below it or beside its feet, checked once a second, with an 8 s cooldown) changes its form,
**only if that form's tier ≤ its affinity**.

| Tier (affinity) | Forms (proposal; only "common = 75 %" is approved) |
|---|---|
| common | stone, mossy, sand, clay, coal |
| uncommon | copper, iron |
| rare | gold |
| diamond | diamond |
| netherite | netherite |

- **Test:** `wilds:mimic_spawn 200`, then `wilds:mimic_census` (expect about 75/20/4/1/0 %). Push a common one onto a
  gold block: chat should say "refused". `wilds:mimic_info` on one, then save, quit, rejoin, and check `mimic_info`
  again (same affinity).
- **Pass:** no common mimic ever becomes a rare form, and affinity is unchanged after a reload.
- **Placeholder look:** a cube with the vanilla block texture of its form. The 10 variant models are still
  Blockbench-only (free format), and converting them is production work.
- **Question:** the Blueprint says 11 materials, but the folder has 10 models (stone, mossy, sand, clay, coal, copper,
  iron, gold, diamond, netherite). Which is the 11th?

## P0-5 Landmark placement and persistence: built, needs the Android test

- Fixed **1,500-block cells**. A 32-bit hash of the cell coordinates (no seed) decides which kinds a cell holds, and
  an anchor for each.
  - Proposed shares: Oni 100 %, but cherry grove only, so in practice only cells that contain a grove.
  - Colossus 50 %, Serpentwreath 15 %, Stormmantle 35 %, Tuskbeast herd 70 %.
- Each cell's plan is saved in its own small world property, `wilds:lm:<cx>,<cz>`.
- A kind is placed the first time a player is in a fitting biome in that cell: at the anchor if it's loaded and
  fits, otherwise at a fitting spot near the player on the side toward the anchor.
- **The record is written before the spawn**, so there are no duplicates even with two players or a crash.
- Felled stays felled (`RETURN_FELLED = false`, open question 4).
- **Test:**
  1. `/locate biome cherry_grove`, teleport there, and walk around. A red "Oni Cairn (placeholder)" marker appears.
     Check `wilds:landmark`.
  2. Kill it, leave, come back, and restart the world or Realm: it does not return.
  3. `wilds:landmark_audit` reports duplicates (should be none).
- **Fail sign:** "Biome here: unreadable" in `wilds:landmark` means `Dimension.getBiome` isn't available in your game
  version. The fallback is to place landmarks through biome-filtered feature rules, then record them from script when
  first seen.
- **Difference from the brief:** without reading unloaded chunks, "nearest fitting biome to the anchor" becomes "the
  first fitting spot a player reaches, pulled toward the anchor". It's still persistent and unique.

## P0-6 Aetherseed pulses: built, needs the Android test

Every 45 s, radius 5 (plus 3 blocks up and 2 down), at most 3 random eligible targets. The due time is stored on each
seed, and no block is hit twice in the same loop.

- **Original:** crops grow +1 stage. Crops must sit on farmland.
- **Bloom:** saplings ripen; flowers spread one copy onto free grass beside them.
- **Withered (no warning):** crops lose a stage; flowers and saplings become dead bushes.

Saplings and flowers must stand on dirt-family soil. A potted plant lives inside the flower pot block, so it is never a
target.

- **Test:** plant crops, flowers, saplings and two potted flowers. Spawn a seed, then run `wilds:seed original`, then
  `bloom`, then `withered`. Each one pulses 3 s later.
- **Pass:** at most 3 changes per pulse, one pulse every 45 s (`wilds:status` counts them), and the pots never change.

## Answers and open items for you

1. **Q1 (mercenaries: AI or script?):** native AI. See above.
2. **Q3:** Tundra Tuskbeast files are in your Downloads folder (`The Wilds - Models/Mobs/Tundra Tuskbeast`, unarmoured,
   armoured Snowhide, and two eye variants). **The kneel or brace clip is still missing.**
3. Still open: Q2 (Serpentwreath armour), Q4 (felled wonders return: currently no), Q5 (wild Frost Lynx scenery).
4. Inventory icon: the Howdah Flag uses the vanilla banner-pattern icon until Codex supplies one. Sounds are vanilla
   stand-ins (bone meal, composter).
5. Performance: the Badlands armoured model is not loaded in this build (Savanna only). The loaded-Tuskbeast cap comes
   with Phase 1.

## Next step

Run the six tests on Android and send back pass/fail per prototype, with any content-log errors. I'll fix what breaks,
bump to 0.0.2, and keep inside Phase 0.
