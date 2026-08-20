import type { DogBoard, DogBoardCell, DogBoardShape } from "@/games/dog-lege-dog/levels/level-types";
import { BLOCK_WIDTH } from "@/games/dog-lege-dog/levels/level-types";
import { FIRST_LEVEL_TEMPLATE_ID } from "@/games/dog-lege-dog/game/game-config";
import { SeededRandom } from "@/games/dog-lege-dog/levels/level-random";

const BASE_TEMPLATE_WIDTH = 18;
const BASE_TEMPLATE_HEIGHT = 24;
const TEMPLATE_SCALE = 2;
const TEMPLATE_WIDTH = BASE_TEMPLATE_WIDTH * TEMPLATE_SCALE;
const TEMPLATE_HEIGHT = BASE_TEMPLATE_HEIGHT * TEMPLATE_SCALE;

type Hole = readonly [x: number, y: number];

export interface DogShapeTemplate {
  readonly id: string;
  readonly shape: DogBoardShape;
  readonly width: number;
  readonly height: number;
  readonly rows: readonly string[];
  readonly playableCells: readonly DogBoardCell[];
}

/**
 * Irregular templates are the only board vocabulary. Each template is a
 * connected fine-grid mask with asymmetric notches and protrusions.
 *
 * The target mask is 9 × 12 block slots (36 × 48 fine-grid cells). Sparse
 * holes keep the logical outline irregular while leaving enough valid anchors
 * for the six-layer, 180-block upper bound.
 */
export const DOG_SHAPE_TEMPLATES: readonly DogShapeTemplate[] = Object.freeze(
  [
    createShapeTemplate(
      FIRST_LEVEL_TEMPLATE_ID,
      createRows([
        [0, 0],
        [17, 23],
      ]),
    ),
    createShapeTemplate(
      "irregular-notch-1",
      createRows([
        [17, 0],
        [0, 23],
      ]),
    ),
    createShapeTemplate(
      "irregular-split-2",
      createRows([
        [0, 0],
        [17, 23],
      ]),
    ),
    createShapeTemplate(
      "irregular-wind-3",
      createRows([
        [0, 0],
        [1, 1],
      ]),
    ),
  ].map((template) => Object.freeze(template)),
);

function createShapeTemplate(
  id: string,
  rows: readonly string[],
): DogShapeTemplate {
  const playableCells = rows.flatMap((currentRow, y) =>
    [...currentRow].flatMap((value, x) => (value === "#" ? [{ x, y }] : [])),
  );
  return {
    id,
    shape: "irregular",
    width: TEMPLATE_WIDTH,
    height: TEMPLATE_HEIGHT,
    rows: Object.freeze([...rows]),
    playableCells: Object.freeze(playableCells),
  };
}

function createRows(holes: readonly Hole[]): readonly string[] {
  const holeKeys = new Set(holes.map(([x, y]) => `${x}:${y}`));
  const mask = Array.from({ length: BASE_TEMPLATE_HEIGHT }, (_, y) =>
    Array.from({ length: BASE_TEMPLATE_WIDTH }, (_, x) =>
      holeKeys.has(`${x}:${y}`) ? "." : "#",
    ).join(""),
  );

  return mask.flatMap((row) => {
    const scaledRow = [...row]
      .flatMap((value) => Array.from({ length: TEMPLATE_SCALE }, () => value))
      .join("");
    return Array.from({ length: TEMPLATE_SCALE }, () => scaledRow);
  });
}

function cellKey(cell: DogBoardCell): string {
  return `${cell.x}:${cell.y}`;
}

export function selectShapeTemplate(random: SeededRandom): DogShapeTemplate {
  return DOG_SHAPE_TEMPLATES.filter((template) => template.shape === "irregular")[
    random.nextInt(DOG_SHAPE_TEMPLATES.length)
  ]!;
}

export function createBoard(template: DogShapeTemplate): DogBoard {
  return Object.freeze({
    shape: template.shape,
    templateId: template.id,
    width: template.width,
    height: template.height,
    logicalCellSize: BLOCK_WIDTH,
    playableCells: Object.freeze(template.playableCells.map((cell) => ({ ...cell }))),
  });
}
