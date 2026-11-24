"""Converts the Director's Blockbench models for the Pebble Mimic and the Aetherseed into the resource pack, and writes
their client entity, render controllers and animation controllers (24 Nov 2026).

Usage: python3 tools/wilds_models.py "<folder holding 'Pebble Mimic' and 'Aetherseed'>"
Looks are picked with q.mark_variant (= the form; the scripts keep it in step with wilds:form). Android: no entity
properties for looks, no q.attack_time.
"""
import json, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from bbmodel_convert import convert_layers

SRC = sys.argv[1]
RP = os.path.join(os.path.dirname(__file__), "..", "TheWilds_RP")
def out(rel): p = os.path.join(RP, rel); os.makedirs(os.path.dirname(p), exist_ok=True); return p
def write(rel, data):
    with open(out(rel), "w") as f: json.dump(data, f, indent=1 if rel.startswith("animations") else 2); f.write("\n")

MIMIC_FORMS = ["stone", "mossy", "sand", "clay", "coal", "copper", "iron", "gold", "diamond", "netherite"]   # = wilds:form
MIMIC_FILE = {f: f"Pebble Mimic/Blockbench/Ore and Shell Variants/Pebble Mimic - {f.title()}.bbmodel" for f in MIMIC_FORMS}
MIMIC_FILE["stone"] = "Pebble Mimic/Blockbench/Pebble Mimic - Animated.bbmodel"
SEED_FORMS = {"original": "Aetherseed - Animated", "bloom": "Aetherseed - Bloom", "withered": "Aetherseed - Withered"}

def build(creature, forms, files, clips, glow):
    """Converts each form; returns {form: geometry ids}. clips: our name -> Blockbench clip name."""
    anims_all, looks = {}, {}
    for f in forms:
        tex = [out(f"textures/entity/{creature}/{creature}_{f}.png")] + ([out(f"textures/entity/{creature}/{creature}_{f}_glow.png")] if glow else [])
        geos, anims, _ = convert_layers(os.path.join(SRC, files[f]), f"geometry.wilds_{creature}_{f}", f"animation.wilds_{creature}_{f}", tex, bounds=(4, 4, 1.5))
        for i, g in enumerate(geos[: len(tex)]): write(f"models/entity/{creature}_{f}{'' if i == 0 else '_glow'}.geo.json", g)
        keep = {k: v for k, v in anims.items() if k.split(".")[-1] in clips.values()}
        missing = set(clips.values()) - {k.split(".")[-1] for k in keep}
        assert not missing, (f, missing)
        anims_all.update(keep); looks[f] = len(geos)
    write(f"animations/{creature}.animation.json", {"format_version": "1.8.0", "animations": anims_all})
    return looks

def client(creature, ident, forms, clips, glow, egg):
    a = {f"{f}.{c}": f"animation.wilds_{creature}_{f}.{b}" for f in forms for c, b in clips.items()}
    a["ctrl"] = f"controller.animation.wilds.{creature}"
    d = {"identifier": ident, "materials": {"default": "entity_alphatest", "glow": "entity_emissive_alpha"},
         "textures": {f: f"textures/entity/{creature}/{creature}_{f}" for f in forms},
         "geometry": {f: f"geometry.wilds_{creature}_{f}" for f in forms},
         "animations": a, "scripts": {"animate": ["ctrl"]},
         "render_controllers": [f"controller.render.wilds.{creature}"] + ([f"controller.render.wilds.{creature}_glow"] if glow else []),
         "spawn_egg": egg}
    if glow:
        d["textures"].update({f"{f}_glow": f"textures/entity/{creature}/{creature}_{f}_glow" for f in forms})
        d["geometry"].update({f"{f}_glow": f"geometry.wilds_{creature}_{f}_layer1" for f in forms})
    write(f"entity/{creature}.entity.json", {"format_version": "1.10.0", "minecraft:client_entity": {"description": d}})
    rcs = {f"controller.render.wilds.{creature}": {"geometry": "Array.g[q.mark_variant]", "materials": [{"*": "Material.default"}], "textures": ["Array.t[q.mark_variant]"],
           "arrays": {"geometries": {"Array.g": [f"Geometry.{f}" for f in forms]}, "textures": {"Array.t": [f"Texture.{f}" for f in forms]}}}}
    if glow:
        rcs[f"controller.render.wilds.{creature}_glow"] = {"geometry": "Array.g[q.mark_variant]", "materials": [{"*": "Material.glow"}], "textures": ["Array.t[q.mark_variant]"],
            "arrays": {"geometries": {"Array.g": [f"Geometry.{f}_glow" for f in forms]}, "textures": {"Array.t": [f"Texture.{f}_glow" for f in forms]}}}
    p = out("render_controllers/wilds.rc.json"); rc = json.load(open(p)); rc["render_controllers"].update(rcs)
    write("render_controllers/wilds.rc.json", rc)
    pick = lambda c: [{f"{f}.{c}": f"q.mark_variant == {i}"} for i, f in enumerate(forms)]
    states = {"idle": {"animations": pick("idle"), "blend_transition": 0.25, "transitions": [{"dead": "!q.is_alive"}, {"hurt": "q.hurt_time > 0"}, {"walk": "q.modified_move_speed > 0.05"}]},
              "walk": {"animations": pick("walk"), "blend_transition": 0.25, "transitions": [{"dead": "!q.is_alive"}, {"hurt": "q.hurt_time > 0"}, {"idle": "q.modified_move_speed <= 0.05"}]},
              "hurt": {"animations": pick("hurt"), "transitions": [{"dead": "!q.is_alive"}, {"idle": "q.all_animations_finished"}]},
              "dead": {"animations": pick("death")}}
    write(f"animation_controllers/{creature}.ac.json", {"format_version": "1.10.0", "animation_controllers": {
        f"controller.animation.wilds.{creature}": {"initial_state": "idle", "states": states}}})
    for rel in (f"entity/{creature}.entity.json", f"animation_controllers/{creature}.ac.json"):
        assert "attack_time" not in open(out(rel)).read()

MIMIC_CLIPS = {"idle": "standing_idle", "walk": "slow_crawl", "hurt": "hit_reaction", "death": "death_collapse"}
SEED_CLIPS = {"idle": "idle_hover", "walk": "gentle_wander", "hurt": "hit_reaction", "death": "death_explosion"}
build("pebble_mimic", MIMIC_FORMS, MIMIC_FILE, MIMIC_CLIPS, glow=False)
client("pebble_mimic", "wilds:pebble_mimic", MIMIC_FORMS, MIMIC_CLIPS, False, {"base_color": "#7d7d7d", "overlay_color": "#c9b27a"})
seed_files = {f: f"Aetherseed/Blockbench/{n}.bbmodel" for f, n in SEED_FORMS.items()}
build("aetherseed", list(SEED_FORMS), seed_files, SEED_CLIPS, glow=True)
client("aetherseed", "wilds:aetherseed", list(SEED_FORMS), SEED_CLIPS, True, {"base_color": "#6fae4b", "overlay_color": "#f2a7d8"})
print("mimic and aetherseed models written")
