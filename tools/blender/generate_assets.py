"""Sanctuary Mainframe - Blender asset generator.

Builds stylized low-poly buildings and props, exports them as GLB into the
Vite `public/assets` folder, and renders a preview sheet.

Run inside Blender via the MCP socket:
    exec(open("tools/blender/generate_assets.py").read())
"""

import json
import math
import os

import bmesh
import bpy
from mathutils import Vector

PROJECT = "/Users/rabbi/Desktop/Projects/SanctuaryMainframe"
OUT_ROOT = os.path.join(PROJECT, "public", "assets")
OUT_BUILDINGS = os.path.join(OUT_ROOT, "buildings")
OUT_PROPS = os.path.join(OUT_ROOT, "props")
OUT_PREVIEW = os.path.join(OUT_ROOT, "preview")
ASSET_COLLECTION = "SanctuaryAssets"

BEVEL = 0.02
BEVEL_SEGMENTS = 2


# ---------------------------------------------------------------- utilities

def set_input(node, names, value):
    for name in names:
        if name in node.inputs:
            node.inputs[name].default_value = value
            return True
    return False


def _s2l(channel):
    return channel / 12.92 if channel <= 0.04045 else ((channel + 0.055) / 1.055) ** 2.4


def hex_linear(value):
    value = value.lstrip("#")
    r = int(value[0:2], 16) / 255.0
    g = int(value[2:4], 16) / 255.0
    b = int(value[4:6], 16) / 255.0
    return (_s2l(r), _s2l(g), _s2l(b))


def make_mat(name, base_hex, rough=0.85, metal=0.0, emission_hex=None, emit_strength=0.0, alpha=1.0):
    mat = bpy.data.materials.get(name)
    if mat is None:
        mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    base = hex_linear(base_hex)
    set_input(bsdf, ["Base Color"], (base[0], base[1], base[2], 1.0))
    set_input(bsdf, ["Roughness"], rough)
    set_input(bsdf, ["Metallic"], metal)
    if emission_hex is not None:
        emission = hex_linear(emission_hex)
        set_input(bsdf, ["Emission Color", "Emission"], (emission[0], emission[1], emission[2], 1.0))
        set_input(bsdf, ["Emission Strength"], emit_strength)
    if alpha < 1.0:
        set_input(bsdf, ["Alpha"], alpha)
        try:
            mat.blend_method = "BLEND"
        except Exception:
            pass
    return mat


def build_materials():
    return {
        "wood": make_mat("wood", "#6b4a2f", rough=0.82),
        "wood_dark": make_mat("wood_dark", "#4a3320", rough=0.88),
        "wood_plank": make_mat("wood_plank", "#7d5a37", rough=0.78),
        "metal": make_mat("metal", "#7d8488", rough=0.42, metal=0.75),
        "metal_dark": make_mat("metal_dark", "#474d51", rough=0.55, metal=0.7),
        "rust": make_mat("rust", "#8a5535", rough=0.88, metal=0.25),
        "concrete": make_mat("concrete", "#8c8c86", rough=0.94),
        "stone": make_mat("stone", "#7c7e78", rough=0.95),
        "canvas": make_mat("canvas", "#9a8f6f", rough=0.96),
        "glass": make_mat("glass", "#9fc6c9", rough=0.10, alpha=0.45),
        "soil": make_mat("soil", "#4a3626", rough=0.98),
        "crop": make_mat("crop", "#6f8a44", rough=0.85),
        "crop_dry": make_mat("crop_dry", "#9a8f5c", rough=0.88),
        "foliage": make_mat("foliage", "#4f6238", rough=0.9),
        "foliage_dead": make_mat("foliage_dead", "#6b5a3a", rough=0.92),
        "emissive_warm": make_mat("emissive_warm", "#2a1e14", rough=0.6,
                                  emission_hex="#ffb463", emit_strength=1.6),
        "emissive_tech": make_mat("emissive_tech", "#0c1a1a", rough=0.35,
                                  emission_hex="#7fd6c2", emit_strength=1.15),
        "emissive_warn": make_mat("emissive_warn", "#331a08", rough=0.5,
                                  emission_hex="#ff7a2a", emit_strength=1.4),
    }


