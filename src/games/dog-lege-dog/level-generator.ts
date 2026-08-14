import {
  BLOCK_HEIGHT,
  BLOCK_WIDTH,
  DOG_PATTERN_TYPES,
  type DogBoard,
  type DogBoardCell,
  type DogBoardShape,
  type DogBlock,
  type DogDifficultyTarget,
  type DogLevelDifficulty,
  type DogLevelGeneration,
  type DogLevelGenerationFailure,
  type DogLevelReplay,
  type DogLevelReplayMode,
  type DogLegeDogLevel,
  type DogPatternType,
} from "./level-types";
import { hasPositiveAreaOverlap, insertPatternIntoTray } from "./level-rules";
import { FIRST_LEVEL, FIRST_LEVEL_SEED } from "./first-level";

export const DOG_GAME_ID = "dog-lege-dog" as const;
export const LEVEL_GENERATOR_VERSION = 2 as const;
export const DEFAULT_LEVEL_SEED = DOG_GAME_ID;
export const DEFAULT_LEVEL_REWARD = 100 as const;
export const MAX_LEVEL_GENERATION_ATTEMPTS = 100 as const;

const TEMPLATE_WIDTH = 24;
const TEMPLATE_HEIGHT = 20;
const MAX_BLOCKS_PER_LOWER_BLOCK = 4;
const MAX_SOLVABILITY_SEARCH_STATES = 16;
const LAYER_OFFSETS = [
  { x: 0, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
  { x: 1, y: 0 },
] as const;

type ProgressStage = 0 | 1 | 2 | 3;

const DIFFICULTY_TARGETS: readonly DogDifficultyTarget[] = [
  {
    safeChoiceCount: { min: 3, max: Number.MAX_SAFE_INTEGER },
    durationMinutes: { min: 6, max: 8 },
  },
  {
    safeChoiceCount: { min: 2, max: Number.MAX_SAFE_INTEGER },
    durationMinutes: { min: 7, max: 9 },
  },
  {
    safeChoiceCount: { min: 1, max: 2 },
    durationMinutes: { min: 8, max: 10 },
  },
  {
    safeChoiceCount: { min: 1, max: 2 },
    durationMinutes: { min: 8, max: 12 },
  },
].map((target) =>
  Object.freeze({
    safeChoiceCount: Object.freeze({ ...target.safeChoiceCount }),
    durationMinutes: Object.freeze({ ...target.durationMinutes }),
  }),
);

const SHAPE_COMPLEXITY: Readonly<Record<DogBoardShape, number>> = {
  rectangle: 1,
  star: 2,
  heart: 3,
  irregular: 4,
};

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
  readonly testSeed?: string;
  readonly generatorVersion: number;
}

export interface LevelGeneratorOptions {
  readonly gameId?: string;
}

type LevelGeometry = Pick<
  DogLegeDogLevel,
  "number" | "maxLayers" | "board" | "patternTypes" | "blocks"
>;

interface PathVerification {
  readonly solvable: boolean;
  readonly path: readonly string[];
  readonly trayPeakPressure: number;
  readonly reason?: string;
}

interface CandidateLevel {
  readonly attempt: number;
  readonly number: number;
  readonly seed: string;
  readonly generatorVersion: number;
  readonly maxLayers: number;
  readonly reward: number;
  readonly board: DogBoard;
  readonly patternTypes: readonly DogPatternType[];
  readonly blocks: readonly DogBlock[];
  readonly solutionPath: readonly string[];
  readonly difficulty: DogLevelDifficulty;
  readonly baseSeed: string;
  readonly testSeed: string;
  readonly replayMode: DogLevelReplayMode;
  readonly randomSeed: string;
}

interface RemovalPathPlan {
  readonly order: readonly number[];
  readonly layerByBlock: readonly number[];
}

