# Changelog

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
