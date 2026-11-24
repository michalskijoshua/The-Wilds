"""Bloomling (Batch D, 24 Nov 2026): copies Codex's 8 Bedrock looks in and writes the client files.
Usage: python3 tools/bloomling_build.py "<Bloomling/Bedrock folder>"
Look = q.mark_variant (0..7, order of LOOKS). Babies are q.is_baby. Vanilla queries only (Android).
Each model gets the same armor_offset.default_neck marker on its root (several models on one entity: see Tuskbeast).
"""
import json, os, shutil, sys
SRC = sys.argv[1]
RP = os.path.join(os.path.dirname(__file__), "..", "TheWilds_RP")
LOOKS = ["original", "ember_tulip", "sunbonnet", "moonbell", "froststar", "poppy_patch", "clover_puff", "dusk_orchid"]
src_name = lambda l: "bloomling" if l == "original" else f"bloomling_{l}"
CLIPS = ["idle", "hop", "graze", "hurt", "death"]
def out(rel): p = os.path.join(RP, rel); os.makedirs(os.path.dirname(p), exist_ok=True); return p
def write(rel, data, indent=2):
    with open(out(rel), "w") as f: json.dump(data, f, indent=indent); f.write("\n")

anims_all = {}
for l in LOOKS:
    n = src_name(l)
    g = json.load(open(os.path.join(SRC, "models/entity", f"{n}.geo.json")))
    for b in g["minecraft:geometry"][0]["bones"]:
        b.pop("locators", None)
        if not b.get("parent"): b["locators"] = {"armor_offset.default_neck": [0, 0, 0]}
    g["minecraft:geometry"][0]["description"]["identifier"] = f"geometry.wilds_bloomling_{l}"
    write(f"models/entity/bloomling_{l}.geo.json", g)
    a = json.load(open(os.path.join(SRC, "animations", f"{n}.animation.json")))["animations"]
    for c in CLIPS: anims_all[f"animation.wilds_bloomling_{l}.{c}"] = a[f"animation.{n}.{c}"]
    shutil.copy(os.path.join(SRC, "textures/entity", f"{n}.png"), out(f"textures/entity/bloomling/bloomling_{l}.png"))
anims_all["animation.wilds_bloomling.face_forward"] = {"loop": True, "bones": {"root": {"rotation": [0, 180, 0]}}}
write("animations/bloomling.animation.json", {"format_version": "1.8.0", "animations": anims_all}, indent=1)

an = {"face_forward": "animation.wilds_bloomling.face_forward", "ctrl": "controller.animation.wilds.bloomling", "ctrl_hurt": "controller.animation.wilds.bloomling.hurt"}
for l in LOOKS:
    for c in CLIPS: an[f"{l}.{c}"] = f"animation.wilds_bloomling_{l}.{c}"
write("entity/bloomling.entity.json", {"format_version": "1.10.0", "minecraft:client_entity": {"description": {
    "identifier": "wilds:bloomling", "materials": {"default": "entity_alphatest"},
    "textures": {l: f"textures/entity/bloomling/bloomling_{l}" for l in LOOKS},
    "geometry": {l: f"geometry.wilds_bloomling_{l}" for l in LOOKS},
    "animations": an, "scripts": {"animate": ["face_forward", "ctrl", "ctrl_hurt"]},
    "render_controllers": ["controller.render.wilds.bloomling"],
    "spawn_egg": {"base_color": "#8fcf6a", "overlay_color": "#f4a6c8"}}}})
p = out("render_controllers/wilds.rc.json"); rc = json.load(open(p))
rc["render_controllers"]["controller.render.wilds.bloomling"] = {"geometry": "Array.g[q.mark_variant]", "materials": [{"*": "Material.default"}],
    "textures": ["Array.t[q.mark_variant]"], "arrays": {"geometries": {"Array.g": [f"Geometry.{l}" for l in LOOKS]}, "textures": {"Array.t": [f"Texture.{l}" for l in LOOKS]}}}
write("render_controllers/wilds.rc.json", rc)
pick = lambda c: [{f"{l}.{c}": f"q.mark_variant == {i}"} for i, l in enumerate(LOOKS)]
write("animation_controllers/bloomling.ac.json", {"format_version": "1.10.0", "animation_controllers": {
  "controller.animation.wilds.bloomling": {"initial_state": "idle", "states": {
    "idle": {"animations": pick("idle"), "blend_transition": 0.2, "transitions": [{"dead": "!q.is_alive"}, {"hop": "q.ground_speed > 0.3"}]},
    "hop": {"animations": pick("hop"), "blend_transition": 0.2, "transitions": [{"dead": "!q.is_alive"}, {"idle": "q.ground_speed <= 0.3"}]},
    "dead": {"animations": pick("death")}}},
  "controller.animation.wilds.bloomling.hurt": {"initial_state": "default", "states": {
    "default": {"transitions": [{"hurt": "q.hurt_time > 0 && q.is_alive"}]},
    "hurt": {"animations": pick("hurt"), "transitions": [{"default": "q.all_animations_finished"}]}}}}})
for rel in ("entity/bloomling.entity.json", "animation_controllers/bloomling.ac.json"): assert "attack_time" not in open(out(rel)).read()
print("bloomling written:", len(LOOKS), "looks")
