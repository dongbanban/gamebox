#!/usr/bin/env python3
"""Split the latest 2x5 dog overview into ten standalone SVG files.

The generated SVGs embed lossless PNG crops so the hand-painted gradients and
textures stay pixel-identical to the approved overview.
"""

from __future__ import annotations

import argparse
import base64
import io
from pathlib import Path

from PIL import Image


DOGS = (
    ("01-working-dog", "打工狗"),
    ("02-single-dog", "单身狗"),
    ("03-licking-dog", "舔狗"),
    ("04-guard-dog", "看门狗"),
    ("05-mad-dog", "疯狗"),
    ("06-destructive-dog", "拆家狗"),
    ("07-snarling-dog", "龇牙狗"),
    ("08-shy-dog", "社恐狗"),
    ("09-foodie-dog", "吃货狗"),
    ("10-silly-dog", "傻狗"),
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
    args = parser.parse_args()

    image = Image.open(args.source)
    columns, rows = detect_grid(image)
    args.output.mkdir(parents=True, exist_ok=True)

    for index, ((slug, title), (row_start, row_end), (column_start, column_end)) in enumerate(
        (
            (DOGS[row * 5 + column], rows[row], columns[column])
            for row in range(2)
            for column in range(5)
        ),
        start=1,
    ):
        crop = image.crop((column_start, row_start, column_end, row_end))
        destination = args.output / f"{slug}.svg"
        destination.write_text(svg_for_crop(crop, title), encoding="utf-8")
        print(f"{index:02d} {title}: {destination} ({crop.width}x{crop.height})")


if __name__ == "__main__":
    main()