MATS = {}


def asset_collection():
    coll = bpy.data.collections.get(ASSET_COLLECTION)
    if coll is None:
        coll = bpy.data.collections.new(ASSET_COLLECTION)
        bpy.context.scene.collection.children.link(coll)
    return coll


def link_to_asset_collection(obj):
    coll = asset_collection()
    for existing in list(obj.users_collection):
        existing.objects.unlink(obj)
    coll.objects.link(obj)


def finish(obj, mat_key, bevel=BEVEL, name=None):
    if name:
        obj.name = name
    if mat_key:
        obj.data.materials.append(MATS[mat_key])
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    if bevel > 0:
        mod = obj.modifiers.new("bevel", "BEVEL")
        mod.width = bevel
        mod.segments = BEVEL_SEGMENTS
        mod.limit_method = "ANGLE"
        mod.angle_limit = math.radians(40)
        bpy.ops.object.modifier_apply(modifier=mod.name)
    link_to_asset_collection(obj)
    return obj


def box(name, size, loc=(0, 0, 0), rot=(0, 0, 0), mat="wood", bevel=BEVEL):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    obj = bpy.context.active_object
    obj.scale = size
    return finish(obj, mat, bevel, name)


def cyl(name, radius, depth, loc=(0, 0, 0), rot=(0, 0, 0), mat="metal", verts=12, bevel=0.01):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=radius, depth=depth, location=loc, rotation=rot)
    return finish(bpy.context.active_object, mat, bevel, name)


def cone(name, r1, r2, depth, loc=(0, 0, 0), rot=(0, 0, 0), mat="foliage", verts=10, bevel=0.0):
    bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r1, radius2=r2, depth=depth, location=loc, rotation=rot)
    return finish(bpy.context.active_object, mat, bevel, name)


def ico(name, radius, loc=(0, 0, 0), subdiv=1, scale=(1, 1, 1), mat="stone", bevel=0.0):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdiv, radius=radius, location=loc)
    obj = bpy.context.active_object
    obj.scale = scale
    return finish(obj, mat, bevel, name)


def torus(name, major, minor, loc=(0, 0, 0), rot=(0, 0, 0), mat="metal", bevel=0.0):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, location=loc, rotation=rot,
                                     major_segments=16, minor_segments=6)
    return finish(bpy.context.active_object, mat, bevel, name)


def scatter(seed, count, radius, z=0.0, jitter=0.3):
    import random
    rng = random.Random(seed)
    out = []
    for _ in range(count):
        angle = rng.uniform(0, math.tau)
        dist = rng.uniform(radius * 0.3, radius)
        out.append((math.cos(angle) * dist, math.sin(angle) * dist, z + rng.uniform(-jitter, jitter)))
    return out


# ---------------------------------------------------------------- buildings

