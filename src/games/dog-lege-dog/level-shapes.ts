import type { DogBoard, DogBoardCell, DogBoardShape } from "./level-types";
import { BLOCK_WIDTH } from "./level-types";
import { FIRST_LEVEL_TEMPLATE_ID } from "./game-config";
import { SeededRandom } from "./level-random";

const BASE_TEMPLATE_WIDTH = 24;
const BASE_TEMPLATE_HEIGHT = 20;
const TEMPLATE_SCALE = 2;
const TEMPLATE_WIDTH = BASE_TEMPLATE_WIDTH * TEMPLATE_SCALE;
const TEMPLATE_HEIGHT = BASE_TEMPLATE_HEIGHT * TEMPLATE_SCALE;

type Span = readonly [number, number];
type SpanRow = readonly Span[];

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
 */
export const DOG_SHAPE_TEMPLATES: readonly DogShapeTemplate[] = Object.freeze(
  [
    createShapeTemplate(
      FIRST_LEVEL_TEMPLATE_ID,
      createRows(row([0, 23]), [
        [0, row([2, 21])],
        [3, row([0, 5], [8, 23])],
        [17, row([0, 3], [6, 23])],
        [18, row([2, 21])],
        [19, row([7, 16])],
      ]),
    ),
    createShapeTemplate(
      "irregular-notch-1",
      createRows(row([0, 23]), [
        [0, row([4, 19])],
        [1, row([2, 21])],
        [2, row([0, 23])],
        [3, row([0, 8], [11, 23])],
        [4, row([0, 8], [11, 23])],
        [5, row([0, 8], [11, 23])],
        [6, row([0, 23])],
        [7, row([0, 23])],
        [8, row([0, 23])],
        [9, row([0, 23])],
        [10, row([0, 23])],
        [11, row([0, 23])],
        [12, row([0, 5], [8, 23])],
        [13, row([0, 5], [8, 23])],
        [14, row([0, 5], [8, 23])],
        [15, row([0, 23])],
        [16, row([0, 23])],
        [17, row([0, 23])],
        [18, row([3, 20])],
        [19, row([6, 17])],
      ]),
    ),
    createShapeTemplate(
      "irregular-split-2",
      createRows(row([0, 23]), [
        [0, row([0, 14])],
        [1, row([0, 16])],
        [2, row([0, 23])],
        [3, row([0, 4], [7, 23])],
        [4, row([0, 4], [7, 23])],
        [5, row([0, 4], [7, 23])],
        [6, row([0, 23])],
        [7, row([0, 23])],
        [8, row([0, 23])],
        [9, row([0, 23])],
        [10, row([2, 23])],
        [11, row([2, 23])],
        [12, row([2, 23])],
        [13, row([2, 23])],
        [14, row([2, 10], [13, 21])],
        [15, row([2, 10], [13, 21])],
        [16, row([2, 10], [13, 21])],
        [17, row([4, 20])],
        [18, row([6, 18])],
        [19, row([8, 16])],
      ]),
    ),
    createShapeTemplate(
      "irregular-wind-3",
      createRows(row([0, 23]), [
        [0, row([1, 20])],
        [1, row([1, 20])],
        [2, row([0, 23])],
        [3, row([0, 23])],
        [4, row([0, 6], [9, 23])],
        [5, row([0, 6], [9, 23])],
        [6, row([0, 23])],
        [7, row([0, 23])],
        [8, row([0, 23])],
        [9, row([0, 23])],
        [10, row([0, 23])],
        [11, row([0, 23])],
        [12, row([0, 3], [6, 23])],
        [13, row([0, 3], [6, 23])],
        [14, row([0, 23])],
        [15, row([0, 23])],
        [16, row([0, 23])],
        [17, row([1, 22])],
        [18, row([4, 19])],
        [19, row([7, 16])],
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

function createRows(
  defaultRow: SpanRow,
  overrides: readonly (readonly [number, SpanRow])[],
): readonly string[] {
  const rows = Array.from({ length: BASE_TEMPLATE_HEIGHT }, () => defaultRow);
  for (const [rowIndex, spans] of overrides) {
    rows[rowIndex] = spans;
  }

  return rows.flatMap((spans) => {
    const cells = Array.from({ length: BASE_TEMPLATE_WIDTH }, () => ".");
    for (const [start, end] of spans) {
      for (let x = start; x <= end; x += 1) {
        cells[x] = "#";
      }
    }
    const scaledRow = cells
      .flatMap((value) => Array.from({ length: TEMPLATE_SCALE }, () => value))
      .join("");
    return Array.from({ length: TEMPLATE_SCALE }, () => scaledRow);
  });
}

function row(...spans: Span[]): SpanRow {
  return spans;
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
