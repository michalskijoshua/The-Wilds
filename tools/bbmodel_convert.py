"""Copied from Guilds+ tools/bbmodel_convert.py (24 Nov 2026), unchanged.
Blockbench (.bbmodel, free format, per-face UV) -> Bedrock geometry 1.12 + animation + texture.
Bedrock mirrors X: cube origin = [-to.x, from.y, from.z], pivots [-x, y, z], rotations [-rx, -ry, rz]."""
import base64, json
from pathlib import Path


def convert(path, geo_id, anim_prefix, tex_out):
    m = json.loads(Path(path).read_text())
    W, H = m["resolution"]["width"], m["resolution"]["height"]
    els = {e["uuid"]: e for e in m["elements"]}
    src = m["textures"][0]["source"].split(",", 1)[1]
    Path(tex_out).write_bytes(base64.b64decode(src))
    bones, names = [], {}

    def walk(node, parent):
        name = node["name"].replace(" ", "_").lower()
        while name in names: name += "_"
        names[name] = node["uuid"]
        o = node.get("origin", [0, 0, 0])
        bone = {"name": name, "pivot": [-o[0], o[1], o[2]], "cubes": []}
        if parent: bone["parent"] = parent
        for ch in node.get("children", []):
            if isinstance(ch, str):
                e = els[ch]; f, t = e["from"], e["to"]
                cube = {"origin": [-t[0], f[1], f[2]], "size": [t[0] - f[0], t[1] - f[1], t[2] - f[2]], "uv": {}}
                r = e.get("rotation", [0, 0, 0])
                if any(r):
                    eo = e["origin"]; cube["pivot"] = [-eo[0], eo[1], eo[2]]; cube["rotation"] = [-r[0], -r[1], r[2]]
                for face, fd in e["faces"].items():
                    if fd.get("texture") is None: continue
                    u = fd["uv"]; cube["uv"][face] = {"uv": [u[0], u[1]], "uv_size": [u[2] - u[0], u[3] - u[1]]}
                bone["cubes"].append(cube)
        bones.append(bone)
        for ch in node.get("children", []):
            if isinstance(ch, dict): walk(ch, name)
    for root in m["outliner"]:
        walk(root, None)
    geo = {"format_version": "1.12.0", "minecraft:geometry": [{"description": {"identifier": geo_id, "texture_width": W, "texture_height": H,
            "visible_bounds_width": 8, "visible_bounds_height": 11, "visible_bounds_offset": [0, 4.5, 0]}, "bones": bones}]}
    by_uuid = {v: k for k, v in names.items()}
    anims = {}
    for a in m.get("animations", []):
        bones_a = {}
        for uid, an in a["animators"].items():
            bn = by_uuid.get(uid)
            if not bn: continue
            ch = {}
            for kf in an["keyframes"]:
                d = kf["data_points"][0]; vals = [float(d["x"]), float(d["y"]), float(d["z"])]
                if kf["channel"] == "rotation": vals = [-vals[0], -vals[1], vals[2]]
                elif kf["channel"] == "position": vals = [-vals[0], vals[1], vals[2]]
                ch.setdefault(kf["channel"], {})[f"{kf['time']:.4g}"] = vals
            bones_a[bn] = ch
        key = f"{anim_prefix}.{a['name'].replace(' ', '_').lower()}"
        anims[key] = {"loop": a.get("loop") == "loop", "animation_length": a["length"], "bones": bones_a}
    return geo, anims