def build_shelter():
    parts = []
    parts.append(box("foundation", (3.0, 3.0, 0.22), (0, 0, 0.11), mat="concrete"))
    parts.append(box("walls", (2.5, 2.5, 1.75), (0, 0, 1.07), mat="wood_plank"))
    parts.append(box("wall_trim", (2.62, 2.62, 0.10), (0, 0, 1.99), mat="wood_dark"))

    # corner posts
    for sx in (-1, 1):
        for sy in (-1, 1):
            parts.append(box("post", (0.16, 0.16, 1.9), (sx * 1.24, sy * 1.24, 1.06), mat="wood_dark", bevel=0.012))

    # gable roof
    for sy in (-1, 1):
        parts.append(box("roof", (3.3, 1.62, 0.12), (0, sy * 0.72, 2.24), (sy * -0.62, 0, 0), mat="wood_dark"))
    parts.append(box("ridge", (3.34, 0.20, 0.15), (0, 0, 2.72), mat="wood_dark", bevel=0.012))

    # door + frame
    parts.append(box("door_frame", (0.86, 0.10, 1.30), (0, 1.27, 0.75), mat="wood_dark", bevel=0.012))
    parts.append(box("door", (0.72, 0.08, 1.16), (0, 1.30, 0.70), mat="wood"))
    parts.append(cyl("handle", 0.035, 0.14, (0.24, 1.36, 0.74), (math.radians(90), 0, 0), mat="metal", verts=8))

    # window (warm light)
    parts.append(box("window_frame", (0.62, 0.10, 0.52), (0.95, 1.27, 1.36), mat="wood_dark", bevel=0.01))
    parts.append(box("window", (0.48, 0.06, 0.38), (0.95, 1.30, 1.36), mat="emissive_warm", bevel=0.006))
    parts.append(box("window_frame2", (0.62, 0.10, 0.52), (-0.95, 1.27, 1.36), mat="wood_dark", bevel=0.01))
    parts.append(box("window2", (0.48, 0.06, 0.38), (-0.95, 1.30, 1.36), mat="emissive_warm", bevel=0.006))

    # chimney
    parts.append(box("chimney", (0.36, 0.36, 1.05), (-0.82, -0.55, 2.35), mat="stone", bevel=0.015))
    parts.append(box("chimney_cap", (0.46, 0.46, 0.08), (-0.82, -0.55, 2.90), mat="metal_dark"))

    # lean-to water barrel + crates
    parts.append(cyl("barrel", 0.26, 0.66, (1.35, -1.05, 0.33), mat="rust", verts=12))
    parts.append(torus("barrel_ring", 0.26, 0.022, (1.35, -1.05, 0.46), mat="metal_dark"))
    parts.append(box("crate", (0.46, 0.46, 0.44), (-1.45, 1.05, 0.22), (0, 0.4, 0), mat="wood"))
    parts.append(box("crate2", (0.40, 0.40, 0.38), (-1.15, 1.30, 0.19), (0, -0.2, 0), mat="wood"))
    return "shelter", parts


def build_storage():
    parts = []
    parts.append(box("base", (2.6, 2.6, 0.16), (0, 0, 0.08), mat="concrete"))
    parts.append(box("body", (2.35, 2.35, 1.30), (0, 0, 0.81), mat="wood_plank"))
    parts.append(box("band", (2.45, 2.45, 0.12), (0, 0, 1.48), mat="rust"))

    # corrugated roof
    for i in range(5):
        y = -0.9 + i * 0.45
        parts.append(box("roof_rib", (2.7, 0.16, 0.10), (0, y, 1.60), mat="rust", bevel=0.01))
    parts.append(box("roof_deck", (2.7, 2.7, 0.06), (0, 0, 1.53), mat="metal_dark"))

    # double doors
    for sx in (-1, 1):
        parts.append(box("door", (1.0, 0.10, 1.12), (sx * 0.52, 1.20, 0.70), mat="wood_dark"))
    parts.append(box("door_beam", (2.2, 0.14, 0.14), (0, 1.20, 1.32), mat="wood_dark"))

    # crates + barrel
    parts.append(box("crate_a", (0.62, 0.62, 0.58), (1.05, -1.05, 0.29), (0, 0.5, 0), mat="wood"))
    parts.append(box("crate_b", (0.54, 0.54, 0.50), (0.62, -1.32, 0.25), (0, -0.3, 0), mat="wood"))
    parts.append(box("crate_c", (0.58, 0.58, 0.54), (1.02, -0.70, 0.85), (0, 0.2, 0), mat="wood"))
    parts.append(cyl("barrel", 0.30, 0.72, (-1.15, 1.02, 0.36), mat="rust", verts=12))
    parts.append(torus("barrel_ring", 0.30, 0.024, (-1.15, 1.02, 0.52), mat="metal_dark"))
    parts.append(torus("barrel_ring2", 0.30, 0.024, (-1.15, 1.02, 0.20), mat="metal_dark"))
    return "storage", parts


