import {
  DOG_V13_CONFIG,
  type DogV13Config,
  type DogV13ParticleEffectProfile,
} from "@/games/dog-lege-dog/game/game-config";

export type ParticleEffect = "match" | "won" | "lost";

interface Particle {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  size: number;
  color: string;
  rotation: number;
}

interface ParticleRun {
  complete(): void;
}

export interface ParticleEffects {
  play(effect: ParticleEffect): Promise<void>;
  destroy(): void;
}

export function createParticleEffects(
  root: HTMLElement,
  config: DogV13Config = DOG_V13_CONFIG,
): ParticleEffects {
  const runs = new Set<ParticleRun>();
  let destroyed = false;

  return {
    play(effect: ParticleEffect): Promise<void> {
      if (destroyed) {
        return Promise.resolve();
      }

      const canvas = root.querySelector<HTMLCanvasElement>(
        '[data-testid="dog-effects-canvas"]',
      );
      const context = getCanvasContext(canvas);
      const profile = config.ui.particles[effect];
      const duration = profile.durationMs;
      const particles = createParticles(effect, profile);
      const startedAt = getNow();
      let animationFrame: number | null = null;
      let timer: ReturnType<typeof setTimeout> | null = null;
      let settled = false;
      let resolvePromise: () => void = () => undefined;
      let run: ParticleRun = { complete: () => undefined };
      const promise = new Promise<void>((resolve) => {
        resolvePromise = resolve;
      });

      const complete = (): void => {
        if (settled) {
          return;
        }

        settled = true;
        if (timer !== null) {
          clearTimeout(timer);
          timer = null;
        }
        if (animationFrame !== null) {
          cancelAnimationFrame(animationFrame);
          animationFrame = null;
        }
        context?.clearRect(0, 0, context.canvas.width, context.canvas.height);
        runs.delete(run);
        resolvePromise();
      };
      run = { complete };
      runs.add(run);
      timer = setTimeout(complete, duration);

      if (context !== null) {
        resizeCanvas(context.canvas);
        const draw = (timestamp: number): void => {
          if (settled) {
            return;
          }

          const progress = Math.min(1, (timestamp - startedAt) / duration);
          drawParticles(context, particles, progress, effect);
          if (progress < 1 && typeof requestAnimationFrame === "function") {
            animationFrame = requestAnimationFrame(draw);
          }
        };

        if (typeof requestAnimationFrame === "function") {
          animationFrame = requestAnimationFrame(draw);
        } else {
          draw(startedAt);
        }
      }

      return promise;
    },

    destroy(): void {
      destroyed = true;
      for (const run of [...runs]) {
        run.complete();
      }
      runs.clear();
    },
  };
}

function getCanvasContext(canvas: HTMLCanvasElement | null): CanvasRenderingContext2D | null {
  if (canvas === null) {
    return null;
  }

  const userAgent = canvas.ownerDocument.defaultView?.navigator.userAgent ?? "";
  if (userAgent.includes("jsdom")) {
    return null;
  }

  try {
    return canvas.getContext("2d");
  } catch {
    return null;
  }
}

function resizeCanvas(canvas: HTMLCanvasElement): void {
  const width = Math.max(1, Math.floor(canvas.clientWidth || canvas.parentElement?.clientWidth || 1));
  const height = Math.max(1, Math.floor(canvas.clientHeight || canvas.parentElement?.clientHeight || 1));
  if (canvas.width !== width) {
    canvas.width = width;
  }
  if (canvas.height !== height) {
    canvas.height = height;
  }
}

function createParticles(
  effect: ParticleEffect,
  profile: DogV13ParticleEffectProfile,
): Particle[] {
  return Array.from({ length: profile.count }, (_, index) => ({
    x: 0.2 + ((index * 37) % 60) / 100,
    y: 0.32 + ((index * 19) % 25) / 100,
    velocityX: ((index % 7) - 3) * (effect === "match" ? 0.82 : 0.7),
    velocityY: -1.2 - (index % 4) * (effect === "match" ? 0.16 : 0.12),
    size: effect === "match" ? 6 + (index % 4) * 2 : 4 + (index % 4) * 2,
    color: profile.colors[index % profile.colors.length],
    rotation: (index * 27) % 360,
  }));
}

function drawParticles(
  context: CanvasRenderingContext2D,
  particles: readonly Particle[],
  progress: number,
  effect: ParticleEffect,
): void {
  const { canvas } = context;
  context.clearRect(0, 0, canvas.width, canvas.height);
  for (const particle of particles) {
    const x = particle.x * canvas.width + particle.velocityX * progress * canvas.width * 0.25;
    const y =
      particle.y * canvas.height +
      particle.velocityY * progress * canvas.height * 0.35 +
      progress * progress * canvas.height * 0.22;
    context.save();
    context.globalAlpha = 1 - progress;
    context.translate(x, y);
    context.rotate((particle.rotation + progress * 180) * (Math.PI / 180));
    context.fillStyle = particle.color;
    if (effect === "lost") {
      context.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size);
    } else {
      context.fillRect(-particle.size / 2, -particle.size / 3, particle.size, particle.size / 1.5);
    }
    context.restore();
  }
}

function getNow(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}
