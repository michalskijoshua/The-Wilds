# The Wilds (Minecraft Bedrock add-on)

Phase 0 prototypes only (build 0.0.17). Works alone; Guilds+ support is optional and detected at runtime.
Owner and Creative Director: michalskijoshua. Read `PHASE0_REPORT.md` first, then `CHANGELOG.md`.

## Layout

| Path | What |
|---|---|
| `TheWilds_BP/` | Behaviour pack: entities, item, recipe, scripts (`@minecraft/server` 2.6.0) |
| `TheWilds_RP/` | Resource pack: client entities, render/animation controllers, geometry, textures |
| `tools/` | `package.ps1` (build `dist/*.mcaddon`), `check_collisions.ps1`, `bds_install` / `bds_run` / `bds_send` (headless server tests: `.ps1` for Windows, `.sh` for Linux) |
| `PHASE0_REPORT.md` | Prototype results, including the server tests on BDS 1.26.65.1 (Windows, then Linux with the newest Guilds+) |
| `CODEX_HANDOFF_TUSKBEAST_MODELS.md` | Model work for Codex: standing archer anchors, kneel and Wounded clips |
| `GUILDS_PATCH_PROPOSAL.md` | Proposed small Guilds+ changes for mounted guards (not applied) |

## Rules (from the owner's handoff)

Bedrock only, no experimental toggles. Never edit Guilds+ files, scripts, identifiers or vanilla entities; every Wilds
identifier, event, world key and script event starts with `wilds:`. Stay inside Phase 0 until the owner approves.
