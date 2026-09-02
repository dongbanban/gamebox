import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  GameDefinition,
  GameLaunchHandle,
  GameLaunchContext,
  GameLaunchPreparation,
} from "@/catalog";
import {
  BLOCK_HEIGHT,
  BLOCK_WIDTH,
  DOG_V13_CONFIG,
  createDogShuffleMechanism,
  startDogLegeDogGame,
  type DogBlock,
  type DogLegeDogLevel,
  type DogPatternType,
} from "@/games/dog-lege-dog";
import { BLOCK_FLIGHT_DURATION_MS } from "@/games/dog-lege-dog/assets/animation-effects";
import { GAME_ID, ProgressStore } from "@/progress-store";
import { MemoryStorage, mountApp } from "../support/app-fixtures";
import { TEST_LEVEL, TEST_PATTERN_TYPES } from "../support/dog-level-fixture";

afterEach(() => {
  vi.useRealTimers();
});

describe("乱序与重玩综合生命周期", () => {
  it("乱序和复原动画期间拒绝重玩，复原完成后创建新关卡尝试", async () => {
    vi.useFakeTimers();
    const level = createRestoreLevel();
    const triggerPath = ["shuffle", "single-1", "licking-1", "guard-1", "mad-1"];

    const launches: GameLaunchContext[] = [];
    const handles: GameLaunchHandle[] = [];
    const game = createAnimatedDogGame(level, launches, handles);
    const store = new ProgressStore({
      storage: new MemoryStorage(),
      userIdFactory: () => "123e4567-e89b-12d3-a456-426614174000",
    });
    store.register();
    store.setGameLoadout(GAME_ID, ["restore-whistle", "tray-capacity", "torch"]);
    const root = document.createElement("div");
    const app = mountApp(root, {
      store,
      catalog: [game],
      runSeedFactory: (() => {
        const seeds = [level.runSeed, "integrated-replay-after-restore"];
        let index = 0;
        return () => seeds[index++] ?? `integrated-replay-extra-${index}`;
      })(),
    });

    root.querySelector<HTMLButtonElement>('[data-action="enter-game"]')?.click();
    for (const blockId of triggerPath.slice(0, -1)) {
      dispatchPointerUp(root, blockId);
      await vi.runAllTimersAsync();
    }
    dispatchPointerUp(root, triggerPath.at(-1)!);
    await vi.advanceTimersByTimeAsync(BLOCK_FLIGHT_DURATION_MS);

    const replayDuringShuffle = root.querySelector<HTMLButtonElement>(
      '[data-testid="dog-replay-current-level"]',
    );
    expect(root.querySelector('[data-testid="dog-shuffle-effect"]')).not.toBeNull();
    expect(replayDuringShuffle?.disabled ?? true).toBe(true);
    replayDuringShuffle?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(launches).toHaveLength(1);

    await vi.runAllTimersAsync();
    const restoreWhistle = root.querySelector<HTMLButtonElement>(
      '[data-item-id="restore-whistle"]',
    );
    expect(restoreWhistle?.disabled).toBe(false);
    restoreWhistle?.click();

    const replayDuringRestore = root.querySelector<HTMLButtonElement>(
      '[data-testid="dog-replay-current-level"]',
    );
    expect(replayDuringRestore?.disabled ?? true).toBe(true);
    replayDuringRestore?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(launches).toHaveLength(1);

    await vi.runAllTimersAsync();
    const destroy = vi.spyOn(handles[0]!, "destroy");
    root.querySelector<HTMLButtonElement>('[data-testid="dog-replay-current-level"]')?.click();

    expect(launches).toHaveLength(2);
    expect(destroy).toHaveBeenCalledOnce();
    expect(launches[1]?.runSeed).toBe("integrated-replay-after-restore");
    expect(root.querySelector<HTMLElement>('[data-testid="dog-game"]')?.dataset.runSeed)
      .toBe("integrated-replay-after-restore");
    expect(root.querySelectorAll('[data-testid="dog-tray-slot"][data-pattern-type]'))
      .toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
    app.destroy();
  });
});

function createAnimatedDogGame(
  level: DogLegeDogLevel,
  launches: GameLaunchContext[],
  handles: GameLaunchHandle[],
): GameDefinition {
  return {
    id: GAME_ID,
    name: "狗了个狗",
    category: "测试",
    description: "验证乱序与重玩生命周期。",
    cover: "test-cover.svg",
    playable: true,
    resultDisplay: DOG_V13_CONFIG.ui.copy.result,
    prepareLaunch: (context): GameLaunchPreparation => ({
      gameId: context.gameId,
      levelNumber: context.levelNumber,
      runSeed: context.runSeed,
      generatorVersion: DOG_V13_CONFIG.game.generatorVersion,
      payload: Object.freeze({ verified: true }),
    }),
    launch: (mount, context = {}) => {
      launches.push(context);
      const game = startDogLegeDogGame(mount, {
        ...context,
        level: {
          ...level,
          number: context.levelNumber ?? level.number,
          runSeed: context.runSeed ?? level.runSeed,
        },
      });
      handles.push(game);
      return game;
    },
  };
}

function dispatchPointerUp(root: HTMLElement, blockId: string): void {
  root
    .querySelector<HTMLElement>(`[data-testid="dog-block"][data-block-id="${blockId}"]`)
    ?.dispatchEvent(new Event("pointerup", { bubbles: true, cancelable: true }));
}

function createRestoreLevel(): DogLegeDogLevel {
  return {
    ...TEST_LEVEL,
    patternTypes: TEST_PATTERN_TYPES,
    runSeed: "restore-whistle-ui",
    blocks: [
      createBlock("shuffle", 0, "打工狗", createDogShuffleMechanism()),
      createBlock("single-1", 4, "单身狗"),
      createBlock("licking-1", 8, "舔狗"),
      createBlock("guard-1", 12, "看门狗"),
      createBlock("mad-1", 16, "疯狗"),
      createBlock("working-2", 20, "打工狗"),
      createBlock("working-3", 24, "打工狗"),
      createBlock("single-2", 28, "单身狗"),
      createBlock("single-3", 32, "单身狗"),
      createBlock("licking-2", 36, "舔狗"),
      createBlock("licking-3", 40, "舔狗"),
      createBlock("guard-2", 44, "看门狗"),
      createBlock("guard-3", 48, "看门狗"),
      createBlock("mad-2", 52, "疯狗"),
      createBlock("mad-3", 56, "疯狗"),
    ],
  };
}

function createBlock(
  id: string,
  x: number,
  patternType: DogPatternType,
  specialMechanism?: DogBlock["specialMechanism"],
): DogBlock {
  return {
    id,
    x,
    y: 0,
    z: 0,
    width: BLOCK_WIDTH,
    height: BLOCK_HEIGHT,
    rotation: 0,
    patternType,
    ...(specialMechanism === undefined ? {} : { specialMechanism }),
  };
}
