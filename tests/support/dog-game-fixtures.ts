import type { GameLaunchContext } from "@/game-contracts";
import {
  startDogLegeDogGame,
  type DogBlock,
  type DogLegeDogLevel,
  type DogPatternType,
} from "@/games/dog-lege-dog";
import { TEST_LEVEL, TEST_PATTERN_TYPES, TEST_RUN_SEED } from "./dog-level-fixture";

export function startTestGame(root: HTMLElement, options: GameLaunchContext = {}) {
  return startDogLegeDogGame(root, {
    runSeed: TEST_RUN_SEED,
    ...options,
  });
}

export function createWildcardUiLevel(): DogLegeDogLevel {
  const patternTypes = ["打工狗", "单身狗"] as const satisfies readonly DogPatternType[];
  const blocks: readonly DogBlock[] = [
    createTestBlock("working-hidden", "打工狗", 0),
    createTestBlock("single-cover", "单身狗", 1),
    createTestBlock("working-target", "打工狗", 0, 8),
  ];
  return {
    ...TEST_LEVEL,
    patternTypes,
    blocks,
    solutionPath: ["working-target", "single-cover", "working-hidden"],
  };
}

export function createKeyUiLevel(): DogLegeDogLevel {
  const patternTypes = ["打工狗", "单身狗", "舔狗", "看门狗"] as const satisfies readonly DogPatternType[];
  const blocks: readonly DogBlock[] = [
    createTestBlock("working-1", "打工狗", 0, 0),
    createTestBlock("working-2", "打工狗", 0, 4),
    createTestBlock("working-3", "打工狗", 0, 8),
    createTestBlock("single-1", "单身狗", 0, 12),
    createTestBlock("single-2", "单身狗", 0, 16),
    createTestBlock("licking-1", "舔狗", 0, 20),
    createTestBlock("licking-2", "舔狗", 0, 24),
    createTestBlock("guard-1", "看门狗", 0, 28),
    createTestBlock("guard-2", "看门狗", 0, 32),
  ];
  return {
    ...TEST_LEVEL,
    runSeed: "key-drop-seed-0",
    patternTypes,
    blocks,
    lockedTraySlotCount: 2,
    solutionPath: blocks.map((block) => block.id),
  };
}

export function createWildcardMatchUiLevel(): DogLegeDogLevel {
  const patternTypes = ["打工狗", "单身狗"] as const satisfies readonly DogPatternType[];
  const frozenMechanism = {
    type: "freeze",
    state: { status: "frozen", completedTriples: 0 },
  } as const;
  const blocks: readonly DogBlock[] = [
    createTestBlock("working-hidden", "打工狗", 0),
    createTestBlock("single-cover", "单身狗", 1),
    createTestBlock("frozen-working-1", "打工狗", 0, 8, frozenMechanism),
    createTestBlock("frozen-working-2", "打工狗", 0, 16, frozenMechanism),
  ];
  return {
    ...TEST_LEVEL,
    patternTypes,
    blocks,
    solutionPath: blocks.map((block) => block.id),
  };
}

function createTestBlock(
  id: string,
  patternType: DogPatternType,
  z: number,
  x = 0,
  specialMechanism?: DogBlock["specialMechanism"],
): DogBlock {
  return {
    id,
    x,
    y: 0,
    z,
    width: 4,
    height: 4,
    rotation: 0,
    patternType,
    ...(specialMechanism === undefined ? {} : { specialMechanism }),
  };
}