type TemplateFactory = (random: SeededRandom) => DogShapeTemplate;
type PlacementFactory = (
  template: DogShapeTemplate,
  blockCount: number,
  maxLayers: number,
  random: SeededRandom,
  removalPlan: RemovalPathPlan,
) => readonly BlockPlacement[];

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
    const testSeed = request.testSeed ?? request.seed;
    const failures: DogLevelGenerationFailure[] = [];
    let closestCandidate: CandidateLevel | undefined;

    for (let attempt = 1; attempt <= MAX_LEVEL_GENERATION_ATTEMPTS; attempt += 1) {
      try {
        const candidate = this.createCandidate(
          request,
          levelSeed,
          testSeed,
          attempt,
        );
        if (
          closestCandidate === undefined ||
          compareDifficultyDistance(candidate.difficulty, closestCandidate.difficulty) < 0
        ) {
          closestCandidate = candidate;
        }

        if (
          isDifficultyWithinTarget(
            candidate.difficulty,
            getRelaxedDifficultyTarget(request.levelNumber, attempt),
          )
        ) {
          return finalizeCandidate(
            candidate,
            attempt,
            !candidate.difficulty.withinTarget,
            failures,
          );
        }

        failures.push(
          createGenerationFailure(
            request,
            levelSeed,
            testSeed,
            attempt,
            "difficulty-out-of-range",
            "generated",
            getCandidateRandomSeed(this.gameId, levelSeed, testSeed, attempt),
          ),
        );
      } catch (error) {
        failures.push(
          createGenerationFailure(
            request,
            levelSeed,
            testSeed,
            attempt,
            error instanceof Error ? error.message : "unknown-generation-error",
            "generated",
            getCandidateRandomSeed(this.gameId, levelSeed, testSeed, attempt),
          ),
        );
      }
    }

    let fallback = closestCandidate;
    if (fallback === undefined) {
      try {
        fallback = this.createFallbackCandidate(request, levelSeed, testSeed);
      } catch (error) {
        failures.push(
          createGenerationFailure(
            request,
            levelSeed,
            testSeed,
            MAX_LEVEL_GENERATION_ATTEMPTS,
            `fallback-failed: ${error instanceof Error ? error.message : "unknown-error"}`,
            "generated",
            getCandidateRandomSeed(
              this.gameId,
              levelSeed,
              testSeed,
              MAX_LEVEL_GENERATION_ATTEMPTS,
            ),
          ),
        );
        try {
          fallback = this.createEmergencyCandidate(request, levelSeed, testSeed);
        } catch (emergencyError) {
          failures.push(
            createGenerationFailure(
              request,
              levelSeed,
              testSeed,
              MAX_LEVEL_GENERATION_ATTEMPTS,
              `emergency-fallback-failed: ${
                emergencyError instanceof Error ? emergencyError.message : "unknown-error"
              }`,
              "guaranteed",
              getGuaranteedRandomSeed(this.gameId, levelSeed),
            ),
          );
          fallback = this.createLastResortCandidate(request, levelSeed, testSeed);
        }
      }
    }

    return finalizeCandidate(fallback, MAX_LEVEL_GENERATION_ATTEMPTS, true, failures);
  }

  findSolvablePath(level: DogLegeDogLevel): readonly string[] | null {
    return findSolvablePath(level);
  }

  isSolvable(level: DogLegeDogLevel): boolean {
    return this.findSolvablePath(level) !== null;
  }

  getDifficultyMetrics(level: DogLegeDogLevel): DogLevelDifficulty {
    return calculateDifficultyMetrics(level, this.findSolvablePath(level) ?? undefined);
  }

  replay(replay: DogLevelReplay): DogLegeDogLevel {
    validateReplay(replay);
    if (isFirstLevelReplay(replay)) {
      return FIRST_LEVEL;
    }

    return this.generate({
      levelNumber: replay.levelNumber,
      seed: replay.seed,
      testSeed: replay.testSeed,
      generatorVersion: replay.generatorVersion,
    });
  }

  replayAttempt(replay: DogLevelReplay): DogLegeDogLevel {
    validateReplay(replay);
    if (isFirstLevelReplay(replay)) {
      return FIRST_LEVEL;
    }

    const request: LevelGeneratorRequest = {
      levelNumber: replay.levelNumber,
      seed: replay.seed,
      testSeed: replay.testSeed,
      generatorVersion: replay.generatorVersion,
    };
    const levelSeed = `${request.seed}:v${request.generatorVersion}:level-${request.levelNumber}`;
    const candidate = replay.mode === "guaranteed"
      ? this.createGuaranteedCandidate(
          request,
          levelSeed,
          replay.testSeed,
          getFallbackTemplate("emergency"),
          replay.randomSeed,
        )
      : this.createCandidate(
          request,
          levelSeed,
          replay.testSeed,
          replay.attempt,
          undefined,
          replay.randomSeed,
        );
    return finalizeCandidate(
      candidate,
      replay.attempt,
      !candidate.difficulty.withinTarget,
      [],
    );
  }

  replayFailure(failure: DogLevelGenerationFailure): DogLegeDogLevel {
    return this.replayAttempt(failure);
  }

  private createCandidate(
    request: LevelGeneratorRequest,
    levelSeed: string,
    testSeed: string,
    attempt: number,
    templateOverride?: DogShapeTemplate,
    randomSeed?: string,
  ): CandidateLevel {
    const candidateRandomSeed =
      randomSeed ?? getCandidateRandomSeed(this.gameId, levelSeed, testSeed, attempt);
    return this.createCandidateWithPlacementStrategy(
      request,
      levelSeed,
      testSeed,
      attempt,
      candidateRandomSeed,
      "generated",
      (random) => templateOverride ?? selectShapeTemplate(request.levelNumber, random),
      createSolvableBlockPlacements,
    );
  }

  private createCandidateWithPlacementStrategy(
    request: LevelGeneratorRequest,
    levelSeed: string,
    testSeed: string,
    attempt: number,
    randomSeed: string,
    replayMode: DogLevelReplayMode,
    templateFactory: TemplateFactory,
    placementFactory: PlacementFactory,
  ): CandidateLevel {
    const random = new SeededRandom(randomSeed);
    const blockCount = getBlockCount(request.levelNumber);
    const maxLayers = getMaxLayers(request.levelNumber);
    const plannedRemovalPlan = createRemovalPathPlan(blockCount, maxLayers, random);
    const shape = templateFactory(random);
    const placements = placementFactory(
      shape,
      blockCount,
      maxLayers,
      random,
      plannedRemovalPlan,
    );
    const patternTypes = selectPatternTypes(request.levelNumber, random);
    const removalPlan = resolveRemovalPathPlan(
      placements,
      random,
      plannedRemovalPlan.order,
    );
    const { blocks, solutionPath } = createSolvableBlocks(
      placements,
      patternTypes,
      request.levelNumber,
      random,
      removalPlan,
    );
    return createCandidateLevel(
      request,
      levelSeed,
      testSeed,
      attempt,
      maxLayers,
      createBoard(shape),
      patternTypes,
      blocks,
      solutionPath,
      replayMode,
      randomSeed,
    );
  }

  private createFallbackCandidate(
    request: LevelGeneratorRequest,
    levelSeed: string,
    testSeed: string,
  ): CandidateLevel {
    const fallbackTemplate = getFallbackTemplate("fallback");

    return this.createCandidate(
      request,
      levelSeed,
      testSeed,
      MAX_LEVEL_GENERATION_ATTEMPTS,
      fallbackTemplate,
    );
  }

  private createEmergencyCandidate(
    request: LevelGeneratorRequest,
    levelSeed: string,
    testSeed: string,
  ): CandidateLevel {
    const fallbackTemplate = getFallbackTemplate("emergency");
    return this.createGuaranteedCandidate(
      request,
      levelSeed,
      testSeed,
      fallbackTemplate,
    );
  }

  private createLastResortCandidate(
    request: LevelGeneratorRequest,
    levelSeed: string,
    testSeed: string,
  ): CandidateLevel {
    return this.createGuaranteedCandidate(
      request,
      levelSeed,
      testSeed,
      DOG_SHAPE_TEMPLATES[0],
    );
  }

  private createGuaranteedCandidate(
    request: LevelGeneratorRequest,
    levelSeed: string,
    testSeed: string,
    template: DogShapeTemplate | undefined,
    randomSeed = getGuaranteedRandomSeed(this.gameId, levelSeed),
  ): CandidateLevel {
    if (template === undefined) {
      throw new Error("LevelGenerator has no emergency template");
    }
    return this.createCandidateWithPlacementStrategy(
      request,
      levelSeed,
      testSeed,
      MAX_LEVEL_GENERATION_ATTEMPTS,
      randomSeed,
      "guaranteed",
      () => template,
      createGuaranteedBlockPlacements,
    );
  }
}

