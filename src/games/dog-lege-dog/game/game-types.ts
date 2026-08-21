import type { GameLaunchContext } from "@/game-contracts";
import type { DogLegeDogLevel } from "@/games/dog-lege-dog/levels/first-level";
import type { GameSessionSnapshot } from "@/games/dog-lege-dog/game/game-session";
import type { DOG_GAME_ID } from "@/games/dog-lege-dog/game/game-config";
import type { DogItemId } from "@/games/dog-lege-dog/game/dog-loadout";
import type { DogItemRuntimeSnapshot } from "@/games/dog-lege-dog/game/dog-item-runtime";

export interface DogLegeDogGameState {
  readonly gameId: typeof DOG_GAME_ID;
  readonly status: "ready" | GameSessionSnapshot["status"];
  readonly level: DogLegeDogLevel;
  readonly session: GameSessionSnapshot;
  readonly inputLocked: boolean;
  readonly loadoutLocked: boolean;
  readonly feedback: DogVisualFeedback;
  readonly soundEnabled: boolean;
  readonly loadout: readonly DogItemId[] | null;
  readonly items: DogItemRuntimeSnapshot | null;
  readonly loadoutEditor: DogLoadoutEditorState | null;
  readonly debug: {
    readonly elapsedMs: number;
  };
}

export type DogLoadoutEditorMode = "initial" | "change";

export interface DogLoadoutEditorState {
  readonly mode: DogLoadoutEditorMode;
  readonly draft: readonly DogItemId[];
  readonly confirming: boolean;
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
