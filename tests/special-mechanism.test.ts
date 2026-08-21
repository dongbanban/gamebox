// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import {
  BLOCK_HEIGHT,
  BLOCK_WIDTH,
  DOG_FREEZE_MECHANISM_TYPE,
  FIRST_LEVEL,
  GameSession,
  LEVEL_GENERATOR_VERSION,
  LevelGenerator,
  type DogBlock,
  type DogLegeDogLevel,
  type DogPatternType,
  startDogLegeDogGame,
} from "@/games/dog-lege-dog";

const WORKING_DOG: DogPatternType = "打工狗";
const SINGLE_DOG: DogPatternType = "单身狗";
const LICKING_DOG: DogPatternType = "舔狗";

describe("狗了个狗特殊机制", () => {
  it("冻结方块进入暂存槽后不参与三消，并记录后续三消进度", () => {
    const freezeBlock = createBlock("freeze", 0, 0, WORKING_DOG, {
      type: DOG_FREEZE_MECHANISM_TYPE,
      state: { status: "frozen", completedTriples: 0 },
    });
    const session = new GameSession(
      createLevel([
        freezeBlock,
        createBlock("working-1", 4, 0, WORKING_DOG),
        createBlock("working-2", 8, 0, WORKING_DOG),
        createBlock("working-3", 12, 0, WORKING_DOG),
        createBlock("single-1", 16, 0, SINGLE_DOG),
        createBlock("single-2", 20, 0, SINGLE_DOG),
        createBlock("single-3", 24, 0, SINGLE_DOG),
        createBlock("licking-1", 28, 0, LICKING_DOG),
        createBlock("licking-2", 32, 0, LICKING_DOG),
        createBlock("licking-3", 36, 0, LICKING_DOG),
        createBlock("working-4", 40, 0, WORKING_DOG),
        createBlock("working-5", 44, 0, WORKING_DOG),
      ]),
    );

    session.selectBlock("freeze");
    session.selectBlock("working-1");
    const beforeMatch = session.selectBlock("working-2");

    expect(beforeMatch.removedCount).toBe(0);
    expect(beforeMatch.snapshot.tray).toEqual([WORKING_DOG, WORKING_DOG, WORKING_DOG]);
    expect(beforeMatch.snapshot.trayBlocks[0]?.specialMechanism?.type).toBe(
      DOG_FREEZE_MECHANISM_TYPE,
    );

    const samePatternTriple = session.selectBlock("working-3");
    expect(samePatternTriple.removedCount).toBe(3);
    expect(samePatternTriple.snapshot.trayBlocks[0]?.specialMechanism?.state.completedTriples).toBe(0);

    const firstTriple = selectAll(session, ["single-1", "single-2", "single-3"]);
    expect(firstTriple.snapshot.trayBlocks[0]?.specialMechanism?.state.completedTriples).toBe(1);

    const secondTriple = selectAll(session, ["licking-1", "licking-2", "licking-3"]);
    expect(secondTriple.removedCount).toBe(3);
    expect(secondTriple.meltedBlockIds).toEqual(["freeze"]);
    expect(secondTriple.snapshot.tray).toEqual([WORKING_DOG]);

    const finalTriple = selectAll(session, ["working-4", "working-5"]);
    expect(finalTriple.removedCount).toBe(3);
    expect(finalTriple.snapshot.tray).toEqual([]);
    expect(finalTriple.snapshot.status).toBe("won");
  });

  it("生成器按关卡配置生成冻结机制，固定 runSeed 可完整复现", () => {
    const generator = new LevelGenerator();
    const request = {
      levelNumber: 1,
      runSeed: "freeze-replay-seed",
      generatorVersion: LEVEL_GENERATOR_VERSION,
    } as const;

    const first = generator.generate(request);
    const repeated = generator.generate(request);
    const different = generator.generate({
      ...request,
      runSeed: "freeze-replay-seed-other",
    });
    const frozen = first.blocks.filter(
      (block) => block.specialMechanism?.type === DOG_FREEZE_MECHANISM_TYPE,
    );
    const configured = first.specialMechanisms.find(
      (mechanism) => mechanism.type === DOG_FREEZE_MECHANISM_TYPE,
    );

    expect(configured).toEqual(
      expect.objectContaining({
        min: expect.any(Number),
        max: expect.any(Number),
      }),
    );
    expect(frozen.length).toBeGreaterThanOrEqual(configured?.min ?? 1);
    expect(frozen.length).toBeLessThanOrEqual(configured?.max ?? 0);
    expect(frozen.every((block) => block.specialMechanism?.state.status === "frozen")).toBe(true);
    expect(repeated).toEqual(first);
    expect(different).not.toEqual(first);
    expect(generator.findSolvability(first).status).toBe("solvable");
  });

  it("冻结方块棋盘与暂存槽状态带有特殊视觉协议", () => {
    const root = document.createElement("div");
    const game = startDogLegeDogGame(root, {
      runSeed: "freeze-visual-seed",
      loadout: ["triple-removal", "tray-capacity", "wildcard"],
    });

    const frozenBlock = root.querySelector<HTMLElement>(
      '[data-testid="dog-block"][data-special-mechanism="freeze"]',
    );
    expect(frozenBlock).not.toBeNull();
    expect(frozenBlock?.classList.contains("dog-block--special")).toBe(true);
    expect(frozenBlock?.classList.contains("dog-block--special-freeze")).toBe(true);
    expect(frozenBlock?.dataset.specialMechanismState).toBe("frozen");
    expect(frozenBlock?.dataset.specialMechanismProgress).toBe("0");

    game.destroy();
  });
});

function selectAll(session: GameSession, blockIds: readonly string[]) {
  let result;
  for (const blockId of blockIds) {
    result = session.selectBlock(blockId);
  }
  if (result === undefined) {
    throw new Error("Expected at least one block to select");
  }
  return result;
}

function createLevel(blocks: readonly DogBlock[]): DogLegeDogLevel {
  return {
    ...FIRST_LEVEL,
    blocks,
  };
}

function createBlock(
  id: string,
  x: number,
  y: number,
  patternType: DogPatternType,
  specialMechanism?: DogBlock["specialMechanism"],
): DogBlock {
  return {
    id,
    x,
    y,
    z: 0,
    width: BLOCK_WIDTH,
    height: BLOCK_HEIGHT,
    rotation: 0,
    patternType,
    ...(specialMechanism === undefined ? {} : { specialMechanism }),
  };
}