function createCandidateLevel(
  request: LevelGeneratorRequest,
  levelSeed: string,
  testSeed: string,
  attempt: number,
  maxLayers: number,
  board: DogBoard,
  patternTypes: readonly DogPatternType[],
  blocks: readonly DogBlock[],
  solutionPath: readonly string[],
  replayMode: DogLevelReplayMode,
  randomSeed: string,
): CandidateLevel {
  const geometry: LevelGeometry = {
    number: request.levelNumber,
    maxLayers,
    board,
    patternTypes,
    blocks,
  };
  const verification = verifyRemovalPath(geometry, solutionPath);
  if (!verification.solvable) {
    throw new Error(verification.reason ?? "LevelGenerator created an unsolvable level");
  }

  return {
    attempt,
    number: request.levelNumber,
    seed: levelSeed,
    generatorVersion: request.generatorVersion,
    maxLayers,
    reward: DEFAULT_LEVEL_REWARD,
    board,
    patternTypes: Object.freeze([...patternTypes]),
    blocks: Object.freeze([...blocks]),
    solutionPath: Object.freeze([...solutionPath]),
    difficulty: calculateDifficultyMetrics(geometry, solutionPath, verification),
    baseSeed: request.seed,
    testSeed,
    replayMode,
    randomSeed,
  };
}

function isFirstLevelReplay(replay: DogLevelReplay): boolean {
  return (
    replay.mode === "fixed" &&
    replay.levelNumber === 1 &&
    replay.levelSeed === FIRST_LEVEL_SEED
  );
}

function getFallbackTemplate(kind: "fallback" | "emergency"): DogShapeTemplate {
  const template = DOG_SHAPE_TEMPLATES.find(
    (candidate) => candidate.id === "rectangle-classic-1",
  );
  if (template === undefined) {
    throw new Error(`LevelGenerator ${kind} template is unavailable`);
  }

  return template;
}

export const DEFAULT_LEVEL_GENERATOR = new LevelGenerator();

export function generateDogLegeDogLevel(
  request: LevelGeneratorRequest,
): DogLegeDogLevel {
  return DEFAULT_LEVEL_GENERATOR.generate(request);
}

export function replayDogLegeDogLevel(replay: DogLevelReplay): DogLegeDogLevel {
  return DEFAULT_LEVEL_GENERATOR.replay(replay);
}

