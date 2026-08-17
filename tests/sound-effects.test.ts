import { afterEach, describe, expect, it, vi } from "vitest";
import { createSoundEffects } from "../src/games/dog-lege-dog/sound-effects";

interface FakeAudioContext {
  readonly state: "suspended" | "running" | "closed";
  readonly createOscillator: ReturnType<typeof vi.fn>;
  readonly createGain: ReturnType<typeof vi.fn>;
  readonly resume: ReturnType<typeof vi.fn>;
  readonly close: ReturnType<typeof vi.fn>;
}

const originalAudioContext = (globalThis as typeof globalThis & {
  AudioContext?: unknown;
}).AudioContext;

afterEach(() => {
  Object.defineProperty(globalThis, "AudioContext", {
    configurable: true,
    value: originalAudioContext,
  });
});

describe("SoundEffects", () => {
  it("首次播放前不创建 AudioContext，初始化后支持点击、三消、通关与失败音效", () => {
    const contexts: FakeAudioContext[] = [];
    installFakeAudioContext(contexts);
    const effects = createSoundEffects(true);

    effects.play("select");
    expect(contexts).toHaveLength(0);

    effects.initialize();
    expect(contexts).toHaveLength(1);
    effects.play("select");
    effects.play("match");
    effects.play("won");
    effects.play("lost");

    expect(contexts[0].createOscillator).toHaveBeenCalledTimes(4);
    effects.destroy();
  });

  it("静音后不再创建新的音效节点", () => {
    const contexts: FakeAudioContext[] = [];
    installFakeAudioContext(contexts);
    const effects = createSoundEffects(true);
    effects.initialize();
    effects.setEnabled(false);

    effects.play("select");

    expect(contexts[0].createOscillator).not.toHaveBeenCalled();
    effects.destroy();
  });
});

function installFakeAudioContext(contexts: FakeAudioContext[]): void {
  class FakeAudioContextConstructor {
    readonly state = "suspended" as const;
    readonly currentTime = 0;
    readonly destination = {};
    readonly createOscillator = vi.fn(() => ({
      type: "sine",
      frequency: {
        setValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    }));
    readonly createGain = vi.fn(() => ({
      gain: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
    }));
    readonly resume = vi.fn(async () => undefined);
    readonly close = vi.fn(async () => undefined);

    constructor() {
      contexts.push(this as unknown as FakeAudioContext);
    }
  }

  Object.defineProperty(globalThis, "AudioContext", {
    configurable: true,
    value: FakeAudioContextConstructor,
  });
}
