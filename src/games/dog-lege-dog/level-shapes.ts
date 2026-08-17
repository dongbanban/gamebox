import type { DogBoard, DogBoardCell, DogBoardShape } from "./level-types";
import { BLOCK_WIDTH } from "./level-types";
import { getProgressStage } from "./level-progression";
import { SeededRandom, weightedPick } from "./level-random";

const TEMPLATE_WIDTH = 24;
const TEMPLATE_HEIGHT = 20;

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

const SHAPE_POOLS: readonly (readonly DogBoardShape[])[] = [
  ["rectangle"],
  ["rectangle", "star"],
  ["rectangle", "star", "heart"],
  ["rectangle", "star", "heart", "irregular"],
];

const SHAPE_WEIGHTS: readonly (readonly number[])[] = [
  [1],
  [3, 1],
  [3, 2, 1],
  [1, 2, 3, 4],
];

export const DOG_SHAPE_TEMPLATES: readonly DogShapeTemplate[] = Object.freeze(
  [
    createShapeTemplate("rectangle-classic-1", "rectangle", createRows(row([0, 23]), [])),
    createShapeTemplate(
      "rectangle-rounded-2",
      "rectangle",
      createRows(row([0, 23]), [
        [0, row([4, 19])],
        [1, row([2, 21])],
        [2, row([1, 22])],
        [17, row([1, 22])],
        [18, row([2, 21])],
        [19, row([4, 19])],
      ]),
    ),
    createShapeTemplate(
      "rectangle-soft-3",
      "rectangle",
      createRows(row([0, 23]), [
        [0, row([2, 21])],
        [1, row([1, 22])],
        [18, row([1, 22])],
        [19, row([2, 21])],
      ]),
    ),
    createShapeTemplate(
      "star-wide-1",
      "star",
      createRows(row(), [
        [0, row([11, 12])],
        [1, row([10, 13])],
        [2, row([9, 14])],
        [3, row([8, 15])],
        [4, row([7, 16])],
        [5, row([0, 4], [8, 15], [19, 23])],
        [6, row([0, 5], [9, 14], [18, 23])],
        [7, row([1, 6], [10, 13], [17, 22])],
        [8, row([2, 21])],
        [9, row([1, 22])],
        [10, row([0, 23])],
        [11, row([1, 22])],
        [12, row([2, 21])],
        [13, row([3, 20])],
        [14, row([4, 19])],
        [15, row([5, 18])],
        [16, row([6, 17])],
        [17, row([7, 16])],
        [18, row([8, 15])],
        [19, row([9, 14])],
      ]),
    ),
    createShapeTemplate(
      "star-flat-2",
      "star",
      createRows(row(), [
        [0, row([10, 13])],
        [1, row([9, 14])],
        [2, row([8, 15])],
        [3, row([7, 16])],
        [4, row([0, 3], [6, 17], [20, 23])],
        [5, row([0, 4], [7, 16], [19, 23])],
        [6, row([1, 5], [8, 15], [18, 22])],
        [7, row([1, 21])],
        [8, row([0, 23])],
        [9, row([0, 23])],
        [10, row([1, 22])],
        [11, row([2, 21])],
        [12, row([3, 20])],
        [13, row([4, 19])],
        [14, row([5, 18])],
        [15, row([6, 17])],
        [16, row([7, 16])],
        [17, row([8, 15])],
        [18, row([9, 14])],
        [19, row([10, 13])],
      ]),
    ),
    createShapeTemplate(
      "star-leaning-3",
      "star",
      createRows(row(), [
        [0, row([11, 12])],
        [1, row([10, 13])],
        [2, row([9, 14])],
        [3, row([8, 15])],
        [4, row([7, 16])],
        [5, row([0, 5], [8, 15], [18, 23])],
        [6, row([0, 6], [9, 14], [17, 23])],
        [7, row([0, 7], [10, 13], [16, 23])],
        [8, row([1, 22])],
        [9, row([0, 23])],
        [10, row([0, 23])],
        [11, row([1, 22])],
        [12, row([2, 21])],
        [13, row([3, 20])],
        [14, row([4, 19])],
        [15, row([5, 18])],
        [16, row([6, 17])],
        [17, row([7, 16])],
        [18, row([8, 15])],
        [19, row([9, 14])],
      ]),
    ),
    createShapeTemplate(
      "heart-round-1",
      "heart",
      createRows(row(), [
        [0, row([5, 8], [15, 18])],
        [1, row([3, 10], [13, 20])],
        [2, row([2, 11], [12, 21])],
        [3, row([1, 22])],
        [4, row([0, 23])],
        [5, row([0, 23])],
        [6, row([0, 23])],
        [7, row([0, 23])],
        [8, row([1, 22])],
        [9, row([2, 21])],
        [10, row([3, 20])],
        [11, row([4, 19])],
        [12, row([5, 18])],
        [13, row([6, 17])],
        [14, row([7, 16])],
        [15, row([8, 15])],
        [16, row([9, 14])],
        [17, row([10, 13])],
        [18, row([11, 12])],
        [19, row([11, 12])],
      ]),
    ),
    createShapeTemplate(
      "heart-tall-2",
      "heart",
      createRows(row(), [
        [0, row([4, 9], [14, 19])],
        [1, row([2, 11], [12, 21])],
        [2, row([1, 22])],
        [3, row([0, 23])],
        [4, row([0, 23])],
        [5, row([0, 23])],
        [6, row([1, 22])],
        [7, row([1, 22])],
        [8, row([2, 21])],
        [9, row([3, 20])],
        [10, row([4, 19])],
        [11, row([5, 18])],
        [12, row([6, 17])],
        [13, row([7, 16])],
        [14, row([8, 15])],
        [15, row([9, 14])],
        [16, row([10, 13])],
        [17, row([11, 12])],
        [18, row([11, 12])],
        [19, row([11, 12])],
      ]),
    ),
    createShapeTemplate(
      "heart-open-3",
      "heart",
      createRows(row(), [
        [0, row([3, 10], [13, 20])],
        [1, row([2, 11], [12, 21])],
        [2, row([1, 22])],
        [3, row([0, 23])],
        [4, row([0, 23])],
        [5, row([0, 23])],
        [6, row([0, 23])],
        [7, row([1, 22])],
        [8, row([2, 21])],
        [9, row([3, 20])],
        [10, row([4, 19])],
        [11, row([5, 18])],
        [12, row([6, 17])],
        [13, row([7, 16])],
        [14, row([8, 15])],
        [15, row([9, 14])],
        [16, row([10, 13])],
        [17, row([11, 12])],
        [18, row([11, 12])],
        [19, row([11, 12])],
      ]),
    ),
    createShapeTemplate(
      "irregular-notch-1",
      "irregular",
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
      "irregular",
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
      "irregular",
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
  shape: DogBoardShape,
  rows: readonly string[],
): DogShapeTemplate {
  const playableCells = rows.flatMap((currentRow, y) =>
    [...currentRow].flatMap((value, x) => (value === "#" ? [{ x, y }] : [])),
  );
  return {
    id,
    shape,
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
  const rows = Array.from({ length: TEMPLATE_HEIGHT }, () => defaultRow);
  for (const [rowIndex, spans] of overrides) {
    rows[rowIndex] = spans;
  }

  return rows.map((spans) => {
    const cells = Array.from({ length: TEMPLATE_WIDTH }, () => ".");
    for (const [start, end] of spans) {
      for (let x = start; x <= end; x += 1) {
        cells[x] = "#";
      }
    }
    return cells.join("");
  });
}

function row(...spans: Span[]): SpanRow {
  return spans;
}

function cellKey(cell: DogBoardCell): string {
  return `${cell.x}:${cell.y}`;
}


export function getShapePool(levelNumber: number): readonly DogBoardShape[] {
  return SHAPE_POOLS[getProgressStage(levelNumber)];
}

export function selectShapeTemplate(levelNumber: number, random: SeededRandom): DogShapeTemplate {
  const shapePool = getShapePool(levelNumber);
  const shape = weightedPick(shapePool, SHAPE_WEIGHTS[getProgressStage(levelNumber)], random);
  const variants = DOG_SHAPE_TEMPLATES.filter((template) => template.shape === shape);
  return variants[random.nextInt(variants.length)];
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
