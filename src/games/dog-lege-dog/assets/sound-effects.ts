export type DogSoundEffect = "select" | "match" | "won" | "lost";

export const DOG_MUSIC_ASSET_PATH = "audio/levelmusicloop-tigrun.ogg";

export interface SoundEffects {
  initialize(): void;
  setEnabled(enabled: boolean): void;
  play(effect: DogSoundEffect): void;
  destroy(): void;
}

interface SoundProfile {
  readonly frequencies: readonly number[];
  readonly duration: number;
  readonly type: OscillatorType;
  readonly volume: number;
  readonly noteSpacing: number;
}

const SOUND_PROFILES: Record<DogSoundEffect, SoundProfile> = {
  select: {
    frequencies: [660, 880],
    duration: 0.14,
    type: "triangle",
    volume: 0.16,
    noteSpacing: 0.035,
  },
  match: {
    frequencies: [523, 659, 784, 1046],
    duration: 0.4,
    type: "sine",
    volume: 0.3,
    noteSpacing: 0.055,
  },
  won: {
    frequencies: [659, 784, 988, 1318],
    duration: 0.5,
    type: "sine",
    volume: 0.22,
    noteSpacing: 0.07,
  },
  lost: {
    frequencies: [220, 174],
    duration: 0.32,
    type: "sawtooth",
    volume: 0.12,
    noteSpacing: 0.08,
  },
};

type AudioContextConstructor = new () => AudioContext;

export function createSoundEffects(initialEnabled: boolean): SoundEffects {
  let enabled = initialEnabled;
  let initialized = false;
  let context: AudioContext | null = null;
  let music: HTMLAudioElement | null = null;

  function startMusic(): void {
    if (!music || !enabled) {
      return;
    }

    try {
      const playResult = music.play();
      void playResult.catch(() => undefined);
    } catch {
      // Background music is optional. Browser autoplay or media failures cannot block gameplay.
    }
  }

  function stopMusic(): void {
    if (!music) {
      return;
    }

    try {
      music.pause();
    } catch {
      // Media cleanup is best effort.
    }
  }

  return {
    initialize(): void {
      if (initialized) {
        startMusic();
        return;
      }

      initialized = true;
      music = createBackgroundMusic();
      const browserGlobal = globalThis as typeof globalThis & {
        AudioContext?: AudioContextConstructor;
        webkitAudioContext?: AudioContextConstructor;
      };
      const AudioContextType = browserGlobal.AudioContext ?? browserGlobal.webkitAudioContext;
      if (AudioContextType === undefined) {
        startMusic();
        return;
      }

      try {
        context = new AudioContextType();
        if (context.state === "suspended") {
          void context.resume().catch(() => undefined);
        }
      } catch {
        context = null;
      }

      startMusic();
    },

    setEnabled(nextEnabled: boolean): void {
      enabled = nextEnabled;
      if (enabled) {
        startMusic();
      } else {
        stopMusic();
      }
    },

    play(effect: DogSoundEffect): void {
      if (!enabled || context === null) {
        return;
      }

      const profile = SOUND_PROFILES[effect];
      const now = context.currentTime;
      for (const [index, frequency] of profile.frequencies.entries()) {
        const startAt = now + index * profile.noteSpacing;
        const endAt = Math.min(now + profile.duration, startAt + 0.16);
        const attackAt = Math.min(startAt + 0.012, endAt - 0.005);
        if (attackAt <= startAt) {
          continue;
        }

        try {
          const oscillator = context.createOscillator();
          const gain = context.createGain();
          oscillator.type = profile.type;
          oscillator.frequency.setValueAtTime(frequency, startAt);
          gain.gain.setValueAtTime(0.0001, startAt);
          gain.gain.exponentialRampToValueAtTime(
            profile.volume / profile.frequencies.length,
            attackAt,
          );
          gain.gain.exponentialRampToValueAtTime(0.0001, endAt);
          oscillator.connect(gain);
          gain.connect(context.destination);
          oscillator.start(startAt);
          oscillator.stop(endAt);
        } catch {
          // Audio is optional. A browser audio failure cannot block gameplay.
        }
      }
    },

    destroy(): void {
      stopMusic();
      music = null;
      if (context === null || context.state === "closed") {
        return;
      }

      void context.close().catch(() => undefined);
      context = null;
    },
  };
}

function createBackgroundMusic(): HTMLAudioElement | null {
  if (
    typeof document === "undefined" ||
    document.defaultView?.navigator.userAgent.includes("jsdom")
  ) {
    return null;
  }

  const audio = document.createElement("audio");
  audio.src = new URL(DOG_MUSIC_ASSET_PATH, document.baseURI).toString();
  audio.loop = true;
  audio.preload = "auto";
  audio.volume = 0.1;
  audio.setAttribute("aria-hidden", "true");
  return audio;
}
