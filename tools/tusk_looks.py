"""Writes the Tuskbeast's client files: one beast, six looks (Director 24 Nov 2026).

Look = kind x build. Kind is q.mark_variant (0 Savanna, 1 Badlands, 2 Tundra; set by biome at spawn).
Build is q.variant (0 wild / tamed: unarmoured model, 1 with a howdah: armoured model).
Wounded is q.skin_id (1 while Wounded): wounded_idle / wounded_walk instead of idle / walk.
Vanilla queries only (Android: no entity properties for looks, no q.attack_time).
Usage: python3 tools/tusk_looks.py
"""
import json, os
RP = os.path.join(os.path.dirname(__file__), "..", "TheWilds_RP")
KINDS = ["savanna", "badlands", "tundra"]
BUILDS = ["", "_armored"]
CLIPS = ["idle", "walk", "wounded_idle", "wounded_walk", "hurt", "death"]

def look(k, b): return f"{KINDS[k]}_tuskbeast{BUILDS[b]}"
def cond(k, b): return f"q.mark_variant == {k} && q.variant == {b}"
LOOKS = [(k, b) for k in range(3) for b in range(2)]

anims = {"face_forward": "animation.wilds.tuskbeast.face_forward",
         "ctrl_move": "controller.animation.wilds.tuskbeast.move", "ctrl_hurt": "controller.animation.wilds.tuskbeast.hurt"}
for k, b in LOOKS:
    for c in CLIPS: anims[f"{look(k, b)}.{c}"] = f"animation.{look(k, b)}.{c}"

entity = {"format_version": "1.10.0", "minecraft:client_entity": {"description": {
    "identifier": "wilds:tuskbeast",
    "materials": {"default": "entity_alphatest"},
    "textures": {look(k, b): f"textures/entity/tuskbeast/{look(k, b)}" for k, b in LOOKS},
    "geometry": {look(k, b): f"geometry.{look(k, b)}" for k, b in LOOKS},
    "animations": anims,
    "scripts": {"animate": ["face_forward", "ctrl_move", "ctrl_hurt"]},
    "render_controllers": ["controller.render.wilds.tuskbeast"],
    "spawn_egg": {"base_color": "#b8894a", "overlay_color": "#5a3b1f"},
    "enable_attachables": False}}}

idx = "q.mark_variant * 2 + q.variant"
rc = {"geometry": f"Array.geos[{idx}]", "materials": [{"*": "Material.default"}], "textures": [f"Array.skins[{idx}]"],
      "arrays": {"geometries": {"Array.geos": [f"Geometry.{look(k, b)}" for k, b in LOOKS]},
                 "textures": {"Array.skins": [f"Texture.{look(k, b)}" for k, b in LOOKS]}}}

def pick(clip, extra=""):
    return [{f"{look(k, b)}.{clip}": f"{cond(k, b)}{extra}"} for k, b in LOOKS]
moving, still = "q.modified_move_speed > 0.05", "q.modified_move_speed <= 0.05"
ac = {"format_version": "1.10.0", "animation_controllers": {
    "controller.animation.wilds.tuskbeast.move": {"initial_state": "idle", "states": {
        "idle": {"animations": pick("idle", " && q.skin_id != 1") + pick("wounded_idle", " && q.skin_id == 1"), "blend_transition": 0.3,
                 "transitions": [{"dead": "!q.is_alive"}, {"walk": moving}]},
        "walk": {"animations": pick("walk", " && q.skin_id != 1") + pick("wounded_walk", " && q.skin_id == 1"), "blend_transition": 0.3,
                 "transitions": [{"dead": "!q.is_alive"}, {"idle": still}]},
        "dead": {"animations": pick("death")}}},
    "controller.animation.wilds.tuskbeast.hurt": {"initial_state": "default", "states": {
        "default": {"transitions": [{"hurt": "q.hurt_time > 0 && q.is_alive"}]},
        "hurt": {"animations": pick("hurt"), "transitions": [{"default": "q.all_animations_finished"}]}}}}}

def write(rel, data):
    with open(os.path.join(RP, rel), "w") as f: json.dump(data, f, indent=2); f.write("\n")
write("entity/tuskbeast.entity.json", entity)
write("animation_controllers/tuskbeast.ac.json", ac)
p = os.path.join(RP, "render_controllers/wilds.rc.json"); d = json.load(open(p))
d["render_controllers"]["controller.render.wilds.tuskbeast"] = rc; write("render_controllers/wilds.rc.json", d)
for rel in ["entity/tuskbeast.entity.json", "animation_controllers/tuskbeast.ac.json"]:
    assert "attack_time" not in open(os.path.join(RP, rel)).read()
print("tuskbeast looks written:", len(LOOKS), "looks,", len(anims) - 3, "clips")
