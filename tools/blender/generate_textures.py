"""Generate tileable PBR terrain + water textures for Sanctuary Mainframe.

Writes albedo / normal / roughness PNGs into public/assets/textures.
All noise is built from integer-frequency sinusoids so it tiles seamlessly.

Run inside Blender: exec(open("tools/blender/generate_textures.py").read())
"""

import math
import os

import bpy
import numpy as np

PROJECT = "/Users/rabbi/Desktop/Projects/SanctuaryMainframe"
OUT = os.path.join(PROJECT, "public", "assets", "textures")
SIZE = 512
NORMAL_SCALE = 6.0


# ------------------------------------------------------------------ noise

def fbm(size, octaves, seed, persistence=0.62, anisotropy=1.0):
    rng = np.random.default_rng(seed)
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32)
    u = xx / size
    v = yy / size

    total = np.zeros((size, size), np.float32)
    norm = 0.0
    amp = 1.0

    for octave in range(octaves):
        f = 2 ** octave
        for _ in range(f * 2 + 2):
            fx = int(rng.integers(1, f * 2 + 1))
            fy = int(rng.integers(1, f * 2 + 1))
            phase = float(rng.uniform(0, 2 * math.pi))
            total += amp * np.sin(2 * math.pi * (fx * u + fy * v / anisotropy) + phase)
            norm += amp
        amp *= persistence

    return (total / norm) * 0.5 + 0.5


def grain(size, seed, blur=1):
    rng = np.random.default_rng(seed)
    n = rng.random((size, size)).astype(np.float32)
    for _ in range(blur):
        n = (
            n
            + np.roll(n, 1, axis=0)
            + np.roll(n, -1, axis=0)
            + np.roll(n, 1, axis=1)
            + np.roll(n, -1, axis=1)
        ) / 5.0
    return n


def detail_field(size, seed, octaves=6):
    return np.clip(fbm(size, octaves, seed) * 0.55 + grain(size, seed + 5000, 1) * 0.45, 0.0, 1.0)


def ridged(size, octaves, seed):
    n = fbm(size, octaves, seed)
    return 1.0 - np.abs(n * 2.0 - 1.0)


