import {
  GAME_SESSION_MAX_TRAY_CAPACITY,
  GameSession,
  type GameSessionMeltLocation,
  type GameSessionMeltResult,
} from "@/games/dog-lege-dog/game/game-session";
import type {
  DogLegeDogLevel,
  DogPatternType,
} from "@/games/dog-lege-dog/levels/first-level";
import {
  DOG_ITEM_DEFINITIONS,
  type DogItemDefinition,
  type DogItemId,
  type DogItemTargetType,
  type DogItemVisualFeedback,
} from "@/games/dog-lege-dog/game/dog-loadout";

export type DogItemTarget =
  | { readonly type: "block"; readonly blockId: string }
  | { readonly type: "tray-block"; readonly blockId: string }
  | { readonly type: "pattern"; readonly patternType: DogPatternType };

export type DogItemEffect =
  | {
      readonly type: "triple-removal";
      readonly patternType: DogPatternType;
      readonly blockIds: readonly string[];
      readonly removedCount: number;
      readonly tripleCount: number;
      readonly meltedBlockIds?: readonly string[];
    }
  | ({
      readonly type: "melt";
    } & Pick<
      GameSessionMeltResult,
      "blockId" | "location" | "removedCount" | "tripleCount" | "meltedBlockIds"
    >)
  | {
      readonly type: "reveal";
      readonly blockId: string;
    };

export interface DogItemAnimationCompletion {
  readonly success: boolean;
  readonly effect?: DogItemEffect;
}

export interface DogItemAvailabilityContext {
  readonly level: DogLegeDogLevel;
  readonly session: GameSession;
  readonly remainingUses: number;
  readonly target?: DogItemTarget;
}

export interface DogItemExecutionContext extends DogItemAvailabilityContext {
  readonly target?: DogItemTarget;
}

export interface DogItemExecutionResult {
  readonly success: boolean;
  readonly visualFeedback: DogItemVisualFeedback;
  readonly commit?: () => boolean;
  readonly commitAfterAnimation?: () => DogItemAnimationCompletion;
  readonly effect?: DogItemEffect;
}

export interface DogItemRuntimeDefinition {
  readonly definition: DogItemDefinition;
  readonly getUses: (level: DogLegeDogLevel) => number;
  readonly canUse: (context: DogItemAvailabilityContext) => boolean;
  readonly execute: (context: DogItemExecutionContext) => DogItemExecutionResult;
}

export type DogItemRuntimePhase = "idle" | "targeting" | "animating";

export interface DogItemState {
  readonly id: DogItemId;
  readonly name: string;
  readonly icon: string;
  readonly description: string;
  readonly targetType: DogItemTargetType;
  readonly visualFeedback: DogItemVisualFeedback;
  readonly maxUses: number;
  readonly remainingUses: number;
  readonly available: boolean;
}

export interface DogItemRuntimeSnapshot {
  readonly phase: DogItemRuntimePhase;
  readonly selectedItemId: DogItemId | null;
  readonly selectedItemTargetType: DogItemTargetType | null;
  readonly visualFeedback: DogItemVisualFeedback | null;
  readonly tripleRemovalTargetPatterns: readonly DogPatternType[];
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

export interface DogItemRuntimeOptions {
  readonly level: DogLegeDogLevel;
  readonly session: GameSession;
  readonly loadout: readonly DogItemId[];
  readonly definitions?: readonly DogItemRuntimeDefinition[];
}

export class DogItemRuntime {
  private readonly level: DogLegeDogLevel;
  private readonly session: GameSession;
  private readonly loadout: readonly DogItemId[];
  private readonly definitions: ReadonlyMap<DogItemId, DogItemRuntimeDefinition>;
  private readonly maxUses = new Map<DogItemId, number>();
  private readonly remainingUses = new Map<DogItemId, number>();
  private phase: DogItemRuntimePhase = "idle";
  private selectedItemId: DogItemId | null = null;
  private visualFeedback: DogItemVisualFeedback | null = null;
  private pendingAnimationCommit: (() => DogItemAnimationCompletion) | null = null;
  private completedEffect: DogItemEffect | null = null;

  constructor(options: DogItemRuntimeOptions) {
    this.level = options.level;
    this.session = options.session;
    this.loadout = Object.freeze([...options.loadout]);
    this.definitions = new Map(
      (options.definitions ?? DOG_ITEM_RUNTIME_DEFINITIONS).map((definition) => [
        definition.definition.id,
        definition,
      ]),
    );

    for (const itemId of this.loadout) {
      if (this.remainingUses.has(itemId)) {
        throw new Error(`Duplicate 狗了个狗 item id in runtime loadout: ${itemId}`);
      }

      const definition = this.definitions.get(itemId);
      if (definition === undefined) {
        throw new Error(`狗了个狗 item runtime definition is missing: ${itemId}`);
      }

      const uses = normalizeUses(definition.getUses(this.level));
      this.maxUses.set(itemId, uses);
      this.remainingUses.set(itemId, uses);
    }
  }