def convert_layers(path, geo_prefix, anim_prefix, tex_outs, bounds=(8, 11, 4.5)):
    """Like convert(), for models with several textures (e.g. masonry + a glow layer).
    Returns ([geo per texture], anims, locators). Every geometry carries the full bone tree (so one set of animations
    moves all layers) but only the faces drawn with its own texture. tex_outs[i] receives texture i (None: not written)."""
    m = json.loads(Path(path).read_text())
    W, H = m["resolution"]["width"], m["resolution"]["height"]
    els = {e["uuid"]: e for e in m["elements"]}
    for i, t in enumerate(m["textures"]):
        if i < len(tex_outs) and tex_outs[i]:
            Path(tex_outs[i]).write_bytes(base64.b64decode(t["source"].split(",", 1)[1]))
    n = len(m["textures"])
    layers, names, locators = [[] for _ in range(n)], {}, {}
    imgs = {}

    def clear(li, u):
        import io
        from PIL import Image
        if li not in imgs:
            imgs[li] = Image.open(io.BytesIO(base64.b64decode(m["textures"][li]["source"].split(",", 1)[1]))).convert("RGBA")
        im = imgs[li]; sx, sy = im.width / W, im.height / H
        x0, x1 = sorted((u[0], u[2])); y0, y1 = sorted((u[1], u[3]))
        xs = range(int(x0 * sx), max(int(x1 * sx), int(x0 * sx) + 1)); ys = range(int(y0 * sy), max(int(y1 * sy), int(y0 * sy) + 1))
        return all(im.getpixel((min(x, im.width - 1), min(y, im.height - 1)))[3] == 0 for x in xs for y in ys)

    def walk(node, parent):
        name = node["name"].replace(" ", "_").lower()
        while name in names: name += "_"
        names[name] = node["uuid"]
        o = node.get("origin", [0, 0, 0])
        bones = [{"name": name, "pivot": [-o[0], o[1], o[2]], "cubes": []} for _ in range(n)]
        for b in bones:
            if parent: b["parent"] = parent
        for ch in node.get("children", []):
            if not isinstance(ch, str): continue
            e = els[ch]
            if e.get("type") == "locator":
                p = e.get("position", [0, 0, 0]); locators[e["name"]] = [-p[0], p[1], p[2]]
                bones[0].setdefault("locators", {})[e["name"]] = [-p[0], p[1], p[2]]
                continue
            f, t = e["from"], e["to"]
            r = e.get("rotation", [0, 0, 0])
            for li in range(n):
                cube = {"origin": [-t[0], f[1], f[2]], "size": [t[0] - f[0], t[1] - f[1], t[2] - f[2]], "uv": {}}
                if any(r):
                    eo = e["origin"]; cube["pivot"] = [-eo[0], eo[1], eo[2]]; cube["rotation"] = [-r[0], -r[1], r[2]]
                for face, fd in e["faces"].items():
                    if fd.get("texture") != li: continue
                    u = fd["uv"]
                    if li > 0 and clear(li, u): continue          # an overlay face over fully see-through pixels draws nothing
                    cube["uv"][face] = {"uv": [u[0], u[1]], "uv_size": [u[2] - u[0], u[3] - u[1]]}
                if cube["uv"]: bones[li]["cubes"].append(cube)
        for li in range(n): layers[li].append(bones[li])
        for ch in node.get("children", []):
            if isinstance(ch, dict): walk(ch, name)
    for root in m["outliner"]:
        walk(root, None)
    geos = [{"format_version": "1.12.0", "minecraft:geometry": [{"description": {"identifier": f"{geo_prefix}" + ("" if li == 0 else f"_layer{li}"),
             "texture_width": W, "texture_height": H, "visible_bounds_width": bounds[0], "visible_bounds_height": bounds[1],
             "visible_bounds_offset": [0, bounds[2], 0]}, "bones": layers[li]}]} for li in range(n)]
    by_uuid = {v: k for k, v in names.items()}
    anims = {}
    for a in m.get("animations", []):
        bones_a = {}
        for uid, an in a["animators"].items():
            bn = by_uuid.get(uid)
            if not bn: continue
            ch = {}
            for kf in an["keyframes"]:
                d = kf["data_points"][0]; vals = [float(d["x"]), float(d["y"]), float(d["z"])]
                if kf["channel"] == "rotation": vals = [-vals[0], -vals[1], vals[2]]
                elif kf["channel"] == "position": vals = [-vals[0], vals[1], vals[2]]
                ch.setdefault(kf["channel"], {})[f"{kf['time']:.4g}"] = vals
            bones_a[bn] = ch
        key = f"{anim_prefix}.{a['name'].split('.')[-1].replace(' ', '_').lower()}"     # "animation.foundry.idle" -> idle
        loop = {"loop": True, "hold": "hold_on_last_frame"}.get(a.get("loop"), False)
        anims[key] = {"loop": loop, "animation_length": a["length"], "bones": bones_a}
    return geos, anims, locators