def build_farm():
    parts = []
    parts.append(box("soil", (2.9, 2.9, 0.18), (0, 0, 0.09), mat="soil", bevel=0.01))

    # furrows between the four plots
    for offset in (-1.45, 0.0, 1.45):
        parts.append(box("furrow", (2.7, 0.09, 0.09), (0, offset, 0.20), mat="soil", bevel=0.006))
        parts.append(box("furrow", (0.09, 2.7, 0.09), (offset, 0, 0.20), mat="soil", bevel=0.006))

    # fence
    for i in range(4):
        x = -1.35 + i * 0.9
        parts.append(box("fence_post", (0.09, 0.09, 0.62), (x, -1.48, 0.31), mat="wood", bevel=0.008))
        parts.append(box("fence_post", (0.09, 0.09, 0.62), (x, 1.48, 0.31), mat="wood", bevel=0.008))
    for sy in (-1.48, 1.48):
        parts.append(box("fence_rail", (2.75, 0.06, 0.08), (0, sy, 0.46), mat="wood", bevel=0.006))
        parts.append(box("fence_rail", (2.75, 0.06, 0.08), (0, sy, 0.22), mat="wood", bevel=0.006))

    # scarecrow
    parts.append(box("scare_post", (0.10, 0.10, 1.30), (1.25, -1.05, 0.65), mat="wood", bevel=0.008))
    parts.append(box("scare_arm", (0.90, 0.08, 0.08), (1.25, -1.05, 1.05), mat="wood", bevel=0.008))
    parts.append(box("scare_body", (0.42, 0.30, 0.50), (1.25, -1.05, 1.02), mat="canvas", bevel=0.01))
    parts.append(ico("scare_head", 0.16, (1.25, -1.05, 1.38), subdiv=1, scale=(1, 1, 1.1), mat="canvas"))
    parts.append(cone("scare_hat", 0.26, 0.0, 0.22, (1.25, -1.05, 1.56), mat="wood_dark", verts=8))
    return "farm", parts


def build_water_collector():
    parts = []
    parts.append(box("base", (1.8, 1.8, 0.16), (0, 0, 0.08), mat="concrete"))

    # legs
    for sx in (-1, 1):
        for sy in (-1, 1):
            parts.append(box("leg", (0.09, 0.09, 0.75), (sx * 0.52, sy * 0.52, 0.45), mat="metal_dark", bevel=0.008))

    parts.append(cyl("tank", 0.62, 1.25, (0, 0, 1.42), mat="metal", verts=16))
    parts.append(cyl("tank_cap", 0.50, 0.20, (0, 0, 2.12), mat="metal_dark", verts=16))
    parts.append(torus("tank_band", 0.63, 0.03, (0, 0, 1.85), mat="metal_dark"))
    parts.append(torus("tank_band2", 0.63, 0.03, (0, 0, 1.02), mat="metal_dark"))

    # angled collection panel
    parts.append(box("panel_frame", (1.65, 1.30, 0.06), (0, -0.85, 2.20), (math.radians(-28), 0, 0), mat="metal_dark"))
    parts.append(box("panel_glass", (1.50, 1.16, 0.05), (0, -0.85, 2.26), (math.radians(-28), 0, 0), mat="glass", bevel=0.004))
    for i in range(4):
        x = -0.56 + i * 0.375
        parts.append(box("panel_rib", (0.05, 1.20, 0.07), (x, -0.85, 2.30), (math.radians(-28), 0, 0), mat="metal_dark", bevel=0.004))

    # gutter + downpipe
    parts.append(box("gutter", (1.65, 0.14, 0.12), (0, -0.26, 1.96), mat="metal", bevel=0.01))
    parts.append(cyl("downpipe", 0.055, 1.05, (0.66, -0.26, 1.42), mat="metal", verts=8))
    parts.append(cyl("valve", 0.10, 0.10, (0.66, -0.26, 0.92), (math.radians(90), 0, 0), mat="rust", verts=8))
    parts.append(cyl("spout", 0.05, 0.30, (0.66, 0.02, 0.86), (math.radians(90), 0, 0), mat="metal", verts=8))
    return "water_collector", parts


