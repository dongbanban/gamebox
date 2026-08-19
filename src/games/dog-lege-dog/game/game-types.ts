import type { GameLaunchContext } from "@/game-contracts";
import type { DogLegeDogLevel } from "@/games/dog-lege-dog/levels/first-level";
import type { GameSessionSnapshot } from "@/games/dog-lege-dog/game/game-session";
import type { DOG_GAME_ID } from "@/games/dog-lege-dog/game/game-config";

export interface DogLegeDogGameState {
  readonly gameId: typeof DOG_GAME_ID;
  readonly status: "ready" | GameSessionSnapshot["status"];
  readonly level: DogLegeDogLevel;
  readonly session: GameSessionSnapshot;
  readonly inputLocked: boolean;
  readonly feedback: DogVisualFeedback;
  readonly soundEnabled: boolean;
  readonly debug: {
    readonly elapsedMs: number;
  };
}

export type DogVisualFeedback = "idle" | "match" | "won" | "lost";

export interface DogLegeDogGame {
  start(): DogLegeDogGameState;
  getState(): DogLegeDogGameState;
  setSoundEnabled(soundEnabled: boolean): void;
  selectBlock(blockId: string): GameSessionSnapshot;
  destroy(): void;
}

export type DogLegeDogGameOptions = GameLaunchContext;
