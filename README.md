# The Wilds (Minecraft Bedrock add-on)

Phase 0 prototypes only (build 0.0.3). Works alone; Guilds+ support is optional and detected at runtime.
Owner and Creative Director: michalskijoshua. Read `PHASE0_REPORT.md` first, then `CHANGELOG.md`.

## Layout

| Path | What |
|---|---|
| `TheWilds_BP/` | Behaviour pack: entities, item, recipe, scripts (`@minecraft/server` 2.6.0) |
| `TheWilds_RP/` | Resource pack: client entities, render/animation controllers, geometry, textures |
| `tools/` | `package.ps1` (build `dist/*.mcaddon`), `check_collisions.ps1`, `bds_install.ps1` / `bds_run.ps1` / `bds_send.ps1` (headless server tests, Windows PowerShell) |
| `PHASE0_REPORT.md` | Prototype results, including the server test on BDS 1.26.65.1 |
| `CODEX_HANDOFF_TUSKBEAST_MODELS.md` | Model work for Codex: standing archer anchors, kneel and Wounded clips |
| `GUILDS_PATCH_PROPOSAL.md` | Proposed one-line Guilds+ change for mounted guards (not applied) |

## Rules (from the owner's handoff)

Bedrock only, no experimental toggles. Never edit Guilds+ files, scripts, identifiers or vanilla entities; every Wilds
identifier, event, world key and script event starts with `wilds:`. Stay inside Phase 0 until the owner approves.
