"""Mosswing Dragon: REVIEW MODEL ONLY (dragon production is on hold until the Director approves a model).
After the IronHome dragon-mount concept sheet: forest dragon, mossy green scales, cream belly, branching antlers hung with
moss, leafy wings, flowers in the moss, leaf ridge down the tail, riding saddle with a green leaf banner.
Scale: 16 units = 1 block. A Steve-sized player (2 blocks) stands beside him and sits in the saddle.
python3 tools/dragon_mosswing.py [out.png]
"""
import json, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import characters as CH
from characters import Atlas, cube, bone, P, GRID, col, shade, pix, vline, hline, frame, GOLD


def paint():
    a = Atlas(77)
    g, gd, gl = "#5E7A2E", "#3E5420", "#7E9A3E"
    a.fill("scales", g, 0.1, "fur")
    for y in range(0, 16, 3):
        for x in range((y // 3) % 2 * 2, 16, 4):
            a.detail("scales", [(x, y), (x + 1, y)], shade(col(g), 0.78))
    a.fill("scales_top", gd, 0.1, "fur"); a.fill("belly", "#C8B878", 0.06, "cloth"); hline(a, "belly", [3, 7, 11, 15], "#A8985A")
    a.fill("moss", "#4E7A2A", 0.16, "fur")
    a.detail("moss", [(x, y) for x in range(16) for y in range(16) if (x * 7 + y * 3) % 11 == 0], col("#E8A0B0"))
    a.detail("moss", [(x, y) for x in range(16) for y in range(16) if (x * 5 + y * 9) % 13 == 0], col("#F0EEE0"))
    a.fill("vine", "#3E6A22", 0.14, "fur"); vline(a, "vine", [0, 2, 4, 6, 8, 10, 12, 14], "#5E8A32")
    a.fill("antler", "#7A5232", 0.08, "wood"); a.fill("claw", "#E8DCC0", 0.05)
    a.fill("membrane", "#A8B860", 0.06, "cloth")
    for x in (0, 5, 10, 15):
        vline(a, "membrane", [x], "#6E7A30")
    a.fill("wingbone", "#4E5A28", 0.08, "wood")
    for x in range(16):                                            # scalloped, see-through trailing edge
        cut = 15 - int(3 * abs(((x % 5) - 2) / 2))
        for y in range(cut, 16):
            a.px("membrane", x, y, (0, 0, 0, 0))
    a.fill("spike", "#C8B878", 0.06)
    a.fill("face", g, 0.08, "fur"); a.fill("snout_front", g, 0.08, "fur")
    pix(a, "snout_front", ["........", ".n....n.", "........", "tttttttt"], {"n": "#1E2A10", "t": "#E8DCC0"})
    a.fill("head_side", g, 0.08, "fur"); pix(a, "head_side", [".yby.", ".yby.", "..y.."], {"y": "#E0B030", "b": "#1A1A10"}, 3, 3)   # slit pupil: forward from both sides
    a.fill("leather", "#7A4E2A", 0.07, "leather"); a.fill("dark_leather", "#4A3020", 0.07, "leather"); a.fill("gold", GOLD, 0.05, "metal")
    a.fill("banner", "#3E6A3A", 0.06, "cloth"); frame(a, "banner", 6, 9, GOLD)
    pix(a, "banner", ["..g...", ".ggg..", "ggggg.", ".ggg..", "..g..."], {"g": GOLD}, 0, 2)
    # player for scale
    a.fill("p_skin", "#C8946C", 0.03); a.fill("p_hair", "#4A2E1A", 0.1, "fur")
    a.fill("p_face", "#C8946C", 0.03); pix(a, "p_face", ["........", "........", "........", ".wb..bw.", "........", "..mmmm.."], {"w": "#F0F0F0", "b": "#3A4AB0", "m": "#7A4A3A"})
    a.fill("p_shirt", "#3AA8B8", 0.05, "cloth"); a.fill("p_pants", "#3A3A9A", 0.05, "cloth")
    return a


S = 1.25                                                         # the whole dragon is built at 1.25x these numbers


def dragon(a, saddle=True):
    """v3 (20 Nov): slim, segmented, Ender-Dragon-style. Neck and tail are chains of bones (they wave); wings are flat,
    two-part (arm + tip) with see-through scalloped membranes; four separate legs."""
    sc = {"*": "scales", "u": "scales_top", "d": "belly"}
    B = [bone("root", (0, 0, 0))]
    B.append(bone("body", (0, 26, 0), "root", [
        cube(-6, 20, -14, 6, 31, 16, sc, atlas=a),
        cube(-5.5, 18.5, -12, 5.5, 22, 8, "belly", atlas=a),
        cube(-6.4, 28.5, -14, 6.4, 32, -4, "moss", atlas=a)] +
        [cube(-0.6, 31, z, 0.6, 33.5, z + 2, "spike", atlas=a) for z in (-2, 4, 10)]))
    for n, x0, z0, hind in (("leg_fr", -6.5, -12, False), ("leg_fl", 3.5, -12, False), ("leg_br", -7, 8, True), ("leg_bl", 3, 8, True)):
        if hind:
            c = [cube(x0, 14, z0, x0 + 4, 26, z0 + 7, sc, atlas=a), cube(x0 + 0.5, 4, z0 + 4, x0 + 3.5, 15, z0 + 7, sc, atlas=a),
                 cube(x0 + 0.5, 0, z0 - 1, x0 + 3.5, 4, z0 + 6, sc, atlas=a), cube(x0, 0, z0 - 3, x0 + 4, 1.5, z0 - 1, "claw", atlas=a)]
        else:
            c = [cube(x0, 12, z0, x0 + 3, 24, z0 + 4, sc, atlas=a), cube(x0 + 0.3, 1, z0 - 1, x0 + 2.7, 13, z0 + 2, sc, atlas=a),
                 cube(x0 - 0.3, 0, z0 - 3.5, x0 + 3.3, 1.5, z0 + 1, {"*": "scales", "n": "claw"}, atlas=a)]
        B.append(bone(n, (x0 + 2, 25, z0 + 2), "body", c))
    parent, y, z = "body", 27, -14                                   # neck: 6 segments rising forward
    for k in range(6):
        w = 3.4 - k * 0.15; y1 = y + 1.4
        B.append(bone(f"neck{k}", (0, y + 2.5, z), parent, [cube(-w, y, z - 5, w, y + 5.2, z, {"*": "scales", "d": "belly", "u": "scales_top"}, atlas=a),
                                                          cube(-0.5, y + 5.2, z - 3.6, 0.5, y + 7, z - 1.4, "spike", atlas=a)]))
        parent, y, z = f"neck{k}", y1, z - 5
    hy, hz = y, z
    head = [cube(-4, hy, hz - 10, 4, hy + 6.5, hz, {"*": "head_side", "n": "scales", "u": "scales_top", "d": "belly"}, atlas=a),
            cube(-4.4, hy + 5.5, hz - 8, 4.4, hy + 7, hz - 2, "scales_top", atlas=a),
            cube(-2.8, hy + 0.6, hz - 21, 2.8, hy + 4.8, hz - 10, {"*": "scales", "n": "snout_front", "u": "scales_top", "d": "belly"}, atlas=a),
            cube(-2.4, hy - 2, hz - 20, 2.4, hy + 0.6, hz - 4, "belly", atlas=a),
            cube(-2, hy + 0.2, hz - 20.4, 2, hy + 0.8, hz - 10, "claw", atlas=a)]
    for sx in (-1, 1):                                               # swept-back antlers with hanging moss
        x = 2.6 * sx
        head += [cube(x - 0.6, hy + 6.5, hz - 4, x + 0.6, hy + 9, hz - 2.8, "antler", atlas=a),
                 cube(x - 0.6, hy + 8.5, hz - 3, x + 0.6, hy + 9.7, hz + 5, "antler", atlas=a),
                 cube(x - 0.6, hy + 9.2, hz + 4, x + 0.6, hy + 12, hz + 5.2, "antler", atlas=a),
                 cube(x - 0.6 + 1.6 * sx, hy + 9, hz, x + 0.6 + 1.6 * sx, hy + 11.5, hz + 1.2, "antler", atlas=a),
                 cube(x - 0.35, hy + 5.5, hz + 2, x + 0.35, hy + 8.5, hz + 2.7, "vine", atlas=a)]
    B.append(bone("head", (0, hy + 3, hz), parent, head))
    parent, y, z = "body", 22, 16                                    # tail: 10 segments, tapering
    for k in range(10):
        w = 3.6 - k * 0.3; h = 7 - k * 0.5
        c = [cube(-w, y, z, w, y + h, z + 7, sc, atlas=a), cube(-0.4, y + h, z + 2, 0.4, y + h + 1.8 - k * 0.12, z + 4.5, "spike", atlas=a)]
        if k == 9:
            c.append(cube(-3.5, y + 1, z + 5, 3.5, y + 1.6, z + 12, "vine", atlas=a))      # leaf blade
        B.append(bone(f"tail{k}", (0, y + h / 2, z), parent, c))
        parent, y, z = f"tail{k}", y + 0.25, z + 7
    for sx, side in ((1, "l"), (-1, "r")):                           # wings: flat arm + tip, see-through scalloped membranes
        x0 = 6 * sx
        arm = [cube(min(x0, x0 + 26 * sx), 29, -12, max(x0, x0 + 26 * sx), 31.4, -9.6, "wingbone", atlas=a),
               cube(min(x0, x0 + 26 * sx), 29.8, -9.6, max(x0, x0 + 26 * sx), 30.4, 14, {"*": "membrane"}, atlas=a),
               cube(min(x0, x0 + 4 * sx), 28, -12, max(x0, x0 + 4 * sx), 32.4, -2, "moss", atlas=a)]
        B.append(bone(f"wing_{side}", (x0, 30.2, -10.8), "body", arm))
        x1 = x0 + 26 * sx
        tip = [cube(min(x1, x1 + 30 * sx), 29.4, -11.4, max(x1, x1 + 30 * sx), 31, -10.2, "wingbone", atlas=a),
               cube(min(x1, x1 + 30 * sx), 29.85, -10.2, max(x1, x1 + 30 * sx), 30.35, 8, {"*": "membrane"}, atlas=a)]
        for f in (10, 20):
            tip.append(cube(x1 + f * sx - 0.5, 29.6, -10.2, x1 + f * sx + 0.5, 30.6, 6 - f * 0.3, "wingbone", atlas=a))
        B.append(bone(f"wingtip_{side}", (x1, 30.2, -10.8), f"wing_{side}", tip))
    if saddle:
        B.append(bone("saddle", (0, 31, -8), "body", [
            cube(-5, 30.5, -12, 5, 33, -3, {"*": "leather", "u": "dark_leather"}, atlas=a),
            cube(-5, 33, -5, 5, 35, -3, "leather", atlas=a), cube(-1.5, 33, -12, 1.5, 34.2, -10.5, "gold", atlas=a),
            cube(-6.5, 21, -11, -6.1, 31, -5, "banner", atlas=a), cube(6.1, 21, -11, 6.5, 31, -5, "banner", atlas=a),
            cube(-6.6, 19, -8.5, 6.6, 20, -7, "dark_leather", atlas=a)]))
    for b in B:                                                      # build at 1.25x
        b["pivot"] = [v * S for v in b["pivot"]]
        for c in b.get("cubes", []):
            c["origin"] = [v * S for v in c["origin"]]; c["size"] = [v * S for v in c["size"]]
    return B


def player(a, dx, dz, seated=False, base=0):
    """A Steve-sized figure (2 blocks tall) for scale."""
    if seated:                                                                     # in the saddle: legs forward and down the flanks
        y = base
        return [bone("p_root", (dx, y, dz), None, [
            cube(dx - 4, y + 3, dz - 2, dx + 4, y + 15, dz + 2, "p_shirt", atlas=a),
            cube(dx - 4, y + 15, dz - 4, dx + 4, y + 23, dz + 4, {"*": "p_skin", "n": "p_face", "u": "p_hair", "s": "p_hair"}, atlas=a),
            cube(dx - 8, y + 3, dz - 2, dx - 4, y + 15, dz + 2, "p_shirt", atlas=a), cube(dx + 4, y + 3, dz - 2, dx + 8, y + 15, dz + 2, "p_shirt", atlas=a),
            cube(dx - 10.5, y - 7, dz - 6, dx - 6.5, y + 3, dz - 2, "p_pants", atlas=a), cube(dx + 6.5, y - 7, dz - 6, dx + 10.5, y + 3, dz - 2, "p_pants", atlas=a)])]
    return [bone("p_root", (dx, 0, dz), None, [
        cube(dx - 4, 0, dz - 2, dx, 12, dz + 2, "p_pants", atlas=a), cube(dx, 0, dz - 2, dx + 4, 12, dz + 2, "p_pants", atlas=a),
        cube(dx - 4, 12, dz - 2, dx + 4, 24, dz + 2, "p_shirt", atlas=a),
        cube(dx - 8, 12, dz - 2, dx - 4, 24, dz + 2, "p_shirt", atlas=a), cube(dx + 4, 12, dz - 2, dx + 8, 24, dz + 2, "p_shirt", atlas=a),
        cube(dx - 4, 24, dz - 4, dx + 4, 32, dz + 4, {"*": "p_skin", "n": "p_face", "u": "p_hair", "s": "p_hair"}, atlas=a)])]


def geo(bones):
    for b in bones:
        if b.get("parent") is None:
            b.pop("parent", None)
    return {"format_version": "1.12.0", "minecraft:geometry": [{"description": {
        "identifier": "geometry.ironhome.dragon_mosswing", "texture_width": P * GRID, "texture_height": P * GRID,
        "visible_bounds_width": 7, "visible_bounds_height": 6, "visible_bounds_offset": [0, 2.5, 0]}, "bones": bones}]}


def view(MP, g, tex, mode, scale=3.2, size=(520, 470), origin=(260, 410), title=None):
    """Straight views like the concept sheet, tilted a little from above. mode: side (from his left), front."""
    import numpy as np
    from PIL import Image, ImageDraw, ImageFont
    W, H = size; ox, oy = origin
    rgba = np.zeros((H, W, 4), np.uint8); rgba[...] = (44, 44, 48, 255); zbuf = np.full((H, W), -1e9)
    if mode == "side":
        Pp = lambda x, y, z: (ox - z * scale, oy - y * scale * 0.97 + x * 0.25 * scale); D = lambda x, y, z: x + 0.25 * y
        faces = lambda x0, y0, z0, x1, y1, z1, uv: (([(x0, y1, z0), (x0, y1, z1), (x1, y1, z1), (x1, y1, z0)], uv.get("up"), 1.0),
                                                     ([(x1, y1, z0), (x1, y1, z1), (x1, y0, z1), (x1, y0, z0)], uv.get("west"), 0.8))
    else:
        Pp = lambda x, y, z: (ox + x * scale, oy - y * scale * 0.97 - z * 0.25 * scale); D = lambda x, y, z: -z + 0.25 * y
        faces = lambda x0, y0, z0, x1, y1, z1, uv: (([(x0, y1, z1), (x1, y1, z1), (x1, y1, z0), (x0, y1, z0)], uv.get("up"), 1.0),
                                                     ([(x0, y1, z0), (x1, y1, z0), (x1, y0, z0), (x0, y0, z0)], uv.get("north"), 0.85))
    for (x0, y0, z0, x1, y1, z1, uv, _) in MP.cubes_of(g):
        for corners, fuv, k in faces(x0, y0, z0, x1, y1, z1, uv):
            if not fuv:
                continue
            quad = [Pp(*c) for c in corners]; u, v = fuv["uv"]; w, h = fuv.get("uv_size", [16, 16])
            xs = [q[0] for q in quad]; ys = [q[1] for q in quad]
            bx0, by0 = max(0, int(min(xs))), max(0, int(min(ys))); bx1, by1 = min(W, int(max(xs)) + 1), min(H, int(max(ys)) + 1)
            if bx1 - bx0 < 1 or by1 - by0 < 1:
                continue
            dst = [(qx - bx0, qy - by0) for qx, qy in quad]
            try:
                co = MP._coeffs(dst, [(u, v), (u + w, v), (u + w, v + h), (u, v + h)])
                A = np.array([[quad[i][0], quad[i][1], 1] for i in range(3)]); a_, b_, c_ = np.linalg.solve(A, np.array([D(*corners[i]) for i in range(3)]))
            except np.linalg.LinAlgError:
                continue
            patch = np.array(MP._shade(tex.transform((bx1 - bx0, by1 - by0), Image.PERSPECTIVE, co, Image.NEAREST), k))
            mask = Image.new("L", (bx1 - bx0, by1 - by0), 0); ImageDraw.Draw(mask).polygon(dst, fill=255)
            yy, xx = np.mgrid[by0:by1, bx0:bx1]; depth = a_ * (xx + 0.5) + b_ * (yy + 0.5) + c_
            win = (np.array(mask) > 0) & (patch[..., 3] > 0) & (depth > zbuf[by0:by1, bx0:bx1])
            zbuf[by0:by1, bx0:bx1][win] = depth[win]; rgba[by0:by1, bx0:bx1][win] = patch[win]
    img = Image.fromarray(rgba, "RGBA")
    if title:
        ImageDraw.Draw(img).text((12, 10), title, fill=(255, 220, 150), font=ImageFont.truetype("DejaVuSans-Bold.ttf", 17))
    return img


if __name__ == "__main__":
    import tempfile
    from PIL import Image
    sys.path.insert(0, str(CH.ROOT / "parts" / "forgeworks" / "tools"))
    import model_preview as MP
    out = Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/mosswing.png")
    a = paint(); tmp = Path(tempfile.mkdtemp()); a.save(tmp / "t.png"); tex = Image.open(tmp / "t.png").convert("RGBA")
    v0 = view(MP, geo(dragon(a) + player(a, -24, -40)), tex, "front", title="Front", size=(640, 470), origin=(320, 420))
    v1 = view(MP, geo(dragon(a) + player(a, 20, -30)), tex, "side", title="Side (player for scale)", size=(640, 470), origin=(400, 420))
    v2 = view(MP, geo(dragon(a) + player(a, 0, -8 * S, seated=True, base=35 * S - 1)), tex, "side", title="Ridden", size=(640, 470), origin=(400, 420))
    v3 = view(MP, CH.turned(geo(dragon(a))), tex, "front", title="Back", size=(640, 470), origin=(320, 420))
    MP.sheet([v0, v1, v2, v3], out, cols=2, label="Mosswing Dragon: review model v3 (not in the game; dragon production on hold)")
    print(out)
