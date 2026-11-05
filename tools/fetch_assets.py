#!/usr/bin/env python3
"""
Appearium asset pipeline.

Downloads CC0 assets from Poly Haven (textures + small models), the CC-BY Fox and
CC0 Barramundi fish from the Khronos glTF sample repository, the three.js water normal map, then resizes / composites / optimises everything into ./assets.

Usage:  python3 tools/fetch_assets.py   (needs: Pillow, numpy, node + @gltf-transform/cli)
Run `npm install` in tools/ first (gltf-transform, meshoptimizer, sharp); set NODE_PATH to its node_modules.
"""
import io, json, math, os, random, shutil, subprocess, sys, urllib.request
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets"
CACHE = Path(os.environ.get("ASSET_CACHE", "/tmp/appearium_cache"))
PH = "https://dl.polyhaven.org/file/ph-assets"

def get(url, dest=None):
    dest = dest or CACHE / url.split("://", 1)[1].replace("/", "_")
    dest = Path(dest)
    if not dest.exists():
        dest.parent.mkdir(parents=True, exist_ok=True)
        print("  fetch", url)
        with urllib.request.urlopen(url) as r:
            dest.write_bytes(r.read())
    return dest

# ---------------------------------------------------------------- textures
TERRAIN = [  # name -> poly haven id
    "leafy_grass", "sparse_grass", "aerial_grass_rock", "forest_ground_04", "brown_mud_leaves_01",
    "forrest_ground_01", "aerial_rocks_02", "rock_face", "rocky_terrain_02", "coast_sand_rocks_02",
    "mud_forest", "snow_02", "gravel_floor", "dry_riverbed_rock",
    "red_sandstone_wall", "sandstone_cracks", "aerial_beach_01", "red_dirt_mud_01", "dry_ground_rocks", "gravel_road",
    "forest_leaves_04", "forest_floor", "cliff_side", "rock_wall_08", "aerial_rocks_04", "grass_path_2", "forest_leaves_03", "aerial_ground_rock", "coast_land_rocks_01",
]
BUILD = [
    "weathered_planks", "rough_wood", "thatch_roof_angled", "roof_tiles_14", "plastered_stone_wall",
    "castle_brick_07", "cobblestone_floor_08", "wood_planks_grey", "stone_wall", "bark_brown_02", "pine_bark",
]

def tex(name, size, folder, maps=("diff", "nor_gl"), quality=84):
    d = OUT / "tex" / folder
    d.mkdir(parents=True, exist_ok=True)
    for m in maps:
        out = d / f"{name}_{m.split('_')[0]}.jpg"
        if out.exists():
            continue
        src = get(f"{PH}/Textures/jpg/1k/{name}/{name}_{m}_1k.jpg")
        im = Image.open(src).convert("RGB").resize((size, size), Image.LANCZOS)
        im.save(out, quality=quality, optimize=True)

# ---------------------------------------------------------------- foliage cards
def rgba(diff_url, alpha_url=None):
    d = Image.open(get(diff_url)).convert("RGBA")
    if alpha_url:
        a = Image.open(get(alpha_url)).convert("L")
        d.putalpha(a)
    return d

def dilate_rgb(im):
    """Bleed colour into transparent pixels so mipmaps don't create dark/white fringes."""
    a = np.array(im).astype(np.float32)
    rgb, al = a[..., :3], a[..., 3:4] / 255.0
    acc = rgb * al
    w = al.copy()
    for r in (2, 4, 8, 16, 32):
        acc_b = np.array(Image.fromarray(np.clip(acc, 0, 255).astype(np.uint8)).filter(ImageFilter.BoxBlur(r))).astype(np.float32)
        w_b = np.array(Image.fromarray((w[..., 0] * 255).astype(np.uint8)).filter(ImageFilter.BoxBlur(r))).astype(np.float32)[..., None] / 255.0
        fill = acc_b / np.maximum(w_b, 1e-3)
        mask = (w < 0.01)
        rgb = np.where(mask, fill, rgb)
        acc = rgb * np.maximum(w, w_b)
        w = np.maximum(w, (w_b > 0.01).astype(np.float32))
    out = np.concatenate([np.clip(rgb, 0, 255), a[..., 3:4]], axis=-1).astype(np.uint8)
    return Image.fromarray(out, "RGBA")

def largest_component(im):
    from scipy import ndimage
    a = np.array(im)
    lab, n = ndimage.label(a[..., 3] > 40)
    if n > 1:
        sizes = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
        keep = 1 + int(np.argmax(sizes))
        a[..., 3] = np.where(ndimage.binary_dilation(lab == keep, iterations=2), a[..., 3], 0)
    return Image.fromarray(a, "RGBA")

