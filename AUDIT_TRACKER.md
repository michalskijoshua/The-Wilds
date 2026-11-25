# The Wilds: audit tracker (v0.0.18 audit, development handoff of 24-25 Nov 2026)

Status words (from the handoff):
- **Fixed and tested**: built and checked on the Linux Bedrock Dedicated Server (1.26.65.1) with Guilds+ 0.9.18. Still
  needs an Android check where marked.
- **Implemented, awaiting runtime test**: built and syntax-checked, not exercised on a server.
- **Partially implemented** / **Blocked by API limitations** / **Deferred by design** / **Not started**.

"Server-tested" never means "Android-tested". Anything a player sees or touches still needs the Director's phone.

## Checkpoint A: critical stabilization (The Wilds 0.0.19)

| Id | Issue | Status | Notes |
|---|---|---|---|
| TW-01 | Script API compatibility | Fixed and tested | Every API used was checked against Mojang's `@minecraft/server` 2.6.0 and `@minecraft/server-ui` 2.0.0 type packages (npm). `BiomeTypes` is not in 2.6.0: removed (it was only used by a test command). 2.6.0 shipped with Minecraft 1.26.10, so `min_engine_version` is now 1.26.10 in both packs (was 1.21.90). No experimental APIs. Loads with 0 errors. |
| TW-03 | Survival item transaction safety | Fixed and tested (cage); implemented, same helper (bone meal, Lynx treats) | New `core/txn.js`: each exchange re-checks player, slot, item, count and distance when it actually runs, takes payment first, refunds on failure; one exchange per creature at a time. Server test with a stand-in player: normal catch/release; release twice refused; switched slot, busy creature, 10 blocks away, cage moved before release: all refused with nothing lost (3 cages accounted for every time). Spawn eggs: Creative-only duplication, left as is (by design). |
| TW-04 | Frost Lynx ownership persistence | Implemented, awaiting runtime test | Confirmed: the `tameable` component is gone when the tame event fires. The player who fed it is recorded at the feeding (`wilds:feeder`) and becomes the owner (`wilds:owner`, a player id, saved on the entity: survives restarts and dimension changes). Needs a real player taming on Android. |
| TW-05 | Spawn record reconciliation | Fixed and tested | `core/spawner.js` records: species, square, entity id, dimension, spawn spot, reservation time, last confirmed time and position, misses. Failed spawn or a reservation with no creature after 60 s goes back to pending. An unloaded creature is never counted dead; lost only after 3 checks in a row with its last spot loaded and watched. Death, cage and taming are recorded at once. The Tuskbeast now uses the same spawner; records from before 0.0.19 are carried over and their beasts adopted. Tested: carry-over and adoption, quiet removal lost at the 3rd check, stale reservation back to pending, death recorded at once. |
| TW-09 | Mounted-attacker immunity | Fixed and tested | The `is_riding` damage-sensor rule is gone. A Tuskbeast only ignores damage from someone riding that same beast (`beforeEvents.entityHurt`; arrows count by their shooter). Tested: own seated crew blocked; a guard riding a second Tuskbeast does damage (10 -> 4 after the beast's 0.4 armour). |
| TW-10 | Blanket mercenary immunity | Fixed and tested | The `ironhome_mercenary` damage-sensor rule is gone. Tested: a guard on foot does damage; own crew blocked. |
| TW-12 | Guard dismount permissions | Fixed and tested | "Send guards down": the beast's owner sends down every guard; an invited rider only their own (`ih_merc:<their id>`). Tested: an invited rider could not send the owner's guards down; the owner could. Guild allies: waiting on Guilds+ membership (TW-55). |
| TW-13 | Crew restoration conflicts | Fixed and tested | The crew record drops a guard the moment he is sent down. Re-seating after a load now only lasts 10 s (was 30) and only for guards still within 4 blocks of the beast. Tested: sent-down guards stayed off; a seated guard stayed seated through 3 restarts. |
| TW-15 | Deferred menu validation | Implemented, awaiting runtime test | Tuskbeast menu and Frost Lynx menu re-check player and creature validity, dimension, distance and permission when a choice is made. Needs a real player (menus can't be opened on the server). |
| TW-22 | Summoned zombie lifecycle | Fixed and tested | Each run of summons has an id stamped on its zombies; it is recorded as ended when the seed dies, is caged or healed, and only zombies of ended runs vanish. Unseen zombies still count towards the limit of 2 for 10 minutes. Tested: zombies stayed while their seed was far away (unloaded); a seed that died took only its own zombie. |
| TW-24 | Dimension-aware pulse deduplication | Implemented, awaiting runtime test | Key is now `dimensionId:x:y:z`; a flower placed by a Bloom pulse is added to the touched list. |

## Checkpoint B: existing creature gameplay (The Wilds 0.0.20)

| Id | Issue | Status | Notes |
|---|---|---|---|
| TW-02 | Pebble Mimic natural spawning and breeding | Fixed and tested (spawning, babies, growing up); breeding by a player awaits Android | Natural spawning (`mimic/life.js`, Claude's numbers): every 60 s per player, 3 in 10, at most 4 within 64 blocks, 12-28 blocks away, on open stone-family ground (stone, gravel, sand, clay, tuff...) or on a cave floor near a player below y 50. Breeding with cobblestone (native `breedable`); babies grow up in 20 minutes into small or large; parents rest 5 minutes; names work (`nameable`). Tested: spawned on stone, never on grass; 200 babies grew into 98 large / 102 small with their luck unchanged. |
| TW-18 | Resource progression and balancing | Fixed and tested | Each baby rolls its own affinity at birth with the unchanged odds (entity file, once: births don't re-roll on reload). 200 babies: 68 / 22.5 / 4.5 / 5.0 / 0 %. One change of form, drops (a baby drops like a small one) and transformation rules unchanged; wild and bred treated the same. |
| TW-19 | Aetherseed home behaviour | Fixed and tested | `aether/roost.js`: a homed seed gliding back from 8 blocks ended within 2 blocks of its Roost; crossed a fence row; the bond survived restarts. Placeholder block until Codex's model (`CODEX_HANDOFF_ROOST.md`). |
| TW-27 | Population management | Fixed and tested | One seed per Roost, one Roost per seed (both sides checked), Roosts 8 blocks apart (a second one 4 blocks away was given back), Withered can't be homed. No global cap. |
| TW-20 | Collision-safe torch attraction | Fixed and tested | `core/move.js`: one small step at a time with a ray check; rises at most 2 blocks above its target (over fences, never up walls); otherwise waits. Tested: never passed a wall or a roof; floated over a fence. Doors: closed doors block the ray (not separately tested). |
| TW-25 | Guilds+ crop compatibility | Fixed and tested | `core/crops.js`: 21 Guilds+ crops read from the Guilds+ 0.9.18 build (`guilds_farming:crop_<name>`, state `guilds_farming:age` 0..3, farmland) plus the vanilla crops. Tested: Original grew a tomato, corn and wheat; Withered shrank all three. Without Guilds+ those blocks never exist. |
| TW-36 | Bloomling spawn safety | Implemented, awaiting runtime test | Each group member gets its own spot (ground within 3 blocks of the group's height, open air or a plant, allowed for that look); members with no valid spot are skipped. |
| TW-37 | Real parents | Fixed and tested | `core/lifecycle.js`: parents are the adults fed a breeding item within the last 35 s, closest to the baby. Tested 8 times with an unfed adult standing closer: every baby took a fed parent's look. Breeding by a real player awaits Android. |
| TW-39/40 | Cage state preservation | Fixed and tested | The cage keeps name, baby or adult, growth left, breeding rest left (and health, look). Tested: a named baby came out named, a baby, with its growth time untouched after 40 simulated minutes; a resting parent kept its rest. Aetherseed wilting still counts (on purpose). |

**Also found and fixed:** `world.getAbsoluteTime()` stops when the daylight cycle is off and jumps with `/time set`
(seen on the server), so the 0.0.13 wilting timer froze in such worlds. New `core/clock.js` counts play ticks and is
saved in the world; wilting, growing up and resting use it. Tested: it ran with the daylight cycle off and carried on
after a restart.

## Checkpoint C: companion system (not started)
TW-30 (incapacitation), environmental rescue, TW-31, TW-32, TW-33, Companion Whistle, Guild Table companions.

## Checkpoint D: architecture and expansion (not started; some parts done early)
TW-42 to TW-45 (landmarks) · TW-46 to TW-54 (performance) · TW-55 to TW-57 (integration).
Done early in 0.0.19: TW-49 (spawner records written only when they change); TW-52 (the spawner's death listener only
listens to its own creatures).