  getState(): DogItemRuntimeSnapshot {
    const tripleRemovalTargetPatterns = this.session.getTripleRemovalTargetPatterns();
    const items = this.loadout.map((itemId) => {
      const runtimeDefinition = this.getDefinition(itemId);
      const { definition } = runtimeDefinition;
      const maxUses = this.maxUses.get(itemId) ?? 0;
      const remainingUses = this.remainingUses.get(itemId) ?? 0;
      const available =
        this.phase === "idle" &&
        this.session.getState().status === "playing" &&
        remainingUses > 0 &&
        this.canUse(runtimeDefinition, remainingUses);

      return Object.freeze({
        id: itemId,
        name: definition.name,
        icon: definition.icon,
        description: definition.description,
        targetType: definition.targetType,
        visualFeedback: definition.visualFeedback,
        maxUses,
        remainingUses,
        available,
      });
    });

    return Object.freeze({
      phase: this.phase,
      selectedItemId: this.selectedItemId,
      selectedItemTargetType:
        this.selectedItemId === null
          ? null
          : this.getDefinition(this.selectedItemId).definition.targetType,
      visualFeedback: this.visualFeedback,
      tripleRemovalTargetPatterns,
      items: Object.freeze(items),
    });
  }

  isInputLocked(): boolean {
    return this.phase !== "idle";
  }

  begin(itemId: DogItemId): DogItemActionResult {
    if (this.phase !== "idle" || !this.loadout.includes(itemId)) {
      return this.createActionResult(false, false, false, null);
    }

    const runtimeDefinition = this.definitions.get(itemId);
    if (runtimeDefinition === undefined) {
      return this.createActionResult(false, false, false, null);
    }

    const remainingUses = this.remainingUses.get(itemId) ?? 0;
    if (
      remainingUses <= 0 ||
      this.session.getState().status !== "playing" ||
      !this.canUse(runtimeDefinition, remainingUses)
    ) {
      return this.createActionResult(false, false, false, null);
    }

    if (runtimeDefinition.definition.targetType !== "none") {
      this.phase = "targeting";
      this.selectedItemId = itemId;
      return this.createActionResult(true, false, true, itemId);
    }

    return this.execute(itemId, runtimeDefinition, undefined);
  }

  confirmTarget(target: DogItemTarget): DogItemActionResult {
    if (this.phase !== "targeting" || this.selectedItemId === null) {
      return this.createActionResult(false, false, false, null);
    }

    const itemId = this.selectedItemId;
    const runtimeDefinition = this.getDefinition(itemId);
    if (!matchesTargetType(runtimeDefinition.definition.targetType, target)) {
      return this.createActionResult(false, false, true, itemId);
    }

    const remainingUses = this.remainingUses.get(itemId) ?? 0;
    if (
      remainingUses <= 0 ||
      this.session.getState().status !== "playing" ||
      !this.canUse(runtimeDefinition, remainingUses, target)
    ) {
      return this.createActionResult(false, false, true, itemId);
    }

    return this.execute(itemId, runtimeDefinition, target);
  }

  cancel(): DogItemRuntimeSnapshot {
    if (this.phase !== "targeting") {
      return this.getState();
    }

    this.phase = "idle";
    this.selectedItemId = null;
    this.visualFeedback = null;
    return this.getState();
  }

  completeAnimation(): DogItemRuntimeSnapshot {
    if (this.phase !== "animating") {
      return this.getState();
    }

    const pendingAnimationCommit = this.pendingAnimationCommit;
    this.pendingAnimationCommit = null;
    this.completedEffect = null;
    if (pendingAnimationCommit !== null) {
      try {
        const completion = pendingAnimationCommit();
        if (completion.success) {
          this.completedEffect = completion.effect ?? null;
        }
      } catch {
        this.completedEffect = null;
      }
    }

    this.phase = "idle";
    this.selectedItemId = null;
    this.visualFeedback = null;
    return this.getState();
  }

  getLastCompletedEffect(): DogItemEffect | null {
    return this.completedEffect;
  }

