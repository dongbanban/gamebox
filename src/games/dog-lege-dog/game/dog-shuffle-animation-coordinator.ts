import {
  animateDogShuffleEffect,
  type CancellableAnimation,
} from "@/games/dog-lege-dog/assets/animation-effects";
import type { DogV13Config } from "@/games/dog-lege-dog/game/v13-config";
import type { GameSessionSnapshot } from "@/games/dog-lege-dog/game/game-session";

export interface DogShuffleAnimationOptions {
  readonly activeFlights: Set<CancellableAnimation>;
  readonly config: DogV13Config;
  readonly outcome: "reordered" | "stable";
  readonly render: (snapshot?: GameSessionSnapshot) => void;
  readonly root: HTMLElement;
  readonly snapshot: GameSessionSnapshot;
}

export async function playDogShuffleEffect(
  options: DogShuffleAnimationOptions,
): Promise<void> {
  const animation = animateDogShuffleEffect({
    root: options.root,
    config: options.config,
    outcome: options.outcome,
  });
  options.activeFlights.add(animation);
  options.render(options.snapshot);
  await animation.promise;
  options.activeFlights.delete(animation);
}
