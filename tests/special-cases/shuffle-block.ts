import { describe, expect, it } from "vitest";
import {
  BLOCK_HEIGHT,
  BLOCK_WIDTH,
  DOG_V13_CONFIG,
  DOG_SHUFFLE_MECHANISM_TYPE,
  GameSession,
  createDogShuffleMechanism,
  getDogShuffleThreshold,
  getDogV13MechanismPlan,
} from "@/games/dog-lege-dog";
import type {
  DogBlock,
  DogLegeDogLevel,
  DogPatternType,
  DogTrayBlock,
} from "@/games/dog-lege-dog";
import { TEST_LEVEL, TEST_PATTERN_TYPES } from "../support/dog-level-fixture";

const WORKING_DOG: DogPatternType = "打工狗";
const SINGLE_DOG: DogPatternType = "单身狗";
const LICKING_DOG: DogPatternType = "舔狗";

describe("特殊机制测试 · shuffle-block", () => {
  it("新增乱序机制公共契约，正式 v13 配置默认关闭", () => {
    expect(DOG_V13_CONFIG.specialMechanisms.shuffle).toMatchObject({
      enabled: false,
      firstLevelNumber: 3,
      maxPerLevel: 1,
      candidateCount: 8,
      threshold: { maxLogicalUnitCount: 5, capacityBuffer: 2 },
    });
    expect(DOG_V13_CONFIG.specialMechanisms.mechanisms.map(({ type }) => type))
      .not.toContain(DOG_SHUFFLE_MECHANISM_TYPE);
    expect(DOG_V13_CONFIG.ui.copy.specialMechanisms.presentations.shuffle).toMatchObject({
      name: "乱序方块",
    });
    expect(createDogShuffleMechanism()).toEqual({
      type: DOG_SHUFFLE_MECHANISM_TYPE,
      state: { status: "dormant" },
    });
    expect([5, 6, 7, 8].map((capacity) => getDogShuffleThreshold(capacity)))
      .toEqual([3, 4, 5, 5]);
    expect(getDogV13MechanismPlan(90).counts.shuffle).toBe(0);
  });

  it("乱序方块首次入槽先按普通三消结算，被移除时不进入待乱序", () => {
    const session = new GameSession({
      level: createLevel([
        createBlock("shuffle", 0, 0, WORKING_DOG, createDogShuffleMechanism()),
        createBlock("remaining", 8, 0, LICKING_DOG),
      ]),
      initialTrayBlocks: [
        createTrayBlock("working-1", WORKING_DOG),
        createTrayBlock("working-2", WORKING_DOG),
      ],
    });

    const result = session.selectBlock("shuffle");

    expect(result.removedCount).toBe(3);
    expect(result.snapshot.trayBlocks).toEqual([]);
    expect(result.snapshot.shuffle).toBeNull();
    expect(result.snapshot.status).toBe("playing");
  });

  it("乱序方块首次结算存活后进入待乱序，槽序保持点击顺序", () => {
    const session = new GameSession(
      createLevel([
        createBlock("shuffle", 0, 0, WORKING_DOG, createDogShuffleMechanism()),
        createBlock("single", 4, 0, SINGLE_DOG),
      ]),
    );

    const first = session.selectBlock("shuffle");
    expect(first.snapshot.shuffle).toMatchObject({
      blockId: "shuffle",
      status: "armed",
      threshold: 5,
    });
    expect(first.snapshot.trayBlocks.map((block) => block.id)).toEqual(["shuffle"]);

    const second = session.selectBlock("single");
    expect(second.snapshot.shuffle).toMatchObject({ status: "armed", threshold: 5 });
    expect(second.snapshot.trayBlocks.map((block) => block.id)).toEqual([
      "shuffle",
      "single",
    ]);
  });

  it("首次入槽结算后立即按有效容量阈值完成乱序事务", () => {
    const session = new GameSession({
      level: {
        ...createLevel([
          createBlock("shuffle", 0, 0, WORKING_DOG, createDogShuffleMechanism()),
          createBlock("remaining", 4, 0, "看门狗"),
        ]),
        lockedTraySlotCount: 2,
      },
      initialTrayBlocks: [
        createTrayBlock("single", SINGLE_DOG),
        createTrayBlock("licking", LICKING_DOG),
      ],
    });

    const result = session.selectBlock("shuffle");

    expect(result.removedCount).toBe(0);
    expect(result.snapshot.trayLogicalUnitCount).toBe(3);
    expect(result.snapshot.shuffle).toMatchObject({
      status: "consumed",
      threshold: 3,
    });
  });

  it("按有效容量使用 3、4、5、5 个逻辑方块完成乱序触发", () => {
    const cases = [
      { effectiveCapacity: 5, trayCapacity: 7, lockedTraySlotCount: 2, threshold: 3 },
      { effectiveCapacity: 6, trayCapacity: 7, lockedTraySlotCount: 1, threshold: 4 },
      { effectiveCapacity: 7, trayCapacity: 7, lockedTraySlotCount: 0, threshold: 5 },
      { effectiveCapacity: 8, trayCapacity: 8, lockedTraySlotCount: 0, threshold: 5 },
    ] as const;
    const patterns: readonly DogPatternType[] = [
      WORKING_DOG,
      SINGLE_DOG,
      LICKING_DOG,
      "看门狗",
      "疯狗",
    ];

    for (const testCase of cases) {
      const blocks = patterns.map((patternType, index) =>
        createBlock(
          index === 0 ? "shuffle" : `ordinary-${index}`,
          index * 4,
          0,
          patternType,
          index === 0 ? createDogShuffleMechanism() : undefined,
        ),
      );
      const session = new GameSession({
        level: {
          ...createLevel(blocks),
          lockedTraySlotCount: testCase.lockedTraySlotCount,
        },
        initialTrayCapacity: testCase.trayCapacity,
      });

      let result = session.selectBlock("shuffle");
      for (let index = 1; index < testCase.threshold; index += 1) {
        result = session.selectBlock(`ordinary-${index}`);
      }

      expect(result.snapshot).toMatchObject({
        effectiveTrayCapacity: testCase.effectiveCapacity,
        trayLogicalUnitCount: testCase.threshold,
        shuffle: {
          blockId: "shuffle",
          status: "consumed",
          threshold: testCase.threshold,
        },
      });
    }
  });

  it("锁槽解锁与扩容后重算阈值，并在动作结算末尾完成乱序", () => {
    const unlockSession = new GameSession({
      level: {
        ...createLevel([
          createBlock("shuffle", 0, 0, WORKING_DOG, createDogShuffleMechanism()),
          createBlock("single-1", 4, 0, SINGLE_DOG),
          createBlock("licking-1", 8, 0, LICKING_DOG),
          createBlock("guard-1", 12, 0, "看门狗"),
        ]),
        lockedTraySlotCount: 2,
      },
    });
    unlockSession.selectBlock("shuffle");
    unlockSession.selectBlock("single-1");
    expect(unlockSession.getState().shuffle).toMatchObject({ status: "armed", threshold: 3 });
    expect(unlockSession.unlockTraySlot()).toMatchObject({
      effectiveTrayCapacity: 6,
      snapshot: { shuffle: { status: "armed", threshold: 4 } },
    });
    unlockSession.selectBlock("licking-1");
    const unlocked = unlockSession.selectBlock("guard-1");
    expect(unlocked.snapshot.shuffle).toMatchObject({ status: "consumed", threshold: 4 });

    const capacitySession = new GameSession({
      level: {
        ...createLevel([
          createBlock("shuffle", 0, 0, WORKING_DOG, createDogShuffleMechanism()),
          createBlock("single-1", 4, 0, SINGLE_DOG),
          createBlock("licking-1", 8, 0, LICKING_DOG),
          createBlock("guard-1", 12, 0, "看门狗"),
          createBlock("mad-1", 16, 0, "疯狗"),
        ]),
        lockedTraySlotCount: 1,
      },
    });
    capacitySession.selectBlock("shuffle");
    capacitySession.selectBlock("single-1");
    capacitySession.selectBlock("licking-1");
    expect(capacitySession.getState().shuffle).toMatchObject({ status: "armed", threshold: 4 });
    expect(capacitySession.increaseTrayCapacity()).toBe(true);
    expect(capacitySession.getState().shuffle).toMatchObject({ status: "armed", threshold: 5 });
    capacitySession.selectBlock("guard-1");
    const expanded = capacitySession.selectBlock("mad-1");
    expect(expanded.snapshot.shuffle).toMatchObject({ status: "consumed", threshold: 5 });
  });

  it("待乱序方块在阈值前被后续三消移除时失效", () => {
    const session = new GameSession(
      createLevel([
        createBlock("shuffle", 0, 0, WORKING_DOG, createDogShuffleMechanism()),
        createBlock("working-1", 4, 0, WORKING_DOG),
        createBlock("working-2", 8, 0, WORKING_DOG),
        createBlock("remaining", 12, 0, LICKING_DOG),
      ]),
    );

    session.selectBlock("shuffle");
    session.selectBlock("working-1");
    const result = session.selectBlock("working-2");

    expect(result.removedCount).toBe(3);
    expect(result.snapshot.trayBlocks).toEqual([]);
    expect(result.snapshot.shuffle).toBeNull();
  });

  it("同次结算其他三消降低槽内数量时不触发乱序", () => {
    const session = new GameSession({
      level: createLevel([
        createBlock("single-3", 0, 0, SINGLE_DOG),
        createBlock("remaining", 4, 0, LICKING_DOG),
      ]),
      initialTrayBlocks: [
        createTrayBlock("shuffle", WORKING_DOG, createDogShuffleMechanism()),
        createTrayBlock("single-1", SINGLE_DOG),
        createTrayBlock("single-2", SINGLE_DOG),
      ],
    });

    const result = session.selectBlock("single-3");

    expect(result.removedCount).toBe(3);
    expect(result.snapshot.trayLogicalUnitCount).toBe(1);
    expect(result.snapshot.shuffle).toMatchObject({
      status: "armed",
      threshold: 5,
    });
  });

  it("达到阈值后只提交安全候选，并记录可复现乱序事件", () => {
    const session = new GameSession({
      level: createLevel([
        createBlock("shuffle", 0, 0, WORKING_DOG, createDogShuffleMechanism()),
        createBlock("single-1", 4, 0, SINGLE_DOG),
        createBlock("licking-1", 8, 0, LICKING_DOG),
        createBlock("guard-1", 12, 0, "看门狗"),
        createBlock("mad-1", 16, 0, "疯狗"),
        createBlock("working-2", 20, 0, WORKING_DOG),
        createBlock("working-3", 24, 0, WORKING_DOG),
        createBlock("single-2", 28, 0, SINGLE_DOG),
        createBlock("single-3", 32, 0, SINGLE_DOG),
        createBlock("licking-2", 36, 0, LICKING_DOG),
        createBlock("licking-3", 40, 0, LICKING_DOG),
        createBlock("guard-2", 44, 0, "看门狗"),
        createBlock("guard-3", 48, 0, "看门狗"),
        createBlock("mad-2", 52, 0, "疯狗"),
        createBlock("mad-3", 56, 0, "疯狗"),
      ]),
    });

    for (const blockId of ["shuffle", "single-1", "licking-1", "guard-1"]) {
      session.selectBlock(blockId);
    }
    const result = session.selectBlock("mad-1");

    expect(result.shuffleResolution).toMatchObject({
      outcome: "reordered",
      candidateCount: 8,
      safeCandidateCount: expect.any(Number),
      selectedCandidateIndex: expect.any(Number),
    });
    expect(result.shuffleResolution?.safeCandidateCount).toBeGreaterThan(0);
    expect(result.snapshot.shuffle).toMatchObject({
      blockId: "shuffle",
      status: "consumed",
      threshold: 5,
    });
    expect(result.snapshot.trayBlocks.map((block) => block.id)).toEqual(
      result.shuffleResolution?.transaction?.after.trayBlocks.map((block) => block.id),
    );
    expect(session.getShuffleReplayEvents()).toEqual([
      result.shuffleResolution?.replayEvent,
    ]);
  });

  it("没有安全候选时保持触发前槽序，不创建复原事务", () => {
    const session = new GameSession({
      level: createLevel([
        createBlock("shuffle", 0, 0, WORKING_DOG, createDogShuffleMechanism()),
        createBlock("single", 4, 0, SINGLE_DOG),
        createBlock("licking", 8, 0, LICKING_DOG),
        createBlock("guard", 12, 0, "看门狗"),
        createBlock("mad", 16, 0, "疯狗"),
      ]),
    });

    for (const blockId of ["shuffle", "single", "licking", "guard"]) {
      session.selectBlock(blockId);
    }
    const result = session.selectBlock("mad");

    expect(result.shuffleResolution).toMatchObject({
      outcome: "stable",
      candidateCount: 8,
      safeCandidateCount: 0,
      selectedCandidateIndex: null,
      transaction: null,
    });
    expect(result.snapshot.trayBlocks.map((block) => block.id)).toEqual([
      "shuffle",
      "single",
      "licking",
      "guard",
      "mad",
    ]);
    expect(result.snapshot.trayBlocks.find((block) => block.id === "shuffle")?.specialMechanism)
      .toMatchObject({ type: DOG_SHUFFLE_MECHANISM_TYPE, state: { status: "consumed" } });
    expect(session.getLastShuffleTransaction()).toBeNull();
  });

  it("相同 runSeed 与操作路径复现候选选择、槽序、结算结果", () => {
    const level = createLevel([
      createBlock("shuffle", 0, 0, WORKING_DOG, createDogShuffleMechanism()),
      createBlock("single-1", 4, 0, SINGLE_DOG),
      createBlock("licking-1", 8, 0, LICKING_DOG),
      createBlock("guard-1", 12, 0, "看门狗"),
      createBlock("mad-1", 16, 0, "疯狗"),
      createBlock("working-2", 20, 0, WORKING_DOG),
      createBlock("working-3", 24, 0, WORKING_DOG),
      createBlock("single-2", 28, 0, SINGLE_DOG),
      createBlock("single-3", 32, 0, SINGLE_DOG),
      createBlock("licking-2", 36, 0, LICKING_DOG),
      createBlock("licking-3", 40, 0, LICKING_DOG),
      createBlock("guard-2", 44, 0, "看门狗"),
      createBlock("guard-3", 48, 0, "看门狗"),
      createBlock("mad-2", 52, 0, "疯狗"),
      createBlock("mad-3", 56, 0, "疯狗"),
    ]);
    const play = () => {
      const session = new GameSession({ level });
      for (const blockId of ["shuffle", "single-1", "licking-1", "guard-1", "mad-1"]) {
        session.selectBlock(blockId);
      }
      const result = session.getState();
      return {
        replayEvent: session.getShuffleReplayEvents()[0],
        trayBlocks: result.trayBlocks,
        status: result.status,
      };
    };

    expect(play()).toEqual(play());
  });

  it("安全候选按完整条目移动，并自动结算新形成的相邻三消", () => {
    const session = new GameSession({
      level: {
        ...createLevel([
          createBlock("working-1", 0, 0, WORKING_DOG),
          createBlock("single-1", 4, 0, SINGLE_DOG),
          createBlock("working-2", 8, 0, WORKING_DOG),
          createBlock("licking-1", 12, 0, LICKING_DOG),
          createBlock("shuffle", 16, 0, WORKING_DOG, createDogShuffleMechanism()),
          createBlock("single-2", 20, 0, SINGLE_DOG),
          createBlock("single-3", 24, 0, SINGLE_DOG),
          createBlock("licking-2", 28, 0, LICKING_DOG),
          createBlock("licking-3", 32, 0, LICKING_DOG),
          createBlock("guard-2", 36, 0, "看门狗"),
          createBlock("guard-3", 40, 0, "看门狗"),
        ]),
        runSeed: "secondary-0",
      },
      initialTrayBlocks: [
        createTrayBlock("frozen", "看门狗", {
          type: "freeze",
          state: { status: "frozen", completedTriples: 0 },
        }),
      ],
    });

    for (const blockId of ["working-1", "single-1", "working-2", "licking-1"]) {
      session.selectBlock(blockId);
    }
    const result = session.selectBlock("shuffle");
    expect(result.shuffleResolution?.outcome).toBe("reordered");
    expect(result.shuffleResolution?.tripleCount).toBeGreaterThan(0);
    expect(result.shuffleResolution?.secondaryTripleCount).toBe(1);
    expect(result.shuffleResolution?.secondaryRemovedBlockIds.length).toBeGreaterThan(0);
    expect(result.shuffleResolution?.transaction?.before.trayBlocks.find(
      (block) => block.id === "shuffle",
    )).toMatchObject({
      id: "shuffle",
      patternType: WORKING_DOG,
      specialMechanism: { type: DOG_SHUFFLE_MECHANISM_TYPE, state: { status: "armed" } },
    });
    expect(result.snapshot.trayBlocks.some((block) => block.id === "frozen")).toBe(true);
    expect(result.snapshot.trayBlocks.find((block) => block.id === "frozen")?.specialMechanism)
      .toMatchObject({ type: "freeze", state: { completedTriples: 1 } });
    for (const block of result.snapshot.trayBlocks) {
      if (block.id === "shuffle") {
        expect(block.patternType).toBe(WORKING_DOG);
        expect(block.specialMechanism?.state.status).toBe("consumed");
      }
    }
  });
});

function createLevel(blocks: readonly DogBlock[]): DogLegeDogLevel {
  return {
    ...TEST_LEVEL,
    patternTypes: TEST_PATTERN_TYPES,
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

function createTrayBlock(
  id: string,
  patternType: DogPatternType,
  specialMechanism?: DogTrayBlock["specialMechanism"],
): DogTrayBlock {
  return {
    id,
    patternType,
    ...(specialMechanism === undefined ? {} : { specialMechanism }),
  };
}
