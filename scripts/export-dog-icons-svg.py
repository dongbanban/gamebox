#!/usr/bin/env python3
"""Split the latest 2x5 dog overview into ten standalone SVG files.

The generated SVGs embed lossless PNG crops so the hand-painted gradients and
textures stay pixel-identical to the approved overview.
"""

from __future__ import annotations

import argparse
import base64
import io
from collections import deque
from pathlib import Path

from PIL import Image


DOGS = (
    ("01-working-dog", "打工狗", (239, 111, 99)),
    ("02-single-dog", "单身狗", (255, 191, 33)),
    ("03-licking-dog", "舔狗", (143, 216, 191)),
    ("04-guard-dog", "看门狗", (69, 194, 233)),
    ("05-mad-dog", "疯狗", (169, 140, 228)),
    ("06-destructive-dog", "拆家狗", (255, 140, 25)),
    ("07-snarling-dog", "龇牙狗", (154, 198, 42)),
    ("08-shy-dog", "社恐狗", (79, 114, 207)),
    ("09-foodie-dog", "吃货狗", (236, 153, 170)),
    ("10-silly-dog", "傻狗", (22, 174, 184)),
)


def is_foreground(pixel: tuple[int, ...]) -> bool:
    red, green, blue = pixel[:3]
    return max(red, green, blue) - min(red, green, blue) > 24 or min(red, green, blue) < 205


def find_runs(values: list[int], threshold: int, minimum_width: int) -> list[tuple[int, int]]:
    runs: list[tuple[int, int]] = []
    start: int | None = None

    for index, value in enumerate(values + [0]):
        if value > threshold and start is None:
            start = index
        elif value <= threshold and start is not None:
            if index - start >= minimum_width:
                runs.append((start, index))
            start = None

    return runs


def detect_grid(image: Image.Image) -> tuple[list[tuple[int, int]], list[tuple[int, int]]]:
    rgb = image.convert("RGB")
    width, height = rgb.size
    column_counts = [0] * width
    row_counts = [0] * height

    for y in range(height):
        for x in range(width):
            if is_foreground(rgb.getpixel((x, y))):
                column_counts[x] += 1
                row_counts[y] += 1

    columns = find_runs(column_counts, height // 8, width // 20)
    rows = find_runs(row_counts, width // 4, height // 10)

    if len(columns) != 5 or len(rows) != 2:
        raise RuntimeError(f"Expected 5 columns and 2 rows, found {columns=} {rows=}")

    return columns, rows


def fill_rounded_corners(crop: Image.Image, background: tuple[int, int, int]) -> Image.Image:
    """Extend card-edge colors into corner-connected light background pixels."""
    image = crop.convert("RGB")
    width, height = image.size
    pixels = image.load()
    outside = bytearray(width * height)
    queue: deque[tuple[int, int]] = deque()

    for point in ((0, 0), (width - 1, 0), (0, height - 1), (width - 1, height - 1)):
        if not is_foreground(pixels[point]):
            queue.append(point)
            outside[point[1] * width + point[0]] = 1

    while queue:
        x, y = queue.popleft()
        for next_x, next_y in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if not (0 <= next_x < width and 0 <= next_y < height):
                continue
            index = next_y * width + next_x
            if outside[index] or is_foreground(pixels[next_x, next_y]):
                continue
            outside[index] = 1
            queue.append((next_x, next_y))

    for _ in range(3):
        expanded = bytearray(outside)
        for y in range(height):
            for x in range(width):
                if not outside[y * width + x]:
                    continue
                for next_x, next_y in (
                    (x - 1, y - 1),
                    (x, y - 1),
                    (x + 1, y - 1),
                    (x - 1, y),
                    (x + 1, y),
                    (x - 1, y + 1),
                    (x, y + 1),
                    (x + 1, y + 1),
                ):
                    if 0 <= next_x < width and 0 <= next_y < height:
                        expanded[next_y * width + next_x] = 1
        outside = expanded

    filled = image.copy()
    filled_pixels = filled.load()

    for y in range(height):
        for x in range(width):
            index = y * width + x
            if not outside[index]:
                continue
            filled_pixels[x, y] = background

    background_region = bytearray(outside)
    queue = deque(
        (x, y)
        for y in range(height)
        for x in range(width)
        if outside[y * width + x]
    )
    seed_band = 12
    for y in range(height):
        for x in range(width):
            if not (
                x < seed_band
                or x >= width - seed_band
                or y < seed_band
                or y >= height - seed_band
            ):
                continue
            index = y * width + x
            if background_region[index]:
                continue
            candidate = filled_pixels[x, y]
            color_distance = sum(
                (left - right) ** 2 for left, right in zip(background, candidate)
            )
            if sum(candidate) >= 180 and color_distance <= 10000:
                background_region[index] = 1
                queue.append((x, y))

    edge_width = 2
    for y in range(height):
        for x in range(width):
            if not (
                x < edge_width
                or x >= width - edge_width
                or y < edge_width
                or y >= height - edge_width
            ):
                continue
            index = y * width + x
            candidate = filled_pixels[x, y]
            if sum(candidate) > 420 and max(candidate) - min(candidate) < 100:
                background_region[index] = 1
                queue.append((x, y))

    while queue:
        x, y = queue.popleft()
        current = filled_pixels[x, y]
        for next_x, next_y in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if not (0 <= next_x < width and 0 <= next_y < height):
                continue
            index = next_y * width + next_x
            if background_region[index]:
                continue
            candidate = filled_pixels[next_x, next_y]
            color_distance = sum((left - right) ** 2 for left, right in zip(current, candidate))
            if sum(candidate) < 180 or color_distance > 6000:
                continue
            background_region[index] = 1
            queue.append((next_x, next_y))

    for y in range(height):
        for x in range(width):
            if background_region[y * width + x]:
                filled_pixels[x, y] = background

    return filled


def svg_for_crop(crop: Image.Image, title: str) -> str:
    buffer = io.BytesIO()
    crop.save(buffer, format="PNG", optimize=True)
    encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
    width, height = crop.size

    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        f'<svg xmlns="http://www.w3.org/2000/svg" '
        f'viewBox="0 0 {width} {height}" width="{width}" height="{height}" role="img" '
        f'aria-labelledby="title">\n'
        f'  <title id="title">{title}</title>\n'
        f'  <image width="{width}" height="{height}" preserveAspectRatio="xMidYMid meet" '
        f'href="data:image/png;base64,{encoded}"/>\n'
        '</svg>\n'
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument(
        "--square-corners",
        action="store_true",
        help="Extend each card background to square corners.",
    )
    args = parser.parse_args()

    image = Image.open(args.source)
    columns, rows = detect_grid(image)
    args.output.mkdir(parents=True, exist_ok=True)

    for index, ((slug, title, background), (row_start, row_end), (column_start, column_end)) in enumerate(
        (
            (DOGS[row * 5 + column], rows[row], columns[column])
            for row in range(2)
            for column in range(5)
        ),
        start=1,
    ):
        crop = image.crop((column_start, row_start, column_end, row_end))
        if args.square_corners:
            crop = fill_rounded_corners(crop, background)
        destination = args.output / f"{slug}.svg"
        destination.write_text(svg_for_crop(crop, title), encoding="utf-8")
        print(f"{index:02d} {title}: {destination} ({crop.width}x{crop.height})")


if __name__ == "__main__":
    main()