  private execute(
    itemId: DogItemId,
    runtimeDefinition: DogItemRuntimeDefinition,
    target: DogItemTarget | undefined,
  ): DogItemActionResult {
    const remainingUses = this.remainingUses.get(itemId) ?? 0;
    let result: DogItemExecutionResult;
    try {
      result = runtimeDefinition.execute({
        level: this.level,
        session: this.session,
        remainingUses,
        target,
      });
    } catch {
      return this.createActionResult(false, false, target === undefined, itemId);
    }

    if (!result.success) {
      return this.createActionResult(
        false,
        false,
        runtimeDefinition.definition.targetType !== "none",
        itemId,
      );
    }

    let committed = true;
    try {
      committed = result.commit?.() ?? true;
    } catch {
      committed = false;
    }
    if (!committed) {
      return this.createActionResult(
        false,
        false,
        runtimeDefinition.definition.targetType !== "none",
        itemId,
      );
    }

    this.remainingUses.set(itemId, remainingUses - 1);
    this.pendingAnimationCommit = result.commitAfterAnimation ?? null;
    this.completedEffect = null;
    this.phase = "animating";
    this.selectedItemId = itemId;
    this.visualFeedback = result.visualFeedback;
    return this.createActionResult(true, true, false, itemId, result.effect ?? null);
  }

  private canUse(
    runtimeDefinition: DogItemRuntimeDefinition,
    remainingUses: number,
    target?: DogItemTarget,
  ): boolean {
    try {
      return runtimeDefinition.canUse({
        level: this.level,
        session: this.session,
        remainingUses,
        target,
      });
    } catch {
      return false;
    }
  }

  private getDefinition(itemId: DogItemId): DogItemRuntimeDefinition {
    const definition = this.definitions.get(itemId);
    if (definition === undefined) {
      throw new Error(`狗了个狗 item runtime definition is missing: ${itemId}`);
    }
    return definition;
  }

