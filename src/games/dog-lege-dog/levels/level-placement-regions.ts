import {
  BLOCK_HEIGHT,
  BLOCK_WIDTH,
  type DogBlock,
} from "@/games/dog-lege-dog/levels/level-types";

export const CORNER_REGIONS = [
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
] as const;

export type PlacementRegion = "center" | (typeof CORNER_REGIONS)[number] | "edge";

export function getPlacementRegion(
  placement: Pick<DogBlock, "x" | "y">,
  boardWidth: number,
  boardHeight: number,
): PlacementRegion {
  const centerX = (placement.x + BLOCK_WIDTH / 2) / boardWidth;
  const centerY = (placement.y + BLOCK_HEIGHT / 2) / boardHeight;
  const horizontal = centerX < 0.2 ? "left" : centerX > 0.8 ? "right" : "center";
  const vertical = centerY < 0.2 ? "top" : centerY > 0.8 ? "bottom" : "center";

  if (horizontal === "center" && vertical === "center") {
    return "center";
  }
  if (horizontal !== "center" && vertical !== "center") {
    return `${vertical}-${horizontal}` as (typeof CORNER_REGIONS)[number];
  }
  return "edge";
}

export function cellKey(cell: { readonly x: number; readonly y: number }): string {
  return `${cell.x}:${cell.y}`;
}