def build_workshop():
    parts = []
    parts.append(box("base", (2.4, 2.4, 0.16), (0, 0, 0.08), mat="concrete"))
    parts.append(box("body", (2.15, 2.15, 1.45), (0, 0, 0.89), mat="metal_dark"))
    parts.append(box("roof", (2.45, 2.45, 0.12), (0, 0, 1.66), mat="rust"))

    # exhaust stack
    parts.append(cyl("stack", 0.15, 1.15, (0.82, -0.82, 2.10), mat="metal", verts=10))
    parts.append(cyl("stack_cap", 0.20, 0.10, (0.82, -0.82, 2.72), mat="metal_dark", verts=10))
    parts.append(torus("stack_ring", 0.16, 0.025, (0.82, -0.82, 2.40), mat="metal_dark"))

    # rolling door
    parts.append(box("door_frame", (1.25, 0.10, 1.20), (0, 1.10, 0.72), mat="metal_dark", bevel=0.012))
    for i in range(5):
        parts.append(box("door_slat", (1.10, 0.06, 0.16), (0, 1.15, 0.28 + i * 0.20), mat="rust", bevel=0.006))

    # emissive window + sign
    parts.append(box("window", (0.55, 0.07, 0.42), (-0.70, 1.10, 1.10), mat="emissive_tech", bevel=0.006))
    parts.append(box("sign", (0.70, 0.06, 0.20), (0.70, 1.10, 1.20), mat="emissive_warm", bevel=0.006))

    # side pipework
    parts.append(cyl("pipe", 0.06, 1.30, (-1.12, 0.30, 0.85), (0, 0, math.radians(90)), mat="metal", verts=8))
    parts.append(cyl("pipe2", 0.06, 1.30, (-1.12, -0.30, 0.85), (0, 0, math.radians(90)), mat="metal", verts=8))

    # outside workbench + anvil
    parts.append(box("bench_top", (0.90, 0.42, 0.08), (-1.55, 0.95, 0.58), mat="wood", bevel=0.008))
    parts.append(box("bench_leg", (0.08, 0.36, 0.54), (-1.92, 0.95, 0.29), mat="wood", bevel=0.006))
    parts.append(box("bench_leg", (0.08, 0.36, 0.54), (-1.18, 0.95, 0.29), mat="wood", bevel=0.006))
    parts.append(box("anvil", (0.42, 0.22, 0.16), (-1.55, 1.35, 0.42), mat="metal_dark", bevel=0.012))
    return "workshop", parts


def build_generator():
    parts = []
    parts.append(box("base", (1.9, 1.9, 0.18), (0, 0, 0.09), mat="concrete"))
    parts.append(box("housing", (1.65, 1.35, 1.10), (0, 0, 0.73), mat="metal_dark"))
    parts.append(box("hood", (1.75, 1.45, 0.10), (0, 0, 1.33), mat="rust"))

    # vents
    for i in range(5):
        parts.append(box("vent", (0.10, 1.10, 0.08), (-0.60 + i * 0.30, 0, 0.95), mat="metal", bevel=0.006))

    # exhaust
    parts.append(cyl("exhaust", 0.12, 0.95, (0.62, -0.50, 1.75), mat="metal", verts=10))
    parts.append(cyl("exhaust_tip", 0.16, 0.10, (0.62, -0.50, 2.24), mat="rust", verts=10))

    # control panel
    parts.append(box("panel", (0.55, 0.10, 0.45), (0, 0.72, 0.80), mat="metal_dark", bevel=0.01))
    parts.append(box("panel_screen", (0.38, 0.06, 0.26), (0, 0.78, 0.84), mat="emissive_tech", bevel=0.004))
    parts.append(cyl("gauge", 0.07, 0.05, (0, 0.78, 0.55), (math.radians(90), 0, 0), mat="emissive_warn", verts=10))

    # fuel drum + cable
    parts.append(cyl("drum", 0.30, 0.78, (1.15, 0.62, 0.39), mat="rust", verts=12))
    parts.append(torus("drum_ring", 0.30, 0.024, (1.15, 0.62, 0.58), mat="metal_dark"))
    parts.append(box("cable", (0.10, 0.10, 0.90), (0.85, -0.85, 0.45), (0, 0.4, 0), mat="metal_dark", bevel=0.006))
    return "generator", parts