  private createActionResult(
    accepted: boolean,
    success: boolean,
    requiresTarget: boolean,
    itemId: DogItemId | null,
    effect: DogItemEffect | null = null,
  ): DogItemActionResult {
    return Object.freeze({
      accepted,
      success,
      requiresTarget,
      itemId,
      effect,
      snapshot: this.getState(),
    });
  }
}

export function getDogItemUses(
  level: Pick<DogLegeDogLevel, "number">,
  itemId: DogItemId,
): number {
  if (itemId === "tray-capacity") {
    return 1;
  }

  return level.number % 2 === 0 ? 2 : 1;
}

interface DogItemBehavior {
  readonly canUse: (context: DogItemAvailabilityContext) => boolean;
  readonly execute: (context: DogItemExecutionContext) => DogItemExecutionResult;
}

const DOG_ITEM_BEHAVIORS: Readonly<Record<DogItemId, DogItemBehavior>> = {
  "triple-removal": {
    canUse: ({ session, target }) => {
      const patternType = getPatternTarget(target);
      if (patternType !== undefined) {
        return session.canRemoveTriple(patternType);
      }

      return session.getTripleRemovalTargetPatterns().some((candidatePatternType) =>
        session.canRemoveTriple(candidatePatternType),
      );
    },
    execute: ({ session, target }) => {
      const patternType = getPatternTarget(target);
      const plan = patternType === undefined
        ? null
        : session.getTripleRemovalPlan(patternType);
      if (plan === null) {
        return { success: false, visualFeedback: "triple-removal" };
      }

      let completed: ReturnType<GameSession["removeTriple"]> | null = null;
      return {
        success: true,
        visualFeedback: "triple-removal",
        effect: {
          type: "triple-removal" as const,
          patternType: plan.patternType,
          blockIds: plan.blockIds,
          removedCount: plan.removedCount,
          tripleCount: plan.tripleCount,
        },
        commit: () => true,
        commitAfterAnimation: () => {
          completed = session.removeTriple(plan.patternType);
          return {
            success: completed.removed,
            effect: completed.removed
              ? {
                  type: "triple-removal" as const,
                  patternType: completed.patternType,
                  blockIds: completed.blockIds,
                  removedCount: completed.removedCount,
                  tripleCount: completed.tripleCount,
                  meltedBlockIds: completed.meltedBlockIds,
                }
              : undefined,
          };
        },
      };
    },
  },
  "tray-capacity": {
    canUse: ({ session }) =>
      session.getState().status === "playing" &&
      session.getState().trayCapacity < GAME_SESSION_MAX_TRAY_CAPACITY,
    execute: ({ session }) => ({
      success: true,
      visualFeedback: "tray-capacity",
      commit: () => session.increaseTrayCapacity(),
    }),
  },
  wildcard: createUnavailableBehavior("wildcard"),
  torch: {
    canUse: ({ session, target }) => {
      if (target === undefined) {
        return hasMeltableFrozenBlock(session);
      }

      const meltTarget = getMeltTarget(target);
      return meltTarget !== undefined && session.canMeltFrozenBlock(
        meltTarget.blockId,
        meltTarget.location,
      );
    },
    execute: ({ session, target }) => {
      const meltTarget = target === undefined ? undefined : getMeltTarget(target);
      if (meltTarget === undefined) {
        return { success: false, visualFeedback: "torch" };
      }

      if (!session.canMeltFrozenBlock(meltTarget.blockId, meltTarget.location)) {
        return { success: false, visualFeedback: "torch" };
      }

      return {
        success: true,
        visualFeedback: "torch",
        effect: {
          type: "melt",
          blockId: meltTarget.blockId,
          location: meltTarget.location,
          removedCount: 0,
          tripleCount: 0,
          meltedBlockIds: [meltTarget.blockId],
        },
        commitAfterAnimation: () => {
          const completed = session.meltFrozenBlock(meltTarget.blockId, meltTarget.location);
          return {
            success: completed.melted,
            effect: completed.melted
              ? {
                  type: "melt",
                  blockId: completed.blockId,
                  location: completed.location,
                  removedCount: completed.removedCount,
                  tripleCount: completed.tripleCount,
                  meltedBlockIds: completed.meltedBlockIds,
                }
              : undefined,
          };
        },
      };
    },
  },
  detector: {
    canUse: ({ session, target }) => {
      if (target === undefined) {
        return hasRevealableIllusionBlock(session);
      }

      const revealTarget = getDetectorTarget(target);
      return revealTarget !== undefined && session.canRevealIllusionBlock(revealTarget.blockId);
    },
    execute: ({ session, target }) => {
      const revealTarget = target === undefined ? undefined : getDetectorTarget(target);
      if (revealTarget === undefined || !session.canRevealIllusionBlock(revealTarget.blockId)) {
        return { success: false, visualFeedback: "detector" };
      }

      return {
        success: true,
        visualFeedback: "detector",
        effect: {
          type: "reveal",
          blockId: revealTarget.blockId,
        },
        commitAfterAnimation: () => {
          const completed = session.revealIllusionBlock(revealTarget.blockId);
          return {
            success: completed.revealed,
            effect: completed.revealed
              ? {
                  type: "reveal",
                  blockId: completed.blockId,
                }
              : undefined,
          };
        },
      };
    },
  },
};

function createUnavailableBehavior(visualFeedback: DogItemVisualFeedback): DogItemBehavior {
  return {
    canUse: () => false,
    execute: () => ({
      success: false,
      visualFeedback,
    }),
  };
}

export const DOG_ITEM_RUNTIME_DEFINITIONS: readonly DogItemRuntimeDefinition[] = Object.freeze(
  DOG_ITEM_DEFINITIONS.map((definition) =>
    Object.freeze({
      definition,
      getUses: (level: DogLegeDogLevel) => getDogItemUses(level, definition.id),
      ...DOG_ITEM_BEHAVIORS[definition.id],
    }),
  ),
);

function matchesTargetType(
  targetType: DogItemTargetType,
  target: DogItemTarget,
): boolean {
  if (targetType === "block") {
    return target.type === "block" || target.type === "tray-block";
  }

  if (targetType === "pattern" || targetType === "tray-pattern") {
    return target.type === "pattern";
  }

  return false;
}

function hasMeltableFrozenBlock(session: GameSession): boolean {
  const state = session.getState();
  return state.remainingBlocks.some(
    (block) => session.canMeltFrozenBlock(block.id, "board"),
  ) || state.trayBlocks.some(
    (block) => session.canMeltFrozenBlock(block.id, "tray"),
  );
}

function hasRevealableIllusionBlock(session: GameSession): boolean {
  return session.getState().remainingBlocks.some(
    (block) => session.canRevealIllusionBlock(block.id),
  );
}

function getDetectorTarget(
  target: DogItemTarget,
): { readonly blockId: string } | undefined {
  return target.type === "block" ? { blockId: target.blockId } : undefined;
}

function getPatternTarget(
  target: DogItemTarget | undefined,
): DogPatternType | undefined {
  return target?.type === "pattern" ? target.patternType : undefined;
}

function getMeltTarget(
  target: DogItemTarget,
): { readonly blockId: string; readonly location: GameSessionMeltLocation } | undefined {
  if (target.type === "block") {
    return { blockId: target.blockId, location: "board" };
  }

  if (target.type === "tray-block") {
    return { blockId: target.blockId, location: "tray" };
  }

  return undefined;
}

function normalizeUses(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.floor(value));
}
