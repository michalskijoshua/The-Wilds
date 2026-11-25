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

## Checkpoint B: existing creature gameplay (not started)
TW-02, TW-18 (Pebble Mimic survival loop) · TW-19, TW-27 (Aetherseed Roost) · TW-20 (collision-safe torch following) ·
TW-25 (Guilds+ crop registry) · TW-36 (Bloomling spawn safety) · TW-37 (real parents) · TW-39, TW-40 (cage state).

## Checkpoint C: companion system (not started)
TW-30 (incapacitation), environmental rescue, TW-31, TW-32, TW-33, Companion Whistle, Guild Table companions.

## Checkpoint D: architecture and expansion (not started; some parts done early)
TW-42 to TW-45 (landmarks) · TW-46 to TW-54 (performance) · TW-55 to TW-57 (integration).
Done early in 0.0.19: TW-49 (spawner records written only when they change); TW-52 (the spawner's death listener only
listens to its own creatures).