def conifer_card():
    """Composite a full fir branch (stem + many sprays) from the Poly Haven fir_tree_01 twig atlas."""
    out = OUT / "tex" / "foliage" / "conifer_branch.png"
    if out.exists():
        return
    base = f"{PH}/Models/png/1k/fir_tree_01/fir_tree_01_twig_"
    at = rgba(base + "diff_1k.png", base + "alpha_1k.png")
    sprays = [largest_component(at.crop(b)) for b in [(313, 400, 655, 800), (650, 455, 985, 855), (190, 40, 445, 325), (665, 35, 965, 385), (505, 255, 645, 405)]]
    W, H = 1024, 512
    card = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    rnd = random.Random(7)
    # main stem
    dr = ImageDraw.Draw(card)
    dr.line([(0, H // 2), (W - 40, H // 2 - 10)], fill=(74, 56, 38, 255), width=9)
    # sprays along the stem, tips pointing outwards (to +x), alternating sides
    for i in range(40):
        t = i / 39.0
        x = 30 + t * (W - 170)
        sp = rnd.choice(sprays)
        scale = (0.42 + 0.42 * (1 - abs(t - 0.55))) * rnd.uniform(0.75, 1.0)
        s = sp.resize((max(8, int(sp.width * scale)), max(8, int(sp.height * scale))), Image.LANCZOS)
        side = -1 if i % 2 else 1
        ang = -90 + side * rnd.uniform(15, 42)  # tip along +x, fanned to the side
        r = s.rotate(ang, expand=True, resample=Image.BICUBIC)
        y = H // 2 - r.height // 2 + side * rnd.uniform(5, 38) * (0.5 + t * 0.6)
        y = max(10, min(H - r.height - 10, y))
        card.alpha_composite(r, (int(x - r.width * 0.2), int(y)))
    tip = sprays[0].resize((200, 230)).rotate(-90, expand=True, resample=Image.BICUBIC)
    card.alpha_composite(tip, (W - tip.width - 10, H // 2 - tip.height // 2))
    # re-centre vertically on the stem so the card hinges at its middle
    a = np.array(card)[..., 3].astype(np.float32)
    cy = (a.sum(1) * np.arange(H)).sum() / max(a.sum(), 1)
    shifted = Image.new("RGBA", (W, H), (0, 0, 0, 0)); shifted.alpha_composite(card, (0, int(H / 2 - cy)))
    # feather the card border so no spray is ever cut by a straight edge
    a = np.array(shifted).astype(np.float32)
    yy, xx = np.mgrid[0:H, 0:W]
    edge = np.minimum.reduce([xx / (W * 0.03 + 1), (W - 1 - xx) / (W * 0.06), yy / (H * 0.1), (H - 1 - yy) / (H * 0.1)])
    a[..., 3] *= np.clip(edge, 0, 1)
    shifted = Image.fromarray(a.astype(np.uint8), "RGBA")
    card = dilate_rgb(shifted).resize((512, 256), Image.LANCZOS)
    out.parent.mkdir(parents=True, exist_ok=True)
    card.save(out, optimize=True)

def leaf_card():
    """Composite a broadleaf twig cluster from Poly Haven island_tree_02 leaf scans."""
    out = OUT / "tex" / "foliage" / "leaf_cluster.png"
    if out.exists():
        return
    at = Image.open(get(f"{PH}/Models/png/1k/island_tree_02/island_tree_02_leaves_diff_1k.png")).convert("RGBA")
    # individual leaves, laid out in two rows in the atlas (approx 1k coords)
    leaves = []
    arr = np.array(at)[..., 3]
    cols = [(10, 160), (160, 310), (315, 455), (455, 610), (610, 780)]
    for (y0, y1) in [(20, 420), (600, 1010)]:
        for (x0, x1) in cols:
            crop = at.crop((x0, y0, x1, y1))
            bb = crop.getbbox()
            if bb:
                leaves.append(crop.crop(bb))
    W = H = 1024
    card = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    dr = ImageDraw.Draw(card)
    rnd = random.Random(3)
    cx, cy = W / 2, H * 0.92
    # twigs radiating upwards from bottom centre
    tips = []
    for k in range(7):
        a = math.radians(-90 + (k - 3) * 22 + rnd.uniform(-6, 6))
        L = rnd.uniform(560, 820)
        ex, ey = cx + math.cos(a) * L, cy + math.sin(a) * L
        dr.line([(cx, cy), (ex, ey)], fill=(70, 58, 40, 255), width=6)
        tips.append((a, L))
    for k, (a, L) in enumerate(tips):
        n = 9
        for j in range(n):
            t = 0.25 + 0.75 * j / (n - 1)
            px, py = cx + math.cos(a) * L * t, cy + math.sin(a) * L * t
            lf = rnd.choice(leaves)
            sc = rnd.uniform(0.42, 0.6)
            lf = lf.resize((max(4, int(lf.width * sc)), max(4, int(lf.height * sc))), Image.LANCZOS)
            side = 1 if j % 2 else -1
            ang = math.degrees(-a) - 90 + side * rnd.uniform(25, 60)
            r = lf.rotate(ang, expand=True, resample=Image.BICUBIC)
            card.alpha_composite(r, (int(px - r.width / 2), int(py - r.height / 2)))
    card = dilate_rgb(card).resize((512, 512), Image.LANCZOS)
    card.save(out, optimize=True)

def grass_card():
    """Grass tuft strip from Poly Haven grass_medium_01 atlas (bottom row of clumps)."""
    out = OUT / "tex" / "foliage" / "grass_tufts.png"
    if out.exists():
        return
    at = Image.open(get(f"{PH}/Models/png/1k/grass_medium_01/grass_medium_01_diff_1k.png")).convert("RGBA")
    crop = at.crop((200, 740, 840, 1024))
    crop = dilate_rgb(crop).resize((512, 228), Image.LANCZOS)
    crop.save(out, optimize=True)

# ---------------------------------------------------------------- models
MODELS = {  # id: (simplify ratio, texture size[, simplify error])
    "fern_02": (0.5, 256), "shrub_02": (0.25, 512), "dandelion_01": (0.15, 256, 0.05), "celandine_01": (0.5, 256),
    "nettle_plant": (0.2, 256, 0.05), "rock_moss_set_01": (0.08, 512),
    "rock_07": (0.15, 512), "tree_stump_01": (0.12, 512), "dead_tree_trunk": (0.06, 512),
    "wooden_crate_01": (0.5, 256), "wooden_bucket_01": (0.4, 256), "ceramic_vase_01": (0.3, 256),
    "antique_ceramic_vase_01": (0.25, 256), "brass_vase_01": (0.25, 256), "wooden_axe": (0.4, 256),
}

def polyhaven_model(mid, ratio, size, err=0.02):
    out = OUT / "models" / f"{mid}.glb"
    if out.exists():
        return
    work = CACHE / "models" / mid
    gl = get(f"{PH}/Models/gltf/1k/{mid}/{mid}_1k.gltf", work / f"{mid}_1k.gltf")
    g = json.loads(gl.read_text())
    for b in g["buffers"]:
        get(f"{PH}/Models/gltf/1k/{mid}/{b['uri']}", work / b["uri"])
    for im in g.get("images", []):
        fname = Path(im["uri"]).name
        if "_diff_" in fname:
            # png variant keeps the alpha cut-out for foliage
            fname = fname.replace(".jpg", ".png")
            get(f"{PH}/Models/png/1k/{mid}/{fname}", work / "textures" / fname)
            im["uri"] = "textures/" + fname
            im["mimeType"] = "image/png"
        else:
            get(f"{PH}/Models/jpg/1k/{mid}/{fname}", work / "textures" / fname)
    patched = work / f"{mid}_patched.gltf"
    patched.write_text(json.dumps(g))
    optimise(patched, out, ratio, size, err)

def optimise(src, out, ratio, size, err=0.02):
    out.parent.mkdir(parents=True, exist_ok=True)
    cmd = ["node", str(ROOT / "tools" / "optimize_glb.mjs"), str(src), str(out), str(ratio), str(size), str(err)]
    print("  optimise", out.name)
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL)

def misc():
    m = OUT / "models"
    m.mkdir(parents=True, exist_ok=True)
    fox = m / "fox.glb"
    if not fox.exists():
        shutil.copy(get("https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/Fox/glTF-Binary/Fox.glb"), fox)
    fish = m / "fish.glb"
    if not fish.exists():
        src = get("https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/BarramundiFish/glTF-Binary/BarramundiFish.glb")
        optimise(src, fish, 0.5, 256)
    wn = OUT / "tex" / "waternormals.jpg"
    if not wn.exists():
        src = get("https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/waternormals.jpg")
        Image.open(src).convert("RGB").resize((512, 512), Image.LANCZOS).save(wn, quality=88)

def main():
    CACHE.mkdir(parents=True, exist_ok=True)
    print("terrain textures")
    for t in TERRAIN:
        tex(t, 512, "terrain")
    print("building textures")
    for t in BUILD:
        tex(t, 512, "build")
    print("foliage")
    conifer_card(); leaf_card()
    print("models")
    for mid, spec in MODELS.items():
        polyhaven_model(mid, *spec)
    misc()
    total = sum(f.stat().st_size for f in OUT.rglob("*") if f.is_file())
    print(f"done: {total/1e6:.1f} MB in {OUT}")

if __name__ == "__main__":
    main()