def smoothstep(edge0, edge1, x):
    t = np.clip((x - edge0) / (edge1 - edge0), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def mix(a, b, t):
    t = t[..., None] if t.ndim == 2 else t
    return a * (1 - t) + b * t


def mul(color, factor):
    factor = factor[..., None] if factor.ndim == 2 else factor
    return color * factor


def add(color, amount):
    amount = amount[..., None] if amount.ndim == 2 else amount
    return color + amount


def rgb(value):
    value = value.lstrip("#")
    return np.array([int(value[0:2], 16), int(value[2:4], 16), int(value[4:6], 16)], np.float32) / 255.0


def normal_from_height(height, strength):
    dx = (np.roll(height, -1, axis=1) - np.roll(height, 1, axis=1)) * 0.5
    dy = (np.roll(height, -1, axis=0) - np.roll(height, 1, axis=0)) * 0.5
    nx = -dx * strength * NORMAL_SCALE
    ny = -dy * strength * NORMAL_SCALE
    nz = np.ones_like(height)
    length = np.sqrt(nx * nx + ny * ny + nz * nz)
    return np.stack([nx / length, ny / length, nz / length], axis=-1) * 0.5 + 0.5


def roughness_from_height(height, base, amount):
    return np.clip(base + (height - 0.5) * amount, 0.0, 1.0)


# ------------------------------------------------------------------ save

def save_png(name, array):
    if array.ndim == 2:
        array = np.stack([array, array, array], axis=-1)
    height, width = array.shape[:2]
    rgba = np.ones((height, width, 4), np.float32)
    rgba[:, :, :3] = np.clip(array, 0.0, 1.0)
    rgba = rgba[::-1]

    image = bpy.data.images.new(name, width, height, alpha=False)
    image.colorspace_settings.name = "Non-Color"
    image.pixels.foreach_set(rgba.reshape(-1))
    image.filepath_raw = os.path.join(OUT, f"{name}.png")
    image.file_format = "PNG"
    image.save()
    bpy.data.images.remove(image)


# ------------------------------------------------------------------ surfaces

def surface_grass():
    macro = fbm(SIZE, 3, 101)
    detail = detail_field(SIZE, 102, 6)
    blades = fbm(SIZE, 7, 103, anisotropy=3.4)
    speck = grain(SIZE, 104, 0)
    clumps = smoothstep(0.32, 0.74, macro)

    albedo = mix(rgb("#43522c"), rgb("#93a463"), clumps)
    albedo = mul(albedo, 0.72 + detail * 0.56)
    albedo = add(albedo, (blades - 0.5) * 0.18)
    albedo = add(albedo, (speck - 0.5) * 0.14)
    albedo = np.clip(albedo, 0, 1)

    height = detail * 0.5 + blades * 0.5
    return albedo, normal_from_height(height, 2.2), roughness_from_height(detail, 0.92, 0.12)


def surface_grass_dry():
    macro = fbm(SIZE, 3, 201)
    detail = detail_field(SIZE, 202, 6)
    blades = fbm(SIZE, 7, 203, anisotropy=2.6)
    speck = grain(SIZE, 204, 0)
    clumps = smoothstep(0.3, 0.74, macro)

    albedo = mix(rgb("#6d6538"), rgb("#c0b17a"), clumps)
    albedo = mul(albedo, 0.74 + detail * 0.52)
    albedo = add(albedo, (blades - 0.5) * 0.16)
    albedo = add(albedo, (speck - 0.5) * 0.12)
    albedo = np.clip(albedo, 0, 1)

    height = detail * 0.48 + blades * 0.52
    return albedo, normal_from_height(height, 2.0), roughness_from_height(detail, 0.95, 0.05)


def surface_dirt():
    macro = fbm(SIZE, 4, 301)
    detail = detail_field(SIZE, 302, 6)
    cracks = ridged(SIZE, 5, 303)
    pebbles = smoothstep(0.7, 0.84, grain(SIZE, 304, 1))
    speck = grain(SIZE, 305, 0)

    albedo = mix(rgb("#4d3a28"), rgb("#93785a"), macro)
    albedo = mul(albedo, 0.76 + detail * 0.48)
    albedo = mul(albedo, 1.0 - smoothstep(0.44, 0.62, cracks) * 0.38)
    albedo = add(albedo, pebbles * 0.22)
    albedo = add(albedo, (speck - 0.5) * 0.10)
    albedo = np.clip(albedo, 0, 1)

    height = detail * 0.35 + pebbles * 0.4 + cracks * 0.25
    return albedo, normal_from_height(height, 2.6), roughness_from_height(detail, 0.96, 0.04)


def surface_stone():
    macro = fbm(SIZE, 4, 401)
    detail = detail_field(SIZE, 402, 6)
    cracks = ridged(SIZE, 6, 403)
    speck = grain(SIZE, 404, 0)

    albedo = mix(rgb("#575954"), rgb("#a6a89f"), macro)
    albedo = mul(albedo, 0.8 + detail * 0.4)
    albedo = mul(albedo, 1.0 - smoothstep(0.4, 0.58, cracks) * 0.44)
    albedo = add(albedo, (speck - 0.5) * 0.10)
    albedo = np.clip(albedo, 0, 1)

    height = detail * 0.3 + cracks * 0.7
    return albedo, normal_from_height(height, 2.8), roughness_from_height(detail, 0.9, 0.1)


def surface_sand():
    macro = fbm(SIZE, 3, 501)
    detail = detail_field(SIZE, 502, 6)
    ripple_noise = fbm(SIZE, 3, 503)
    yy = np.mgrid[0:SIZE, 0:SIZE][0].astype(np.float32)
    ripple = np.sin(2 * math.pi * (7.0 * yy / SIZE) + ripple_noise * 7.0) * 0.5 + 0.5
    speck = grain(SIZE, 504, 0)

    albedo = mix(rgb("#9c8b60"), rgb("#d8c99c"), macro)
    albedo = mul(albedo, 0.84 + detail * 0.32)
    albedo = mul(albedo, 0.88 + ripple * 0.2)
    albedo = add(albedo, (speck - 0.5) * 0.08)
    albedo = np.clip(albedo, 0, 1)

    height = ripple * 0.6 + detail * 0.4
    return albedo, normal_from_height(height, 2.2), roughness_from_height(detail, 0.9, 0.08)


def surface_water_normal():
    wave_a = fbm(SIZE, 5, 601)
    wave_b = fbm(SIZE, 6, 602, anisotropy=1.6)
    fine = grain(SIZE, 603, 1)
    ripples = np.abs(wave_a * 0.5 + wave_b * 0.35 + fine * 0.15 - 0.5) * 2.0
    return normal_from_height(ripples, 1.8)


def surface_cliff():
    macro = fbm(SIZE, 4, 701)
    detail = detail_field(SIZE, 702, 6)
    yy = np.mgrid[0:SIZE, 0:SIZE][0].astype(np.float32)
    band_noise = fbm(SIZE, 3, 705)
    strata = np.sin(2 * math.pi * (3.0 * yy / SIZE) + band_noise * 9.0) * 0.5 + 0.5
    strata = strata ** 1.6
    speck = grain(SIZE, 703, 0)

    albedo = mix(rgb("#4a4038"), rgb("#a1968a"), macro * 0.62 + strata * 0.38)
    albedo = mul(albedo, 0.8 + detail * 0.44)
    albedo = add(albedo, (speck - 0.5) * 0.16)
    albedo = np.clip(albedo, 0, 1)

    height = detail * 0.55 + strata * 0.45
    return albedo, normal_from_height(height, 2.1), roughness_from_height(detail, 0.97, 0.03)


# ------------------------------------------------------------------ pipeline

SURFACES = {
    "terrain_grass": surface_grass,
    "terrain_grass_dry": surface_grass_dry,
    "terrain_dirt": surface_dirt,
    "terrain_stone": surface_stone,
    "terrain_sand": surface_sand,
    "terrain_cliff": surface_cliff,
}


def run():
    os.makedirs(OUT, exist_ok=True)

    for name, builder in SURFACES.items():
        albedo, normal, roughness = builder()
        save_png(f"{name}_albedo", albedo)
        save_png(f"{name}_normal", normal)
        save_png(f"{name}_roughness", roughness)
        print(f"TEXTURE {name}")

    save_png("water_normal", surface_water_normal())
    print("TEXTURE water_normal")
    print(f"TEXTURES_DONE -> {OUT}")


run()
