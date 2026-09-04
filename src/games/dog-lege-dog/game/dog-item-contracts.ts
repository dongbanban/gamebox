import type {
  GameSessionMeltLocation,
  GameSessionMeltResult,
  GameSessionSnapshot,
  GameSessionWildcardResolution,
} from "@/games/dog-lege-dog/game/game-session-contracts";
import type { GameSession } from "@/games/dog-lege-dog/game/game-session";
import type {
  DogLegeDogLevel,
  DogPatternType,
} from "@/games/dog-lege-dog/levels/level-types";
import type {
  DogItemDefinition,
  DogItemId,
  DogItemTargetType,
  DogItemVisualFeedback,
} from "@/games/dog-lege-dog/game/dog-loadout";
import type { DogV13Config } from "@/games/dog-lege-dog/game/v13-config";

export type DogItemTarget =
  | { readonly type: "block"; readonly blockId: string }
  | { readonly type: "tray-block"; readonly blockId: string };

export type DogItemEffect =
  | {
      readonly type: "triple-removal";
      readonly patternType: DogPatternType;
      readonly trayBlockIds: readonly string[];
      readonly blockIds: readonly string[];
      readonly removedCount: number;
      readonly tripleCount: number;
      readonly meltedBlockIds?: readonly string[];
    }
  | ({ readonly type: "melt" } & Pick<
      GameSessionMeltResult,
      "blockId" | "location" | "removedCount" | "tripleCount" | "meltedBlockIds"
    >)
  | { readonly type: "demagnetize"; readonly blockId: string }
  | { readonly type: "reveal"; readonly blockId: string }
  | { readonly type: "unlock"; readonly unlockedSlotIndex: number }
  | { readonly type: "restore-shuffle" }
  | ({ readonly type: "wildcard" } & GameSessionWildcardResolution);

export interface DogItemAnimationCompletion {
  readonly success: boolean;
  readonly effect?: DogItemEffect;
}

export interface DogItemAvailabilityContext {
  readonly config: DogV13Config;
  readonly level: DogLegeDogLevel;
  readonly session: GameSession;
  readonly remainingUses: number;
  readonly target?: DogItemTarget;
}

export type DogItemExecutionContext = DogItemAvailabilityContext;

export interface DogItemExecutionResult {
  readonly success: boolean;
  readonly visualFeedback: DogItemVisualFeedback;
  readonly commit?: () => boolean;
  readonly commitAfterAnimation?: () => DogItemAnimationCompletion;
  readonly effect?: DogItemEffect;
}

export interface DogItemRuntimeDefinition {
  readonly definition: DogItemDefinition;
  readonly getUses?: (level: DogLegeDogLevel, config?: DogV13Config) => number;
  readonly canUse: (context: DogItemAvailabilityContext) => boolean;
  readonly execute: (context: DogItemExecutionContext) => DogItemExecutionResult;
}

export type DogItemRuntimePhase = "idle" | "targeting" | "animating";

export interface DogItemState {
  readonly id: DogItemId;
  readonly name: string;
  readonly remainingUses: number;
  readonly available: boolean;
}

export interface DogItemRuntimeSnapshot {
  readonly phase: DogItemRuntimePhase;
  readonly selectedItemId: DogItemId | null;
  readonly selectedItemTargetType: DogItemTargetType | null;
  readonly visualFeedback: DogItemVisualFeedback | null;
  readonly tripleRemovalTargetBlockIds: readonly string[];
  readonly wildcardTargetBlockIds: readonly string[];
  readonly demagnetizerTargetBlockIds: readonly string[];
  readonly items: readonly DogItemState[];
}

export interface DogItemActionResult {
  readonly accepted: boolean;
  readonly success: boolean;
  readonly requiresTarget: boolean;
  readonly itemId: DogItemId | null;
  readonly effect: DogItemEffect | null;
  readonly snapshot: DogItemRuntimeSnapshot;
}

export interface DogKeyDropResult {
  readonly dropped: boolean;
  readonly remainingUses: number;
  readonly snapshot: GameSessionSnapshot;
}

export interface DogItemRuntimeOptions {
  readonly config?: DogV13Config;
  readonly level: DogLegeDogLevel;
  readonly session: GameSession;
  readonly loadout: readonly DogItemId[];
  readonly definitions?: readonly DogItemRuntimeDefinition[];
}

export type { GameSessionMeltLocation };
