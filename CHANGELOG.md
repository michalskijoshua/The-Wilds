# Changelog

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
