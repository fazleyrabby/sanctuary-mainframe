"""Render preview sheets of the generated Sanctuary assets.

Lays the assets out in a grid, renders with EEVEE to a PNG, then restores.
Run inside Blender: exec(open("tools/blender/render_preview.py").read())
"""

import math
import os

import bpy
from mathutils import Vector

PROJECT = "/Users/rabbi/Desktop/Projects/SanctuaryMainframe"
OUT_PREVIEW = os.path.join(PROJECT, "public", "assets", "preview")
COLLECTION = "SanctuaryAssets"

SHEETS = {
    "buildings": [
        "shelter", "storage", "farm", "water_collector",
        "workshop", "generator", "server_room", "ai_core",
    ],
    "props": [
        "dead_tree", "pine_tree", "rock", "boulder",
        "bush", "crate", "barrel", "scrap_pile",
    ],
}


def find(name):
    for obj in bpy.data.objects:
        if obj.name == name or obj.name.startswith(name):
            return obj
    return None


def setup_world():
    world = bpy.data.worlds.get("PreviewWorld") or bpy.data.worlds.new("PreviewWorld")
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs[0].default_value = (0.055, 0.06, 0.07, 1.0)
        bg.inputs[1].default_value = 1.0
    bpy.context.scene.world = world


def setup_lights():
    for name, loc, energy, color, angle in [
        ("PrevSun", (6, -8, 12), 2.8, (1.0, 0.95, 0.88), 0.12),
        ("PrevFill", (-9, 6, 5), 0.9, (0.55, 0.7, 0.9), 0.5),
    ]:
        existing = bpy.data.objects.get(name)
        if existing:
            bpy.data.objects.remove(existing, do_unlink=True)
        data = bpy.data.lights.new(name, type="SUN")
        data.energy = energy
        data.color = color
        data.angle = angle
        obj = bpy.data.objects.new(name, data)
        obj.location = loc
        obj.rotation_euler = (math.radians(52), 0, math.radians(38) if "Sun" in name else math.radians(-125))
        bpy.context.scene.collection.objects.link(obj)


def setup_camera(target, distance, height):
    cam_data = bpy.data.cameras.get("PrevCam") or bpy.data.cameras.new("PrevCam")
    cam_data.lens = 52
    cam = bpy.data.objects.get("PrevCam")
    if cam is None:
        cam = bpy.data.objects.new("PrevCam", cam_data)
        bpy.context.scene.collection.objects.link(cam)
    cam.location = (distance, -distance * 0.95, height)
    direction = Vector(target) - cam.location
    cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = cam


def render_sheet(names, filename, columns=4):
    spacing = 5.2
    rows = math.ceil(len(names) / columns)
    placed = []
    sheet_objects = set()

    for index, name in enumerate(names):
        obj = find(name)
        if obj is None:
            continue
        sheet_objects.add(obj)
        col = index % columns
        row = index // columns
        x = (col - (columns - 1) / 2) * spacing
        y = -(row - (rows - 1) / 2) * spacing
        obj.location = (x, y, obj.location.z)
        placed.append(obj)

    center = Vector((0, 0, 1.0))
    span = max(columns, rows) * spacing
    setup_camera(center, span * 0.95, span * 0.72)

    scene = bpy.context.scene
    scene.render.resolution_x = 1800
    scene.render.resolution_y = 1100
    scene.render.film_transparent = False
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = os.path.join(OUT_PREVIEW, filename)
    try:
        scene.view_settings.view_transform = "Standard"
    except Exception:
        pass

    for engine in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE", "CYCLES"):
        try:
            scene.render.engine = engine
            break
        except Exception:
            continue
    if scene.render.engine == "CYCLES":
        scene.cycles.samples = 48
    else:
        try:
            scene.eevee.taa_render_samples = 32
        except Exception:
            pass

    keep = {"PrevSun", "PrevFill", "PrevCam"}
    hidden = []
    for obj in bpy.data.objects:
        if obj.name in keep or obj.hide_render:
            continue
        if obj.type in {"MESH", "EMPTY"} and obj not in sheet_objects:
            obj.hide_render = True
            hidden.append(obj)

    bpy.ops.render.render(write_still=True)

    for obj in hidden:
        obj.hide_render = False

    return placed


def run():
    os.makedirs(OUT_PREVIEW, exist_ok=True)
    setup_world()
    setup_lights()
    for sheet, names in SHEETS.items():
        render_sheet(names, f"{sheet}.png")
        print(f"RENDERED {sheet}")
    print("PREVIEW_DONE")


run()
