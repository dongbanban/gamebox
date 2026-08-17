import type { GameLaunchContext } from "../../catalog";
import type { DogLegeDogLevel } from "./first-level";
import type { GameSessionSnapshot } from "./game-session";
import type { GAME_ID } from "../../progress-store";

export interface DogLegeDogGameState {
  readonly gameId: typeof GAME_ID;
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
  selectBlock(blockId: string): GameSessionSnapshot;
  destroy(): void;
}

export type DogLegeDogGameOptions = GameLaunchContext;