def build_server_room():
    parts = []
    parts.append(box("base", (2.9, 2.9, 0.20), (0, 0, 0.10), mat="concrete"))
    parts.append(box("body", (2.55, 2.55, 1.70), (0, 0, 1.05), mat="metal_dark"))
    parts.append(box("parapet", (2.75, 2.75, 0.14), (0, 0, 1.97), mat="concrete"))

    # emissive server bays
    for i in range(3):
        parts.append(box("bay", (0.60, 0.08, 1.05), (-0.75 + i * 0.75, 1.28, 1.05), mat="emissive_tech", bevel=0.008))
    for i in range(3):
        for j in range(6):
            parts.append(box("led", (0.34, 0.04, 0.05), (-0.75 + i * 0.75, 1.34, 0.68 + j * 0.16), mat="emissive_tech", bevel=0.003))

    # AC units on roof
    for sx in (-1, 1):
        parts.append(box("ac", (0.90, 0.70, 0.55), (sx * 0.75, -0.60, 2.32), mat="metal", bevel=0.012))
        parts.append(cyl("ac_fan", 0.24, 0.06, (sx * 0.75, -0.60, 2.62), mat="metal_dark", verts=14))

    # cable trunk + conduit
    parts.append(box("trunk", (0.20, 2.40, 0.14), (-1.38, 0, 0.45), mat="metal", bevel=0.008))
    parts.append(cyl("conduit", 0.08, 1.60, (1.35, 0.20, 1.30), (0, 0, math.radians(90)), mat="metal", verts=8))

    # dish
    parts.append(cyl("dish_mast", 0.06, 0.60, (1.05, -1.05, 2.30), mat="metal", verts=8))
    parts.append(cyl("dish", 0.42, 0.06, (1.05, -1.05, 2.62), (math.radians(35), 0, 0), mat="metal", verts=16))
    return "server_room", parts


def build_ai_core():
    parts = []
    parts.append(box("plinth", (3.0, 3.0, 0.28), (0, 0, 0.14), mat="concrete", bevel=0.03))
    parts.append(box("plinth_step", (2.5, 2.5, 0.22), (0, 0, 0.39), mat="metal_dark", bevel=0.02))

    # monolith
    parts.append(box("monolith", (1.55, 1.55, 2.35), (0, 0, 1.68), mat="metal_dark", bevel=0.03))
    parts.append(box("monolith_top", (1.75, 1.75, 0.16), (0, 0, 2.93), mat="metal", bevel=0.02))

    # glowing channels
    for sx in (-1, 1):
        parts.append(box("channel", (0.085, 1.05, 1.70), (sx * 0.79, 0, 1.68), mat="emissive_tech", bevel=0.008))
    for sy in (-1, 1):
        parts.append(box("channel", (1.05, 0.085, 1.70), (0, sy * 0.79, 1.68), mat="emissive_tech", bevel=0.008))

    # core eye
    parts.append(cyl("core_eye", 0.22, 0.10, (0, 0.80, 2.10), (math.radians(90), 0, 0), mat="emissive_tech", verts=20))

    # floating halo rings
    parts.append(torus("ring", 1.15, 0.045, (0, 0, 3.22), (math.radians(7), 0, 0), mat="metal", bevel=0.0))
    parts.append(torus("ring2", 0.92, 0.032, (0, 0, 3.46), (math.radians(7), 0, 0), mat="emissive_tech", bevel=0.0))

    # support pylons
    for sx in (-1, 1):
        for sy in (-1, 1):
            parts.append(box("pylon", (0.20, 0.20, 1.10), (sx * 1.30, sy * 1.30, 0.83), mat="metal", bevel=0.012))
            parts.append(box("pylon_cap", (0.26, 0.26, 0.10), (sx * 1.30, sy * 1.30, 1.42), mat="emissive_tech", bevel=0.008))

    # cables
    for sx in (-1, 1):
        parts.append(cyl("cable", 0.05, 1.85, (sx * 0.80, 0, 3.05), (0, math.radians(90), 0), mat="metal_dark", verts=6))
    return "ai_core", parts


