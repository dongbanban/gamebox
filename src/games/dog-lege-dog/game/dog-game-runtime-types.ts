import type { CancellableAnimation } from "@/games/dog-lege-dog/assets/animation-effects";
import type { DogItemId } from "@/games/dog-lege-dog/game/dog-loadout";
import type { DogItemRuntime } from "@/games/dog-lege-dog/game/dog-item-runtime";
import type {
  DogLoadoutEditorState,
  DogVisualFeedback,
} from "@/games/dog-lege-dog/game/game-types";
import type { GameSession } from "@/games/dog-lege-dog/game/game-session";
import type { DogLegeDogLevel } from "@/games/dog-lege-dog/levels/first-level";
import type { DogV13Config } from "@/games/dog-lege-dog/game/v13-config";

export interface DogGameRuntime {
  readonly level: DogLegeDogLevel;
  readonly config: DogV13Config;
  session: GameSession;
  started: boolean;
  destroyed: boolean;
  hasInteracted: boolean;
  inputLocked: boolean;
  feedback: DogVisualFeedback;
  soundEnabled: boolean;
  resultConfirmed: boolean;
  resultPresented: boolean;
  startedAt: number | null;
  endedAt: number | null;
  activeFlights: Set<CancellableAnimation>;
  matchFeedbackActive: boolean;
  matchAnimation: Promise<void> | null;
  meltAnimation: Promise<void> | null;
  loadout: readonly DogItemId[] | null;
  itemRuntime: DogItemRuntime | null;
  itemAnimation: CancellableAnimation | null;
  loadoutEditor: DogLoadoutEditorState | null;
}