export function replayDogLegeDogLevelAttempt(
  replay: DogLevelReplay,
): DogLegeDogLevel {
  return DEFAULT_LEVEL_GENERATOR.replayAttempt(replay);
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

export function getDifficultyTarget(levelNumber: number): DogDifficultyTarget {
  const target = DIFFICULTY_TARGETS[getProgressStage(levelNumber)];
  return {
    safeChoiceCount: { ...target.safeChoiceCount },
    durationMinutes: { ...target.durationMinutes },
  };
}

export function isDifficultyWithinTarget(
  difficulty: DogLevelDifficulty,
  target: DogDifficultyTarget = difficulty.target,
): boolean {
  return (
    isWithinRange(difficulty.safeChoiceCount, target.safeChoiceCount) &&
    isWithinRange(difficulty.estimatedDurationMinutes, target.durationMinutes)
  );
}

export function findSolvablePath(
  level: LevelGeometry & { readonly solutionPath?: readonly string[] },
): readonly string[] | null {
  if (level.solutionPath !== undefined && level.solutionPath.length > 0) {
    const storedVerification = verifyRemovalPath(level, level.solutionPath);
    if (storedVerification.solvable) {
      return [...level.solutionPath];
    }
  }

  const descendingPath = [...level.blocks]
    .sort((first, second) => second.z - first.z || first.id.localeCompare(second.id))
    .map((block) => block.id);
  const descendingVerification = verifyRemovalPath(level, descendingPath);
  if (descendingVerification.solvable) {
    return descendingPath;
  }

  return findGreedySolvablePath(level);
}

export function isLevelSolvable(level: DogLegeDogLevel): boolean {
  return findSolvablePath(level) !== null;
}

export function getLevelDifficultyMetrics(level: DogLegeDogLevel): DogLevelDifficulty {
  return calculateDifficultyMetrics(level, findSolvablePath(level) ?? undefined);
}

export function calculateDifficultyMetrics(
  level: LevelGeometry,
  solutionPath?: readonly string[],
  knownVerification?: PathVerification,
): DogLevelDifficulty {
  const path = solutionPath ?? findSolvablePath(level as DogLegeDogLevel) ?? [];
  const verification =
    knownVerification ?? verifyRemovalPath(level, path);
  const graph = createBlockGraph(level.blocks);
  const initialSelectable = graph.higherBlockCounts.filter((count) => count === 0).length;
  const rawSafeChoiceCount = countSafeChoices(level, path, graph);
  const safeChoiceCount = rawSafeChoiceCount;
  const coveredBlocks = graph.higherBlockCounts.filter((count) => count > 0).length;
  const coverageRate = level.blocks.length === 0 ? 0 : coveredBlocks / level.blocks.length;
  const target = getDifficultyTarget(level.number);
  const shapeComplexity = SHAPE_COMPLEXITY[level.board.shape];
  const estimatedDurationMinutes = estimateDurationMinutes(
    level,
    coverageRate,
    safeChoiceCount,
    verification.trayPeakPressure,
  );
  const difficulty = {
    blockCount: level.blocks.length,
    maxLayers: level.maxLayers,
    coverageRate,
    initialSelectableCount: initialSelectable,
    rawSafeChoiceCount,
    safeChoiceCount,
    trayPeakPressure: verification.trayPeakPressure,
    shapeComplexity,
    patternTypeCount: level.patternTypes.length,
    estimatedDurationMinutes,
    target,
    withinTarget: false,
  } satisfies DogLevelDifficulty;

  return Object.freeze({
    ...difficulty,
    withinTarget: verification.solvable && isDifficultyWithinTarget(difficulty, target),
  });
}

function finalizeCandidate(
  candidate: CandidateLevel,
  attempts: number,
  fallbackUsed: boolean,
  failures: readonly DogLevelGenerationFailure[],
): DogLegeDogLevel {
  const { baseSeed, testSeed, ...level } = candidate;
  const replay: DogLevelReplay = Object.freeze({
    attempt: candidate.attempt,
    levelNumber: candidate.number,
    seed: baseSeed,
    levelSeed: candidate.seed,
    testSeed,
    generatorVersion: candidate.generatorVersion,
    mode: candidate.replayMode,
    randomSeed: candidate.randomSeed,
  });
  const generation: DogLevelGeneration = Object.freeze({
    attempts,
    fallbackUsed,
    replay,
    failures: Object.freeze(
      failures.map((failure) => Object.freeze({ ...failure })),
    ),
  });

  return Object.freeze({
    ...level,
    generation,
  });
}

function createGenerationFailure(
  request: LevelGeneratorRequest,
  levelSeed: string,
  testSeed: string,
  attempt: number,
  reason: string,
  mode: DogLevelReplayMode,
  randomSeed: string,
): DogLevelGenerationFailure {
  return {
    attempt,
    levelNumber: request.levelNumber,
    seed: request.seed,
    levelSeed,
    testSeed,
    generatorVersion: request.generatorVersion,
    mode,
    randomSeed,
    reason,
  };
}

function getCandidateRandomSeed(
  gameId: string,
  levelSeed: string,
  testSeed: string,
  attempt: number,
): string {
  return `${gameId}:${levelSeed}:${testSeed}:attempt-${attempt}`;
}

function getGuaranteedRandomSeed(gameId: string, levelSeed: string): string {
  return `${gameId}:guaranteed:${levelSeed}`;
}

function getRelaxedDifficultyTarget(
  levelNumber: number,
  attempt: number,
): DogDifficultyTarget {
  const target = getDifficultyTarget(levelNumber);
  const relaxationSteps = Math.floor(Math.max(0, attempt - 1) / 25);
  return {
    safeChoiceCount: {
      min: Math.max(1, target.safeChoiceCount.min - relaxationSteps),
      max: target.safeChoiceCount.max + relaxationSteps,
    },
    durationMinutes: {
      min: Math.max(1, target.durationMinutes.min - relaxationSteps * 0.25),
      max: target.durationMinutes.max + relaxationSteps * 0.25,
    },
  };
}

function compareDifficultyDistance(
  first: DogLevelDifficulty,
  second: DogLevelDifficulty,
): number {
  return difficultyDistance(first) - difficultyDistance(second);
}

function difficultyDistance(difficulty: DogLevelDifficulty): number {
  const safeDistance = rangeDistance(
    difficulty.safeChoiceCount,
    difficulty.target.safeChoiceCount,
  );
  const durationDistance = rangeDistance(
    difficulty.estimatedDurationMinutes,
    difficulty.target.durationMinutes,
  );
  return safeDistance * 10 + durationDistance;
}

function rangeDistance(value: number, range: { min: number; max: number }): number {
  if (value < range.min) {
    return range.min - value;
  }

  if (value > range.max) {
    return value - range.max;
  }

  return 0;
}

function isWithinRange(
  value: number,
  range: { min: number; max: number },
): boolean {
  return value >= range.min && value <= range.max;
}

function estimateDurationMinutes(
  level: LevelGeometry,
  coverageRate: number,
  safeChoiceCount: number,
  trayPeakPressure: number,
): number {
  const shapeScore = SHAPE_COMPLEXITY[level.board.shape] / 4;
  const blockScore = level.blocks.length / 180;
  const layerScore = level.maxLayers / 6;
  const pressureScore = trayPeakPressure / 7;
  const safeChoiceScore = 1 / Math.max(1, safeChoiceCount);
  const rawDuration =
    3.8 +
    3 * blockScore +
    1.4 * layerScore +
    1.2 * coverageRate +
    0.7 * shapeScore +
    0.4 * pressureScore +
    0.4 * safeChoiceScore;
  return Math.round(rawDuration * 10) / 10;
}

interface BlockGraph {
  readonly indexById: ReadonlyMap<string, number>;
  readonly higherBlockCounts: number[];
  readonly lowerBlockIndicesByHigher: number[][];
}

interface LayeredRectangle {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly width: number;
  readonly height: number;
}

interface OverlapGraph {
  readonly higherBlockCounts: number[];
  readonly lowerBlockIndicesByHigher: number[][];
}

function createBlockGraph(blocks: readonly DogBlock[]): BlockGraph {
  const indexById = new Map<string, number>();
  for (let index = 0; index < blocks.length; index += 1) {
    indexById.set(blocks[index].id, index);
  }

  return {
    indexById,
    ...createOverlapGraph(blocks),
  };
}

function createOverlapGraph(rectangles: readonly LayeredRectangle[]): OverlapGraph {
  const higherBlockCounts = Array.from({ length: rectangles.length }, () => 0);
  const lowerBlockIndicesByHigher = Array.from(
    { length: rectangles.length },
    () => [] as number[],
  );

  for (let firstIndex = 0; firstIndex < rectangles.length; firstIndex += 1) {
    for (
      let secondIndex = firstIndex + 1;
      secondIndex < rectangles.length;
      secondIndex += 1
    ) {
      const first = rectangles[firstIndex];
      const second = rectangles[secondIndex];
      if (
        first.z === second.z ||
        !hasPositiveAreaOverlap(first, second)
      ) {
        continue;
      }

      const higherIndex = first.z > second.z ? firstIndex : secondIndex;
      const lowerIndex = first.z > second.z ? secondIndex : firstIndex;
      higherBlockCounts[lowerIndex] += 1;
      lowerBlockIndicesByHigher[higherIndex].push(lowerIndex);
    }
  }

  return { higherBlockCounts, lowerBlockIndicesByHigher };
}

function verifyRemovalPath(
  level: LevelGeometry,
  path: readonly string[],
  knownGraph?: BlockGraph,
): PathVerification {
  if (path.length !== level.blocks.length) {
    return {
      solvable: false,
      path,
      trayPeakPressure: 0,
      reason: "solvable path must contain every block exactly once",
    };
  }

  const graph = knownGraph ?? createBlockGraph(level.blocks);
  const remaining = new Set(level.blocks.map((_, index) => index));
  const higherBlockCounts = [...graph.higherBlockCounts];
  const tray: DogPatternType[] = [];
  const seen = new Set<number>();
  let trayPeakPressure = 0;

  for (const blockId of path) {
    const blockIndex = graph.indexById.get(blockId);
    if (blockIndex === undefined || seen.has(blockIndex)) {
      return {
        solvable: false,
        path,
        trayPeakPressure,
        reason: `solvable path contains duplicate or unknown block ${blockId}`,
      };
    }

    if (!remaining.has(blockIndex)) {
      return {
        solvable: false,
        path,
        trayPeakPressure,
        reason: `solvable path removes block ${blockId} more than once`,
      };
    }

    if (higherBlockCounts[blockIndex] !== 0) {
      return {
        solvable: false,
        path,
        trayPeakPressure,
        reason: `solvable path selects blocked block ${blockId}`,
      };
    }

    seen.add(blockIndex);
    remaining.delete(blockIndex);
    for (const lowerIndex of graph.lowerBlockIndicesByHigher[blockIndex]) {
      higherBlockCounts[lowerIndex] -= 1;
    }

    insertPatternIntoTray(tray, level.blocks[blockIndex].patternType);
    trayPeakPressure = Math.max(trayPeakPressure, tray.length);
    if (tray.length >= 7 && remaining.size > 0) {
      return {
        solvable: false,
        path,
        trayPeakPressure,
        reason: "solvable path fills the seven-slot tray before clearing the board",
      };
    }
  }

  return {
    solvable: remaining.size === 0,
    path,
    trayPeakPressure,
    reason: remaining.size === 0 ? undefined : "solvable path leaves blocks behind",
  };
}

function countSafeChoices(
  level: LevelGeometry,
  solutionPath: readonly string[],
  graph: BlockGraph,
): number {
  if (solutionPath.length !== level.blocks.length) {
    return 0;
  }

  let safeChoices = 0;
  for (let index = 0; index < level.blocks.length; index += 1) {
    if (graph.higherBlockCounts[index] !== 0) {
      continue;
    }

    const blockId = level.blocks[index].id;
    const candidatePath = [
      blockId,
      ...solutionPath.filter((pathBlockId) => pathBlockId !== blockId),
    ];
    if (
      verifyRemovalPath(level, candidatePath, graph).solvable ||
      hasSolvableContinuation(level, solutionPath, graph, index)
    ) {
      safeChoices += 1;
    }
  }

  return safeChoices;
}

function hasSolvableContinuation(
  level: LevelGeometry,
  solutionPath: readonly string[],
  graph: BlockGraph,
  firstBlockIndex: number,
): boolean {
  const remainingMask = createFullBlockMask(level.blocks.length) &
    ~blockMask(firstBlockIndex);
  const tray: DogPatternType[] = [];
  insertPatternIntoTray(tray, level.blocks[firstBlockIndex].patternType);
  if (tray.length >= 7 && remainingMask !== 0n) {
    return false;
  }

  const higherBlockCounts = [...graph.higherBlockCounts];
  higherBlockCounts[firstBlockIndex] = 0;
  for (const lowerIndex of graph.lowerBlockIndicesByHigher[firstBlockIndex]) {
    higherBlockCounts[lowerIndex] -= 1;
  }

  const preferredRank = new Map<number, number>();
  solutionPath.forEach((blockId, rank) => {
    const blockIndex = graph.indexById.get(blockId);
    if (blockIndex !== undefined) {
      preferredRank.set(blockIndex, rank);
    }
  });

  return searchSolvableContinuation(
    level,
    graph,
    remainingMask,
    higherBlockCounts,
    tray,
    preferredRank,
    {
      failedStates: new Set<string>(),
      visitedStates: 0,
    },
  );
}

interface SolvabilitySearchContext {
  readonly failedStates: Set<string>;
  visitedStates: number;
}

function searchSolvableContinuation(
  level: LevelGeometry,
  graph: BlockGraph,
  remainingMask: bigint,
  higherBlockCounts: readonly number[],
  tray: readonly DogPatternType[],
  preferredRank: ReadonlyMap<number, number>,
  context: SolvabilitySearchContext,
): boolean {
  if (remainingMask === 0n) {
    return true;
  }

  const stateKey = `${remainingMask.toString(36)}:${tray.join(",")}`;
  if (context.failedStates.has(stateKey)) {
    return false;
  }
  context.visitedStates += 1;
  if (context.visitedStates > MAX_SOLVABILITY_SEARCH_STATES) {
    return false;
  }

  const selectable: number[] = [];
  for (let index = 0; index < level.blocks.length; index += 1) {
    if (
      (remainingMask & blockMask(index)) !== 0n &&
      higherBlockCounts[index] === 0
    ) {
      selectable.push(index);
    }
  }

  selectable.sort((firstIndex, secondIndex) => {
    const firstRank = preferredRank.get(firstIndex) ?? Number.MAX_SAFE_INTEGER;
    const secondRank = preferredRank.get(secondIndex) ?? Number.MAX_SAFE_INTEGER;
    if (firstRank !== secondRank) {
      return firstRank - secondRank;
    }

    const firstMatches = tray.filter(
      (patternType) => patternType === level.blocks[firstIndex].patternType,
    ).length;
    const secondMatches = tray.filter(
      (patternType) => patternType === level.blocks[secondIndex].patternType,
    ).length;
    return secondMatches - firstMatches || level.blocks[secondIndex].z - level.blocks[firstIndex].z;
  });

  for (const selectedIndex of selectable) {
    const nextRemainingMask = remainingMask & ~blockMask(selectedIndex);
    const nextTray = [...tray];
    insertPatternIntoTray(nextTray, level.blocks[selectedIndex].patternType);
    if (nextTray.length >= 7 && nextRemainingMask !== 0n) {
      continue;
    }

    const nextHigherBlockCounts = [...higherBlockCounts];
    for (const lowerIndex of graph.lowerBlockIndicesByHigher[selectedIndex]) {
      nextHigherBlockCounts[lowerIndex] -= 1;
    }
    if (
      searchSolvableContinuation(
        level,
        graph,
        nextRemainingMask,
        nextHigherBlockCounts,
        nextTray,
        preferredRank,
        context,
      )
    ) {
      return true;
    }
  }

  context.failedStates.add(stateKey);
  return false;
}

function createFullBlockMask(blockCount: number): bigint {
  return (1n << BigInt(blockCount)) - 1n;
}

function blockMask(blockIndex: number): bigint {
  return 1n << BigInt(blockIndex);
}

function findGreedySolvablePath(
  level: LevelGeometry & { readonly solutionPath?: readonly string[] },
): readonly string[] | null {
  const graph = createBlockGraph(level.blocks);
  const remaining = new Set(level.blocks.map((_, index) => index));
  const higherBlockCounts = [...graph.higherBlockCounts];
  const tray: DogPatternType[] = [];
  const path: string[] = [];

  while (remaining.size > 0) {
    const selectable = [...remaining].filter((index) => higherBlockCounts[index] === 0);
    if (selectable.length === 0) {
      return null;
    }

    selectable.sort((firstIndex, secondIndex) => {
      const firstMatches = tray.filter(
        (patternType) => patternType === level.blocks[firstIndex].patternType,
      ).length;
      const secondMatches = tray.filter(
        (patternType) => patternType === level.blocks[secondIndex].patternType,
      ).length;
      return secondMatches - firstMatches || level.blocks[firstIndex].z - level.blocks[secondIndex].z;
    });

    const selectedIndex = selectable[0];
    remaining.delete(selectedIndex);
    for (const lowerIndex of graph.lowerBlockIndicesByHigher[selectedIndex]) {
      higherBlockCounts[lowerIndex] -= 1;
    }
    insertPatternIntoTray(tray, level.blocks[selectedIndex].patternType);
    if (tray.length >= 7 && remaining.size > 0) {
      return null;
    }
    path.push(level.blocks[selectedIndex].id);
  }

  return path;
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

  if (request.testSeed !== undefined && request.testSeed.length === 0) {
    throw new Error("LevelGenerator test seed must be a non-empty string");
  }

  if (!Number.isSafeInteger(request.generatorVersion) || request.generatorVersion < 1) {
    throw new Error("LevelGenerator version must be a positive integer");
  }
}

function validateReplay(replay: DogLevelReplay): void {
  if (!Number.isSafeInteger(replay.attempt) || replay.attempt < 1) {
    throw new Error("LevelGenerator replay attempt must be a positive integer");
  }

  validateRequest({
    levelNumber: replay.levelNumber,
    seed: replay.seed,
    testSeed: replay.testSeed,
    generatorVersion: replay.generatorVersion,
  });
  if (
    replay.mode !== "fixed" &&
    replay.mode !== "generated" &&
    replay.mode !== "guaranteed"
  ) {
    throw new Error("LevelGenerator replay mode is invalid");
  }
  if (replay.randomSeed.length === 0) {
    throw new Error("LevelGenerator replay random seed must be non-empty");
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

function createSolvableBlockPlacements(
  template: DogShapeTemplate,
  blockCount: number,
  maxLayers: number,
  random: SeededRandom,
  removalPlan: RemovalPathPlan,
): readonly BlockPlacement[] {
  const structuralPlacements = createStructuralBlockPlacements(
    template,
    blockCount,
    maxLayers,
    random,
  );
  return assignPlacementsToRemovalPlan(structuralPlacements, blockCount, maxLayers, removalPlan);
}

function createGuaranteedBlockPlacements(
  template: DogShapeTemplate,
  blockCount: number,
  maxLayers: number,
  _random: SeededRandom,
  removalPlan: RemovalPathPlan,
): readonly BlockPlacement[] {
  const layerCounts = distributeBlocks(blockCount, maxLayers);
  const anchors = getCandidateAnchors(template, 0, 0);
  const structuralPlacements: BlockPlacement[] = [];

  for (let z = 0; z < maxLayers; z += 1) {
    const desiredCount = layerCounts[z];
    const start = z % 2 === 0 ? 0 : desiredCount;
    const layerAnchors = anchors.slice(start, start + desiredCount);
    if (layerAnchors.length !== desiredCount) {
      throw new Error("LevelGenerator emergency template has too few safe anchors");
    }

    structuralPlacements.push(
      ...layerAnchors.map((anchor) => ({ ...anchor, z })),
    );
  }

  return assignPlacementsToRemovalPlan(
    structuralPlacements,
    blockCount,
    maxLayers,
    removalPlan,
  );
}

function assignPlacementsToRemovalPlan(
  structuralPlacements: readonly BlockPlacement[],
  blockCount: number,
  maxLayers: number,
  removalPlan: RemovalPathPlan,
): readonly BlockPlacement[] {
  const blockIndicesByLayer = Array.from(
    { length: maxLayers },
    () => [] as number[],
  );

  for (const blockIndex of removalPlan.order) {
    blockIndicesByLayer[removalPlan.layerByBlock[blockIndex]].push(blockIndex);
  }

  const placementsByBlock: BlockPlacement[] = Array.from(
    { length: blockCount },
    () => ({ x: 0, y: 0, z: 0 }),
  );
  const placementCursorByLayer = Array.from({ length: maxLayers }, () => 0);

  // Path exists before geometry. Structural layers are built bottom-up, then
  // assigned to path blocks in reverse stack order so path order removes top first.
  for (const placement of structuralPlacements) {
    const layerIndices = blockIndicesByLayer[placement.z];
    const cursor = placementCursorByLayer[placement.z];
    const blockIndex = layerIndices[cursor];
    if (blockIndex === undefined) {
      throw new Error(`LevelGenerator path plan has no block for layer ${placement.z}`);
    }

    placementsByBlock[blockIndex] = placement;
    placementCursorByLayer[placement.z] += 1;
  }

  return placementsByBlock;
}

function createRemovalPathPlan(
  blockCount: number,
  maxLayers: number,
  random: SeededRandom,
): RemovalPathPlan {
  const order = random.shuffle(
    Array.from({ length: blockCount }, (_, index) => index),
  );
  const layerCounts = distributeBlocks(blockCount, maxLayers);
  const layerByBlock = Array.from({ length: blockCount }, () => 0);
  let pathCursor = 0;

  // Assign path prefix to upper layers. Reversing this assignment creates stack
  // geometry where every earlier path block can be removed before lower blocks.
  for (let z = maxLayers - 1; z >= 0; z -= 1) {
    for (let count = 0; count < layerCounts[z]; count += 1) {
      const blockIndex = order[pathCursor];
      if (blockIndex === undefined) {
        throw new Error("LevelGenerator path plan has incomplete block order");
      }

      layerByBlock[blockIndex] = z;
      pathCursor += 1;
    }
  }

  return {
    order: Object.freeze([...order]),
    layerByBlock: Object.freeze([...layerByBlock]),
  };
}

function resolveRemovalPathPlan(
  placements: readonly BlockPlacement[],
  random: SeededRandom,
  preferredOrder: readonly number[],
): RemovalPathPlan {
  // Resolve reveal dependencies once after raw stack geometry exists. Pattern
  // assignment consumes this plan directly; it never regenerates the path.
  const order = createRemovalOrder(placements, random, preferredOrder);
  return {
    order: Object.freeze([...order]),
    layerByBlock: Object.freeze(placements.map((placement) => placement.z)),
  };
}

function createStructuralBlockPlacements(
  template: DogShapeTemplate,
  blockCount: number,
  maxLayers: number,
  random: SeededRandom,
): readonly BlockPlacement[] {
  const layerCounts = distributeBlocks(blockCount, maxLayers);
  const placements: BlockPlacement[] = [];

  for (let z = 0; z < maxLayers; z += 1) {
    const desiredCount = layerCounts[z];
    let selected: BlockPlacement[] = [];

    for (const offset of LAYER_OFFSETS) {
      selected = selectStructuralLayerPlacements(
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

function selectStructuralLayerPlacements(
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
        countHigherOverlaps(lowerBlock, [...previousPlacements, ...selected, placement]) >=
          MAX_BLOCKS_PER_LOWER_BLOCK,
    );
    if (wouldExceedCoverLimit) {
      continue;
    }

    selected.push(placement);
  }

  return selected;
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
  return hasPositiveAreaOverlap(
    {
      x: first.x,
      y: first.y,
      width: BLOCK_WIDTH,
      height: BLOCK_HEIGHT,
    },
    {
      x: second.x,
      y: second.y,
      width: BLOCK_WIDTH,
      height: BLOCK_HEIGHT,
    },
  );
}

function createSolvableBlocks(
  placements: readonly BlockPlacement[],
  patternTypes: readonly DogPatternType[],
  levelNumber: number,
  random: SeededRandom,
  removalPlan: RemovalPathPlan,
): { readonly blocks: readonly DogBlock[]; readonly solutionPath: readonly string[] } {
  const patternByBlock = new Array<DogPatternType>(placements.length);
  const blockOrder = removalPlan.order;
  const groupCount = placements.length / 3;
  const patternSequence = createSolvablePatternSequence(patternTypes, groupCount, random);

  for (let pathIndex = 0; pathIndex < blockOrder.length; pathIndex += 1) {
    patternByBlock[blockOrder[pathIndex]] = patternSequence[pathIndex];
  }

  const blocks: DogBlock[] = placements.map((placement, index) => ({
      id: `level-${levelNumber}-block-${index + 1}`,
      x: placement.x,
      y: placement.y,
      z: placement.z,
      width: BLOCK_WIDTH,
      height: BLOCK_HEIGHT,
      rotation: 0 as const,
      patternType: patternByBlock[index],
    }));

  return {
    blocks,
    solutionPath: blockOrder.map((index) => blocks[index].id),
  };
}

function createRemovalOrder(
  placements: readonly BlockPlacement[],
  random: SeededRandom,
  preferredOrder?: readonly number[],
): readonly number[] {
  const graph = createPlacementGraph(placements);
  const remaining = new Set(placements.map((_, index) => index));
  const ready = graph.higherBlockCounts
    .map((count, index) => (count === 0 ? index : -1))
    .filter((index) => index >= 0);
  const newlyRevealed: number[] = [];
  const order: number[] = [];
  const preferredRank = preferredOrder === undefined
    ? undefined
    : new Map(preferredOrder.map((blockIndex, rank) => [blockIndex, rank]));

  while (remaining.size > 0) {
    let selectedIndex = takeNextRemovalCandidate(newlyRevealed, random, preferredRank);
    if (selectedIndex === undefined) {
      selectedIndex = takeNextRemovalCandidate(ready, random, preferredRank);
    }
    if (selectedIndex === undefined || !remaining.has(selectedIndex)) {
      throw new Error("LevelGenerator could not construct a legal removal path");
    }

    remaining.delete(selectedIndex);
    const readyIndex = ready.indexOf(selectedIndex);
    if (readyIndex >= 0) {
      ready.splice(readyIndex, 1);
    }
    order.push(selectedIndex);

    for (const lowerIndex of graph.lowerBlockIndicesByHigher[selectedIndex]) {
      graph.higherBlockCounts[lowerIndex] -= 1;
      if (graph.higherBlockCounts[lowerIndex] === 0) {
        ready.push(lowerIndex);
        newlyRevealed.push(lowerIndex);
      }
    }
  }

  return order;
}

function takeNextRemovalCandidate(
  candidates: number[],
  random: SeededRandom,
  preferredRank?: ReadonlyMap<number, number>,
): number | undefined {
  if (candidates.length === 0) {
    return undefined;
  }

  let eligible = candidates;
  if (preferredRank !== undefined) {
    const minimumRank = Math.min(
      ...candidates.map((candidate) => preferredRank.get(candidate) ?? Number.MAX_SAFE_INTEGER),
    );
    eligible = candidates.filter(
      (candidate) => (preferredRank.get(candidate) ?? Number.MAX_SAFE_INTEGER) === minimumRank,
    );
  }
  const selectedPosition = random.nextInt(eligible.length);
  const selectedIndex = eligible[selectedPosition];
  if (selectedIndex === undefined) {
    return undefined;
  }

  const candidatePosition = candidates.indexOf(selectedIndex);
  candidates.splice(candidatePosition, 1);
  return selectedIndex;
}

type PlacementGraph = OverlapGraph;

function createPlacementGraph(placements: readonly BlockPlacement[]): PlacementGraph {
  return createOverlapGraph(
    placements.map((placement) => ({
      ...placement,
      width: BLOCK_WIDTH,
      height: BLOCK_HEIGHT,
    })),
  );
}

function createSolvablePatternSequence(
  patternTypes: readonly DogPatternType[],
  groupCount: number,
  random: SeededRandom,
): readonly DogPatternType[] {
  const groupPatterns = Array.from(
    { length: groupCount },
    (_, index) => patternTypes[index % patternTypes.length],
  );
  const remainingGroups = new Map<DogPatternType, number>();
  for (const patternType of groupPatterns) {
    remainingGroups.set(patternType, (remainingGroups.get(patternType) ?? 0) + 3);
  }

  const remaining = new Map(remainingGroups);
  const sequence: DogPatternType[] = [];
  while (sequence.length < groupCount * 3) {
    const activePatterns = random.shuffle(
      patternTypes.filter((patternType) => (remaining.get(patternType) ?? 0) > 0),
    );
    if (activePatterns.length >= 5) {
      const pressurePatterns = activePatterns.slice(0, 5);
      const [first, second, third, fourth, fifth] = pressurePatterns;
      sequence.push(
        first,
        second,
        third,
        fourth,
        fifth,
        first,
        first,
        second,
        second,
        third,
        third,
        fourth,
        fourth,
        fifth,
        fifth,
      );
      for (const patternType of pressurePatterns) {
        remaining.set(patternType, (remaining.get(patternType) ?? 0) - 3);
      }
      continue;
    }

    const patternType = activePatterns[0];
    if (patternType === undefined) {
      break;
    }
    sequence.push(patternType, patternType, patternType);
    remaining.set(patternType, (remaining.get(patternType) ?? 0) - 3);
  }

  return sequence.slice(0, groupCount * 3);
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