# ---------------------------------------------------------------- props

def build_dead_tree():
    parts = []
    parts.append(cone("trunk", 0.20, 0.09, 2.0, (0, 0, 1.0), mat="wood_dark", verts=8))
    branches = [
        ((0.80, 0.0, 0.60), 1.05, 1.30),
        ((-0.72, 0.30, 0.55), 0.95, 1.10),
        ((0.12, 0.85, 0.70), 0.90, 1.48),
        ((-0.25, -0.80, 0.50), 0.85, 1.22),
        ((0.55, -0.45, 0.85), 0.78, 1.68),
        ((-0.60, 0.55, 0.78), 0.72, 1.58),
        ((0.30, 0.20, 1.0), 0.55, 1.90),
    ]
    for i, (direction, length, z) in enumerate(branches):
        d = Vector(direction).normalized()
        obj = cone(f"branch_{i}", 0.075, 0.018, length, (0, 0, 0), mat="wood_dark", verts=6)
        obj.location = Vector((0, 0, z)) + d * (length * 0.5)
        obj.rotation_euler = Vector((0, 0, 1)).rotation_difference(d).to_euler()
        bpy.ops.object.select_all(action="DESELECT")
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        parts.append(obj)
    return "dead_tree", parts


def build_pine_tree():
    parts = []
    parts.append(cyl("trunk", 0.16, 0.85, (0, 0, 0.42), mat="wood_dark", verts=8))
    for i, (r, h, z) in enumerate([(1.05, 1.15, 1.05), (0.82, 1.00, 1.70), (0.55, 0.85, 2.28)]):
        parts.append(cone(f"canopy_{i}", r, 0.02, h, (0, 0, z), mat="foliage", verts=10))
    return "pine_tree", parts


def build_rock():
    parts = [ico("rock", 0.42, (0, 0, 0.30), subdiv=1, scale=(1.15, 0.95, 0.78), mat="stone")]
    parts.append(ico("rock_b", 0.24, (0.42, 0.22, 0.16), subdiv=1, scale=(1.0, 0.9, 0.7), mat="stone"))
    return "rock", parts


def build_boulder():
    parts = [ico("boulder", 0.78, (0, 0, 0.52), subdiv=2, scale=(1.2, 1.0, 0.82), mat="stone")]
    parts.append(ico("boulder_b", 0.38, (-0.85, 0.30, 0.24), subdiv=1, scale=(1.0, 0.9, 0.75), mat="stone"))
    return "boulder", parts


def build_bush():
    parts = []
    for loc in scatter(7, 5, 0.46, z=0.32, jitter=0.07):
        parts.append(ico("bush", 0.42, loc, subdiv=1, scale=(1.15, 1.0, 0.88), mat="foliage"))
    return "bush", parts


