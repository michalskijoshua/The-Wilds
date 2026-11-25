"""Frost Lynx (Batch C, 24 Nov 2026): converts the Director's Blockbench model and writes its client files.
Usage: python3 tools/lynx_build.py "<Frost Lynx - Animated.bbmodel>"
Android-safe: no q.attack_time, no entity properties. The pounce/bite and the tricks are started by the script
(Entity.playAnimation), so the client files only switch on vanilla queries (moving speed, hurt, alive; q.skin_id == 1 = told to Stay).
"""
import json, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from bbmodel_convert import convert_layers
RP = os.path.join(os.path.dirname(__file__), "..", "TheWilds_RP")
def out(rel): p = os.path.join(RP, rel); os.makedirs(os.path.dirname(p), exist_ok=True); return p
def write(rel, data, indent=2):
    with open(out(rel), "w") as f: json.dump(data, f, indent=indent); f.write("\n")

geos, anims, _ = convert_layers(sys.argv[1], "geometry.wilds_frost_lynx", "animation.wilds_frost_lynx", [out("textures/entity/frost_lynx/frost_lynx.png")], bounds=(2, 2, 0.7))
write("models/entity/frost_lynx.geo.json", geos[0])
anims["animation.wilds_frost_lynx.face_forward"] = {"loop": True, "bones": {"frost_lynx": {"rotation": [0, 180, 0]}}}   # Codex models face +Z
write("animations/frost_lynx.animation.json", {"format_version": "1.8.0", "animations": anims}, indent=1)
A = lambda n: f"animation.wilds_frost_lynx.{n}"
clips = ["curious_idle", "roam_walk", "flee_sprint", "follow_trot", "sit_down", "sit_idle", "stand_up", "hit_reaction", "death_collapse", "lying_dead"]
for c in clips: assert A(c) in anims, c
entity = {"format_version": "1.10.0", "minecraft:client_entity": {"description": {
    "identifier": "wilds:frost_lynx", "materials": {"default": "entity_alphatest"},
    "textures": {"default": "textures/entity/frost_lynx/frost_lynx"}, "geometry": {"default": "geometry.wilds_frost_lynx"},
    "animations": {"face_forward": A("face_forward"), "move": "controller.animation.wilds.frost_lynx.move",
                   "hurt": "controller.animation.wilds.frost_lynx.hurt", **{c: A(c) for c in clips}},
    "scripts": {"animate": ["face_forward", "move", "hurt"]},
    "render_controllers": ["controller.render.default"],
    "spawn_egg": {"base_color": "#d9e4ea", "overlay_color": "#6f8796"}}}}
write("entity/frost_lynx.entity.json", entity)
run, walk, still = "q.ground_speed > 5.5", "q.ground_speed > 0.4", "q.ground_speed <= 0.4"
ac = {"format_version": "1.10.0", "animation_controllers": {
  "controller.animation.wilds.frost_lynx.move": {"initial_state": "idle", "states": {
    "idle": {"animations": ["curious_idle"], "blend_transition": 0.2,
             "transitions": [{"dead": "!q.is_alive"}, {"down": "q.skin_id == 2"}, {"sit": "q.skin_id == 1"}, {"run": run}, {"walk": walk}]},
    "walk": {"animations": [{"follow_trot": "q.is_tamed"}, {"roam_walk": "!q.is_tamed"}], "blend_transition": 0.2,
             "transitions": [{"dead": "!q.is_alive"}, {"down": "q.skin_id == 2"}, {"sit": "q.skin_id == 1"}, {"run": run}, {"idle": still}]},
    "run": {"animations": ["flee_sprint"], "blend_transition": 0.2,
            "transitions": [{"dead": "!q.is_alive"}, {"down": "q.skin_id == 2"}, {"walk": f"!({run}) && {walk}"}, {"idle": still}]},
    "sit": {"animations": ["sit_down"], "blend_transition": 0.3,
            "transitions": [{"dead": "!q.is_alive"}, {"stand": "q.skin_id != 1"}, {"sitting": "q.all_animations_finished"}]},
    "sitting": {"animations": ["sit_idle"], "blend_transition": 0.2, "transitions": [{"dead": "!q.is_alive"}, {"down": "q.skin_id == 2"}, {"stand": "q.skin_id != 1"}]},
    "stand": {"animations": ["stand_up"], "transitions": [{"idle": "q.all_animations_finished || q.ground_speed > 0.4"}]},
    "dead": {"animations": ["death_collapse"]},
    "down": {"animations": ["death_collapse"], "transitions": [{"lying": "q.all_animations_finished"}, {"stand": "q.skin_id != 2"}]},   # knocked out (0.0.21)
    "lying": {"animations": ["lying_dead"], "transitions": [{"stand": "q.skin_id != 2"}]}}},
  "controller.animation.wilds.frost_lynx.hurt": {"initial_state": "default", "states": {
    "default": {"transitions": [{"hurt": "q.hurt_time > 0 && q.is_alive"}]},
    "hurt": {"animations": ["hit_reaction"], "transitions": [{"default": "q.all_animations_finished"}]}}}}}
write("animation_controllers/frost_lynx.ac.json", ac)
for rel in ("entity/frost_lynx.entity.json", "animation_controllers/frost_lynx.ac.json"):
    assert "attack_time" not in open(out(rel)).read()
print("frost lynx written:", len(anims), "clips")
