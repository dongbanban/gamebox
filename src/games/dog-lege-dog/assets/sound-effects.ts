export type DogSoundEffect = "select" | "match" | "won" | "lost";

export const DOG_MUSIC_ASSET_PATH = "audio/levelmusicloop-tigrun.ogg";

export interface SoundEffects {
  initialize(): void;
  setEnabled(enabled: boolean): void;
  play(effect: DogSoundEffect): void;
  destroy(): void;
}

interface SoundProfile {
  readonly frequency: number;
  readonly duration: number;
  readonly type: OscillatorType;
}

const SOUND_PROFILES: Record<DogSoundEffect, SoundProfile> = {
  select: { frequency: 520, duration: 0.07, type: "sine" },
  match: { frequency: 760, duration: 0.16, type: "triangle" },
  won: { frequency: 920, duration: 0.3, type: "sine" },
  lost: { frequency: 190, duration: 0.32, type: "sawtooth" },
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
      try {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = profile.type;
        oscillator.frequency.setValueAtTime(profile.frequency, now);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.08, now + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + profile.duration);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(now);
        oscillator.stop(now + profile.duration);
      } catch {
        // Audio is optional. A browser audio failure cannot block gameplay.
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
  audio.volume = 0.18;
  audio.setAttribute("aria-hidden", "true");
  return audio;
}