def build_crate():
    parts = [box("crate", (0.60, 0.60, 0.56), (0, 0, 0.28), mat="wood")]
    for sz in (-1, 1):
        parts.append(box("band", (0.64, 0.05, 0.56), (0, sz * 0.28, 0.28), mat="wood_dark", bevel=0.006))
    return "crate", parts


def build_barrel():
    parts = [cyl("barrel", 0.31, 0.80, (0, 0, 0.40), mat="rust", verts=14)]
    for z in (0.16, 0.40, 0.64):
        parts.append(torus("ring", 0.315, 0.026, (0, 0, z), mat="metal_dark"))
    return "barrel", parts


def build_scrap_pile():
    parts = []
    for i, loc in enumerate(scatter(11, 5, 0.55, z=0.16, jitter=0.05)):
        rot = (0.0, 0.0, i * 0.7)
        parts.append(box("scrap", (0.55, 0.30, 0.14), loc, rot, mat="rust", bevel=0.008))
    parts.append(cyl("pipe", 0.07, 1.05, (0.10, 0.05, 0.30), (0.4, 0.3, 0.9), mat="metal", verts=8))
    parts.append(box("panel", (0.70, 0.50, 0.06), (-0.30, -0.15, 0.42), (0.3, 0.2, 0.6), mat="metal_dark", bevel=0.006))
    return "scrap_pile", parts


BUILDING_BUILDERS = [
    build_shelter, build_storage, build_farm, build_water_collector,
    build_workshop, build_generator, build_server_room, build_ai_core,
]

PROP_BUILDERS = [
    build_dead_tree, build_pine_tree, build_rock, build_boulder,
    build_bush, build_crate, build_barrel, build_scrap_pile,
]


# ---------------------------------------------------------------- pipeline

def clear_previous():
    coll = bpy.data.collections.get(ASSET_COLLECTION)
    if coll is None:
        return
    for obj in list(coll.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    bpy.data.collections.remove(coll)


def join_group(objects, name):
    meshes = [o for o in objects if o.type == "MESH"]
    if not meshes:
        return None
    bpy.ops.object.select_all(action="DESELECT")
    for obj in meshes:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1:
        bpy.ops.object.join()
    joined = bpy.context.active_object
    joined.name = name
    return joined


def export_glb(obj, path):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_materials="EXPORT",
    )


def run():
    global MATS
    os.makedirs(OUT_BUILDINGS, exist_ok=True)
    os.makedirs(OUT_PROPS, exist_ok=True)
    os.makedirs(OUT_PREVIEW, exist_ok=True)

    clear_previous()
    MATS = build_materials()
    bpy.context.scene.unit_settings.system = "METRIC"
    bpy.context.scene.unit_settings.scale_length = 1.0

    manifest = {"buildings": [], "props": []}
    results = []

    for builder in BUILDING_BUILDERS + PROP_BUILDERS:
        name, parts = builder()
        joined = join_group(parts, name)
        if joined is None:
            continue
        is_building = builder in BUILDING_BUILDERS

        if is_building:
            bpy.ops.object.select_all(action="DESELECT")
            joined.select_set(True)
            bpy.context.view_layer.objects.active = joined
            joined.rotation_euler = (0, 0, math.pi)
            bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)

        folder = OUT_BUILDINGS if is_building else OUT_PROPS
        path = os.path.join(folder, f"{name}.glb")
        export_glb(joined, path)
        dims = tuple(round(v, 3) for v in joined.dimensions)
        tris = len(joined.data.loop_triangles) if joined.data.loop_triangles else 0
        results.append((name, dims, tris, path))
        bucket = "buildings" if is_building else "props"
        manifest[bucket].append({"id": name, "file": f"{name}.glb", "dimensions": dims})

    with open(os.path.join(OUT_ROOT, "manifest.json"), "w") as handle:
        json.dump(manifest, handle, indent=2)

    for name, dims, tris, path in results:
        print(f"ASSET {name:16s} dims={dims} tris={tris}")

    print(f"TOTAL {len(results)} assets -> {OUT_ROOT}")


run()
