import {
  BLOCK_HEIGHT,
  BLOCK_WIDTH,
  DOG_PATTERN_TYPES,
  type DogBoard,
  type DogBoardCell,
  type DogBoardShape,
  type DogBlock,
  type DogLegeDogLevel,
  type DogPatternType,
} from "./level-types";

export const DOG_GAME_ID = "dog-lege-dog" as const;
export const LEVEL_GENERATOR_VERSION = 1 as const;
export const DEFAULT_LEVEL_SEED = DOG_GAME_ID;
export const DEFAULT_LEVEL_REWARD = 100 as const;

const TEMPLATE_WIDTH = 24;
const TEMPLATE_HEIGHT = 20;
const MAX_BLOCKS_PER_LOWER_BLOCK = 4;
const LAYER_OFFSETS = [
  { x: 0, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
  { x: 1, y: 0 },
] as const;

type ProgressStage = 0 | 1 | 2 | 3;

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

export interface LevelGeneratorRequest {
  readonly levelNumber: number;
  readonly seed: string;
  readonly generatorVersion: number;
}

export interface LevelGeneratorOptions {
  readonly gameId?: string;
}

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

export class LevelGenerator {
  private readonly gameId: string;

  constructor(options: LevelGeneratorOptions = {}) {
    this.gameId = options.gameId ?? DOG_GAME_ID;
  }

  generate(request: LevelGeneratorRequest): DogLegeDogLevel;
  generate(
    levelNumber: number,
    seed?: string,
    generatorVersion?: number,
  ): DogLegeDogLevel;
  generate(
    requestOrLevelNumber: LevelGeneratorRequest | number,
    seed = DEFAULT_LEVEL_SEED,
    generatorVersion = LEVEL_GENERATOR_VERSION,
  ): DogLegeDogLevel {
    const request = normalizeRequest(requestOrLevelNumber, seed, generatorVersion);
    validateRequest(request);

    const levelSeed = `${request.seed}:v${request.generatorVersion}:level-${request.levelNumber}`;
    const random = new SeededRandom(`${this.gameId}:${levelSeed}`);
    const blockCount = getBlockCount(request.levelNumber);
    const maxLayers = getMaxLayers(request.levelNumber);
    const shape = selectShapeTemplate(request.levelNumber, random);
    const placements = createBlockPlacements(shape, blockCount, maxLayers, random);
    const patternTypes = selectPatternTypes(request.levelNumber, random);
    const blocks = createBlocks(placements, patternTypes, request.levelNumber, random);
    const board = createBoard(shape);

    return Object.freeze({
      number: request.levelNumber,
      seed: levelSeed,
      generatorVersion: request.generatorVersion,
      maxLayers,
      reward: DEFAULT_LEVEL_REWARD,
      board,
      patternTypes: Object.freeze([...patternTypes]),
      blocks: Object.freeze(blocks),
    });
  }
}

export const DEFAULT_LEVEL_GENERATOR = new LevelGenerator();

export function generateDogLegeDogLevel(
  request: LevelGeneratorRequest,
): DogLegeDogLevel {
  return DEFAULT_LEVEL_GENERATOR.generate(request);
}

export function getBlockCount(levelNumber: number): number {
  validateLevelNumber(levelNumber);
  const stage = Math.min(5, Math.floor((levelNumber - 1) / 5));
  return 90 + stage * 18;
}

export function getMaxLayers(levelNumber: number): number {
  return [3, 4, 5, 6][getProgressStage(levelNumber)];
}

export function getPatternTypeCount(levelNumber: number): number {
  return [4, 6, 8, 10][getProgressStage(levelNumber)];
}

export function getShapePool(levelNumber: number): readonly DogBoardShape[] {
  return SHAPE_POOLS[getProgressStage(levelNumber)];
}

function normalizeRequest(
  requestOrLevelNumber: LevelGeneratorRequest | number,
  seed: string,
  generatorVersion: number,
): LevelGeneratorRequest {
  if (typeof requestOrLevelNumber === "number") {
    return {
      levelNumber: requestOrLevelNumber,
      seed,
      generatorVersion,
    };
  }

  return requestOrLevelNumber;
}

function validateRequest(request: LevelGeneratorRequest): void {
  validateLevelNumber(request.levelNumber);
  if (typeof request.seed !== "string" || request.seed.length === 0) {
    throw new Error("LevelGenerator seed must be a non-empty string");
  }

  if (!Number.isSafeInteger(request.generatorVersion) || request.generatorVersion < 1) {
    throw new Error("LevelGenerator version must be a positive integer");
  }
}

function validateLevelNumber(levelNumber: number): void {
  if (!Number.isSafeInteger(levelNumber) || levelNumber < 1) {
    throw new Error("狗了个狗 level number must be a positive integer");
  }
}

function getShapeWeights(levelNumber: number): readonly number[] {
  return SHAPE_WEIGHTS[getProgressStage(levelNumber)];
}

function getProgressStage(levelNumber: number): ProgressStage {
  validateLevelNumber(levelNumber);
  if (levelNumber <= 5) {
    return 0;
  }

  if (levelNumber <= 15) {
    return 1;
  }

  if (levelNumber <= 30) {
    return 2;
  }

  return 3;
}

function selectShapeTemplate(levelNumber: number, random: SeededRandom): DogShapeTemplate {
  const shapePool = getShapePool(levelNumber);
  const shape = weightedPick(shapePool, getShapeWeights(levelNumber), random);
  const variants = DOG_SHAPE_TEMPLATES.filter((template) => template.shape === shape);
  return variants[random.nextInt(variants.length)];
}

function selectPatternTypes(
  levelNumber: number,
  random: SeededRandom,
): readonly DogPatternType[] {
  return random.shuffle([...DOG_PATTERN_TYPES]).slice(0, getPatternTypeCount(levelNumber));
}

function createBoard(template: DogShapeTemplate): DogBoard {
  return Object.freeze({
    shape: template.shape,
    templateId: template.id,
    width: template.width,
    height: template.height,
    logicalCellSize: BLOCK_WIDTH,
    playableCells: Object.freeze(template.playableCells.map((cell) => ({ ...cell }))),
  });
}

interface BlockPlacement {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

function createBlockPlacements(
  template: DogShapeTemplate,
  blockCount: number,
  maxLayers: number,
  random: SeededRandom,
): readonly BlockPlacement[] {
  const layerCounts = distributeBlocks(blockCount, maxLayers);
  const placements: BlockPlacement[] = [];

  for (let z = 0; z < maxLayers; z += 1) {
    const desiredCount = layerCounts[z];
    const offsetStart = 0;
    let selected: BlockPlacement[] = [];

    for (let offsetAttempt = 0; offsetAttempt < LAYER_OFFSETS.length; offsetAttempt += 1) {
      const offset = LAYER_OFFSETS[(offsetStart + offsetAttempt) % LAYER_OFFSETS.length];
      selected = selectLayerPlacements(
        template,
        z,
        desiredCount,
        offset,
        placements,
        random,
      );
      if (selected.length === desiredCount) {
        break;
      }
    }

    if (selected.length !== desiredCount) {
      throw new Error(
        `LevelGenerator could not place layer ${z} for template ${template.id}`,
      );
    }

    placements.push(...selected);
  }

  return placements;
}

function distributeBlocks(blockCount: number, maxLayers: number): readonly number[] {
  const baseCount = Math.floor(blockCount / maxLayers);
  const remainder = blockCount % maxLayers;
  return Array.from({ length: maxLayers }, (_, index) => baseCount + (index < remainder ? 1 : 0));
}

function selectLayerPlacements(
  template: DogShapeTemplate,
  z: number,
  desiredCount: number,
  offset: (typeof LAYER_OFFSETS)[number],
  previousPlacements: readonly BlockPlacement[],
  random: SeededRandom,
): BlockPlacement[] {
  const candidates = random.shuffle([...getCandidateAnchors(template, offset.x, offset.y)]);
  const selected: BlockPlacement[] = [];

  while (selected.length < desiredCount && candidates.length > 0) {
    candidates.sort((first, second) =>
      compareCandidateCoverage(
        first,
        second,
        previousPlacements,
        selected,
      ));
    const candidate = candidates.shift();
    if (candidate === undefined) {
      break;
    }

    const placement = { ...candidate, z };
    if (selected.some((other) => blocksOverlap(placement, other))) {
      continue;
    }

    const wouldExceedCoverLimit = previousPlacements.some(
      (lowerBlock) =>
        blocksOverlap(placement, lowerBlock) &&
        countHigherOverlaps(lowerBlock, [...previousPlacements, ...selected]) >=
          MAX_BLOCKS_PER_LOWER_BLOCK,
    );
    if (wouldExceedCoverLimit) {
      continue;
    }

    selected.push(placement);
  }

  return selected;
}

function compareCandidateCoverage(
  first: Omit<BlockPlacement, "z">,
  second: Omit<BlockPlacement, "z">,
  previousPlacements: readonly BlockPlacement[],
  selected: readonly BlockPlacement[],
): number {
  const firstScore = candidateCoverageScore(first, previousPlacements, selected);
  const secondScore = candidateCoverageScore(second, previousPlacements, selected);
  return firstScore.maximum - secondScore.maximum || firstScore.total - secondScore.total;
}

function candidateCoverageScore(
  candidate: Omit<BlockPlacement, "z">,
  previousPlacements: readonly BlockPlacement[],
  selected: readonly BlockPlacement[],
): { maximum: number; total: number } {
  const candidatePlacement = { ...candidate, z: Number.MAX_SAFE_INTEGER };
  const lowerBlocks = previousPlacements.filter((block) => block.z < candidatePlacement.z);
  const counts = lowerBlocks
    .filter((lowerBlock) => blocksOverlap(candidatePlacement, lowerBlock))
    .map(
      (lowerBlock) =>
        countHigherOverlaps(lowerBlock, [...previousPlacements, ...selected]) + 1,
    );

  return {
    maximum: counts.length === 0 ? 0 : Math.max(...counts),
    total: counts.reduce((total, count) => total + count, 0),
  };
}

function getCandidateAnchors(
  template: DogShapeTemplate,
  offsetX: number,
  offsetY: number,
): readonly Omit<BlockPlacement, "z">[] {
  const playable = new Set(template.playableCells.map(cellKey));
  const candidates: Omit<BlockPlacement, "z">[] = [];

  for (let y = offsetY; y <= template.height - BLOCK_HEIGHT; y += 2) {
    for (let x = offsetX; x <= template.width - BLOCK_WIDTH; x += 2) {
      if (
        playable.has(cellKey({ x, y })) &&
        playable.has(cellKey({ x: x + 1, y })) &&
        playable.has(cellKey({ x, y: y + 1 })) &&
        playable.has(cellKey({ x: x + 1, y: y + 1 }))
      ) {
        candidates.push({ x, y });
      }
    }
  }

  return candidates;
}

function countHigherOverlaps(
  lowerBlock: BlockPlacement,
  placements: readonly BlockPlacement[],
): number {
  return placements.filter(
    (other) => other.z > lowerBlock.z && blocksOverlap(lowerBlock, other),
  ).length;
}

function blocksOverlap(first: BlockPlacement, second: BlockPlacement): boolean {
  return (
    first.x < second.x + BLOCK_WIDTH &&
    second.x < first.x + BLOCK_WIDTH &&
    first.y < second.y + BLOCK_HEIGHT &&
    second.y < first.y + BLOCK_HEIGHT
  );
}

function createBlocks(
  placements: readonly BlockPlacement[],
  patternTypes: readonly DogPatternType[],
  levelNumber: number,
  random: SeededRandom,
): readonly DogBlock[] {
  const patternByBlock = new Array<DogPatternType>(placements.length);
  const blockOrder = random.shuffle(placements.map((_, index) => index));
  const groupCount = placements.length / 3;
  const groupPatterns = Array.from(
    { length: groupCount },
    (_, index) => patternTypes[index % patternTypes.length],
  );
  random.shuffle(groupPatterns);

  for (let groupIndex = 0; groupIndex < groupPatterns.length; groupIndex += 1) {
    const patternType = groupPatterns[groupIndex];
    for (let memberIndex = 0; memberIndex < 3; memberIndex += 1) {
      patternByBlock[blockOrder[groupIndex * 3 + memberIndex]] = patternType;
    }
  }

  return placements.map((placement, index) => ({
    id: `level-${levelNumber}-block-${index + 1}`,
    x: placement.x,
    y: placement.y,
    z: placement.z,
    width: BLOCK_WIDTH,
    height: BLOCK_HEIGHT,
    rotation: 0,
    patternType: patternByBlock[index],
  }));
}

function weightedPick<T>(
  values: readonly T[],
  weights: readonly number[],
  random: SeededRandom,
): T {
  const totalWeight = weights.reduce((total, weight) => total + weight, 0);
  let target = random.next() * totalWeight;
  for (let index = 0; index < values.length; index += 1) {
    target -= weights[index];
    if (target < 0) {
      return values[index];
    }
  }

  return values[values.length - 1];
}

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

class SeededRandom {
  private state: number;

  constructor(seed: string) {
    this.state = hashSeed(seed);
  }

  next(): number {
    this.state = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    this.state ^= this.state + Math.imul(this.state ^ (this.state >>> 7), 61 | this.state);
    return ((this.state ^ (this.state >>> 14)) >>> 0) / 4_294_967_296;
  }

  nextInt(maxExclusive: number): number {
    return Math.floor(this.next() * maxExclusive);
  }

  shuffle<T>(values: T[]): T[] {
    for (let index = values.length - 1; index > 0; index -= 1) {
      const swapIndex = this.nextInt(index + 1);
      [values[index], values[swapIndex]] = [values[swapIndex], values[index]];
    }
    return values;
  }
}

function hashSeed(seed: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }

  return hash || 1;
}
