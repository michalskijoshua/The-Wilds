# Codex handoff: sounds and inventory icons for The Wilds (24 Nov 2026, build 0.0.16)

**Status: delivered and wired in (The Wilds 0.0.18).** 13 icons and 49 sounds.

From: Claude Code (The Wilds). Owner and Creative Director: the user; they approve every look and sound.
Project: Minecraft **Bedrock** add-on `michalskijoshua/The-Wilds` (`main`). The game is played on **Android**.

## What is already done (no work needed)
- **Models and animations are wired in and work:**
  - Tuskbeast: 3 kinds × unarmoured/armoured
  - Pebble Mimic: 10 forms
  - Aetherseed: 3 forms
  - Bloomling: 8 looks
  - Frost Lynx
- **No model changes are asked for.**
- **Spawn egg icons** are generated from the creatures' own textures. No work needed.
- The Tuskbeast model brief (`CODEX_HANDOFF_TUSKBEAST_MODELS.md`) is **closed**; the Director dropped the remaining items.

## What is needed

### 1. Inventory icons (13 PNGs)
Today these items use a placeholder (vanilla iron bars, or rabbit hide for Fur).

| File name (`.png`) | Item in game | What it shows |
|---|---|---|
| `cage_empty` | Cage (empty) | An empty cage: iron bars with a string/handle. It is crafted from 8 iron bars around 1 string. |
| `cage_aetherseed_original` | Caged Aetherseed (Original) | The cage with an Original Aetherseed inside |
| `cage_aetherseed_bloom` | Caged Aetherseed (Bloom) | …with a Bloom Aetherseed |
| `cage_aetherseed_withered` | Caged Aetherseed (Withered) | …with a Withered Aetherseed (purple specks) |
| `cage_bloomling_original` | Caged Bloomling | …with the Original (plains) Bloomling |
| `cage_bloomling_ember_tulip` | Caged Ember Tulip Bloomling | …Ember Tulip |
| `cage_bloomling_sunbonnet` | Caged Sunbonnet Bloomling | …Sunbonnet |
| `cage_bloomling_moonbell` | Caged Moonbell Bloomling | …Moonbell |
| `cage_bloomling_froststar` | Caged Froststar Bloomling | …Froststar |
| `cage_bloomling_poppy_patch` | Caged Poppy Patch Bloomling | …Poppy Patch |
| `cage_bloomling_clover_puff` | Caged Clover Puff Bloomling | …Clover Puff |
| `cage_bloomling_dusk_orchid` | Caged Dusk Orchid Bloomling | …Dusk Orchid |
| `fur` | Frost Lynx Fur | A pale, icy-grey pelt with the lynx's markings (a crafting material; fur armour comes later) |

Rules:
- **16 × 16 px PNG**, transparent background, Minecraft item style (readable at a glance; a child playtests).
- The full cages must be **easy to tell apart**, so the creature's colours inside should carry each look. Use the creature textures already in the pack (`TheWilds_RP/textures/entity/aetherseed/`, `.../bloomling/`).
- All cages share **one cage frame**, so they read as one family.
- Place them in `TheWilds_RP/textures/items/wilds/` with exactly these names. Claude points the items at them; the ids are `wilds_cage_empty`, `wilds_cage_<kind>_<look>` and `wilds_fur` in `TheWilds_RP/textures/item_texture.json`.

### 2. Sounds
Today the creatures are silent or use vanilla stand-ins.

Rules for every sound:
- **`.ogg`, mono**, 44.1 kHz, short (most under 1.5 s), normalised so they sit at the loudness of vanilla mob sounds.
- **2–3 variations** for each idle, hurt and step sound, so they don't repeat; 1 is fine for the rest.
- Nothing scary: no horror (house rule). The Withered seed may sound sad and eerie, but not frightening for a child.
- File layout: `TheWilds_RP/sounds/wilds/<creature>/<name><n>.ogg`, e.g. `sounds/wilds/bloomling/idle1.ogg`.
- **Claude** writes `sound_definitions.json` and wires the events, so only the files and a list are needed.

| Creature | Sound names (`<name>`) | Notes |
|---|---|---|
| **Aetherseed (Original)** | `original_idle`, `original_hurt`, `original_death`, `original_pulse` | A small floating flower spirit. The pulse makes crops grow: soft, warm, magical. |
| **Aetherseed (Bloom)** | `bloom_idle`, `bloom_hurt`, `bloom_death`, `bloom_pulse` | Brighter and more chime-like than Original. The pulse makes flowers spread. |
| **Aetherseed (Withered)** | `withered_idle`, `withered_hurt`, `withered_death`, `withered_pulse`, `withered_snuff`, `withered_summon` | Dry, papery, sad. The pulse makes plants wilt. `snuff`: a torch puffed out. `summon`: a low call as a zombie rises. |
| **Bloomling** (one shared set for all 8 looks) | `idle`, `hurt`, `death`, `eat`, `hop` | A rabbit-sized flower creature. `eat`: nibbling a flower. `hop`: a soft, light footstep. |
| **Frost Lynx** | `idle`, `hurt`, `death`, `flee`, `purr`, `eat`, `trick`, `pounce` | A snowy wild cat. `flee`: a startled hiss as it bolts. `purr`: a tamed lynx near its owner. `eat`: eating raw meat. `trick`: a happy chirp when it does a trick. `pounce`: hunting a rabbit at night. |

## What to send back to Claude Code
1. The 13 PNGs and the sound files, in the folders above. A zip is fine; the Director passes it on.
2. A short list: each sound file, what it is, and its loudness note if any differ.
3. A preview sheet of the 13 icons side by side (one PNG), so the Director can approve them at a glance.

## Not needed now
New creature models (Tumbletusk, Shelltortoise, Carapex, and the rest), fur armour, and the landmark giants: these are not designed yet. The Director will send separate briefs.
