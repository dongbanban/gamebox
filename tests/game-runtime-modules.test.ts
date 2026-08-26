// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import {
  DOG_V13_CONFIG,
  FIRST_LEVEL,
  GameSession,
  loadDogV13Config,
  startDogLegeDogGame,
  type DogBlock,
} from "@/games/dog-lege-dog";
import {
  animateBlockFlight,
  renderDogMeltEffect,
} from "@/games/dog-lege-dog/assets/animation-effects";
import { createSoundEffects } from "@/games/dog-lege-dog/assets/sound-effects";

describe("狗了个狗 runtime config seam", () => {
  it("uses supplied v13 tray capacity and freeze state rules", () => {
    const config = loadDogV13Config({
      ...DOG_V13_CONFIG,
      tray: {
        ...DOG_V13_CONFIG.tray,
        maxCapacity: 9,
      },
      specialMechanisms: {
        ...DOG_V13_CONFIG.specialMechanisms,
        freezeMeltTripleCount: 1,
      },
    });
    const session = new GameSession({
      level: createLevel([
        createBlock("single-1", "单身狗"),
        createBlock("single-2", "单身狗", 4),
        createBlock("single-3", "单身狗", 8),
      ]),
      config,
      initialTrayBlocks: [
        {
          id: "frozen-working",
          patternType: "打工狗",
          specialMechanism: {
            type: "freeze",
            state: { status: "frozen", completedTriples: 0 },
          },
        },
      ],
    });

    expect(session.increaseTrayCapacity()).toBe(true);
    expect(session.increaseTrayCapacity()).toBe(true);
    expect(session.getState().trayCapacity).toBe(9);

    session.selectBlock("single-1");
    session.selectBlock("single-2");
    const result = session.selectBlock("single-3");

    expect(result.tripleCount).toBe(1);
    expect(result.meltedBlockIds).toContain("frozen-working");
    expect(result.snapshot.trayBlocks).toEqual([
      { id: "frozen-working", patternType: "打工狗" },
    ]);
  });

  it("uses supplied v13 animation timing at the animation seam", async () => {
    vi.useFakeTimers();
    try {
      const config = loadDogV13Config({
        ...DOG_V13_CONFIG,
        animation: {
          ...DOG_V13_CONFIG.animation,
          blockFlightMs: 1,
          freezeMeltMs: 2,
        },
      });
      const root = document.createElement("div");
      const layer = document.createElement("div");
      layer.dataset.testid = "dog-animation-layer";
      root.append(layer);
      let settled = false;
      const animation = animateBlockFlight({
        config,
        root,
        patternMarkup: "<span></span>",
        source: null,
        target: null,
      });
      void animation.promise.then(() => {
        settled = true;
      });
      const meltEffect = renderDogMeltEffect({
        config,
        root,
        blockId: "frozen-working",
        target: null,
      });

      expect(meltEffect?.style.getPropertyValue("--dog-animation-duration")).toBe("2ms");

      await vi.advanceTimersByTimeAsync(1);

      expect(settled).toBe(true);
      meltEffect?.remove();
    } finally {
      vi.useRealTimers();
    }
  });

  it("uses supplied v13 audio profile at the sound seam", () => {
    const previousAudioContext = (globalThis as typeof globalThis & {
      AudioContext?: unknown;
    }).AudioContext;
    const oscillator = {
      type: "sine" as OscillatorType,
      frequency: { setValueAtTime: vi.fn() },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };
    const gain = {
      gain: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
    };
    class FakeAudioContext {
      readonly state = "running" as const;
      readonly currentTime = 10;
      readonly destination = {} as AudioNode;

      createOscillator(): OscillatorNode {
        return oscillator as unknown as OscillatorNode;
      }

      createGain(): GainNode {
        return gain as unknown as GainNode;
      }

      close(): Promise<void> {
        return Promise.resolve();
      }
    }

    Object.defineProperty(globalThis, "AudioContext", {
      configurable: true,
      value: FakeAudioContext,
    });
    try {
      const config = loadDogV13Config({
        ...DOG_V13_CONFIG,
        audio: {
          ...DOG_V13_CONFIG.audio,
          effects: {
            ...DOG_V13_CONFIG.audio.effects,
            select: {
              ...DOG_V13_CONFIG.audio.effects.select,
              frequencies: [123],
              volume: 0.9,
            },
          },
        },
      });
      const sound = createSoundEffects(true, config);
      sound.initialize();
      sound.play("select");

      expect(oscillator.frequency.setValueAtTime).toHaveBeenCalledWith(123, 10);
      expect(gain.gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(0.9, 10.012);
      sound.destroy();
    } finally {
      if (previousAudioContext === undefined) {
        Reflect.deleteProperty(globalThis, "AudioContext");
      } else {
        Object.defineProperty(globalThis, "AudioContext", {
          configurable: true,
          value: previousAudioContext,
        });
      }
    }
  });

  it("uses supplied v13 loadout size and item quota in runtime UI", () => {
    const config = loadDogV13Config({
      ...DOG_V13_CONFIG,
      items: {
        ...DOG_V13_CONFIG.items,
        loadoutSize: 4,
      },
    });
    const root = document.createElement("div");
    const game = startDogLegeDogGame(root, {
      config,
      level: createLevel([
        createBlock("single-1", "单身狗"),
        createBlock("single-2", "单身狗", 4),
        createBlock("single-3", "单身狗", 8),
      ]),
      onLoadoutConfirmed: vi.fn(),
    });

    expect(root.querySelector('[data-testid="dog-loadout-count"]')?.textContent).toBe("0/4");
    expect(root.querySelector('[data-testid="dog-loadout-option"]')?.textContent).toContain("本关 1 次");

    for (const itemId of ["triple-removal", "tray-capacity", "wildcard", "torch"]) {
      root.querySelector<HTMLElement>(`[data-loadout-id="${itemId}"]`)?.click();
    }

    expect(root.querySelector('[data-testid="dog-loadout-count"]')?.textContent).toBe("4/4");
    expect(root.querySelector<HTMLButtonElement>("[data-testid=dog-loadout-confirm]")?.disabled).toBe(false);
    game.destroy();
  });
});

function createLevel(blocks: readonly DogBlock[]) {
  return { ...FIRST_LEVEL, blocks };
}

function createBlock(id: string, patternType: DogBlock["patternType"], x = 0): DogBlock {
  return {
    id,
    x,
    y: 0,
    z: 0,
    width: 4,
    height: 4,
    rotation: 0,
    patternType,
  };
}
