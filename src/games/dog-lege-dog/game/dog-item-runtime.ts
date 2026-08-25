import {
  GAME_SESSION_MAX_TRAY_CAPACITY,
  GameSession,
  type GameSessionMeltLocation,
  type GameSessionMeltResult,
  type GameSessionSnapshot,
  type GameSessionWildcardResolution,
} from "@/games/dog-lege-dog/game/game-session";
import type {
  DogLegeDogLevel,
  DogPatternType,
} from "@/games/dog-lege-dog/levels/first-level";
import { DOG_KEY_DROP_RATE } from "@/games/dog-lege-dog/game/game-config";
import {
  DOG_ITEM_DEFINITIONS,
  type DogItemDefinition,
  type DogItemId,
  type DogItemTargetType,
  type DogItemVisualFeedback,
} from "@/games/dog-lege-dog/game/dog-loadout";
import { SeededRandom } from "@/games/dog-lege-dog/levels/level-random";

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
  | ({
      readonly type: "melt";
    } & Pick<
      GameSessionMeltResult,
      "blockId" | "location" | "removedCount" | "tripleCount" | "meltedBlockIds"
    >)
  | {
      readonly type: "demagnetize";
      readonly blockId: string;
    }
  | {
      readonly type: "reveal";
      readonly blockId: string;
    }
  | {
      readonly type: "unlock";
      readonly unlockedSlotIndex: number;
    }
  | DogWildcardItemEffect;

type DogWildcardItemEffect = {
  readonly type: "wildcard";
} & GameSessionWildcardResolution;

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
  private readonly keyDropRandom: SeededRandom;
  private readonly maxUses = new Map<DogItemId, number>();
  private readonly remainingUses = new Map<DogItemId, number>();
  private phase: DogItemRuntimePhase = "idle";
  private selectedItemId: DogItemId | null = null;
  private visualFeedback: DogItemVisualFeedback | null = null;
  private pendingAnimationCommit: (() => DogItemAnimationCompletion) | null = null;
  private pendingAnimationItemId: DogItemId | null = null;
  private completedEffect: DogItemEffect | null = null;

  constructor(options: DogItemRuntimeOptions) {
    this.level = options.level;
    this.session = options.session;
    this.loadout = Object.freeze([...options.loadout]);
    this.keyDropRandom = new SeededRandom(`${options.level.runSeed}:key-drop`);
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

      const maxUses = itemId === "key"
        ? this.session.getState().lockedTraySlotCount
        : normalizeUses(definition.getUses(this.level));
      this.maxUses.set(itemId, maxUses);
      this.remainingUses.set(itemId, itemId === "key" ? 0 : maxUses);
    }
  }

  getState(): DogItemRuntimeSnapshot {
    const tripleRemovalTargetPatterns = this.session.getTripleRemovalTargetPatterns();
    const tripleRemovalTargetBlockIds = this.session.getTripleRemovalTargetBlockIds();
    const wildcardTargetBlockIds = this.selectedItemId === "wildcard"
      ? this.session.getWildcardTargetBlockIds()
      : [];
    const demagnetizerTargetBlockIds = this.phase === "targeting" &&
        this.selectedItemId === "demagnetizer"
      ? this.session.getDemagnetizerTargetBlockIds()
      : [];
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
      tripleRemovalTargetBlockIds,
      wildcardTargetBlockIds,
      demagnetizerTargetBlockIds,
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
    const pendingAnimationItemId = this.pendingAnimationItemId;
    this.pendingAnimationCommit = null;
    this.pendingAnimationItemId = null;
    this.completedEffect = null;
    let commitSucceeded = pendingAnimationCommit === null;
    if (pendingAnimationCommit !== null) {
      try {
        const completion = pendingAnimationCommit();
        commitSucceeded = completion.success;
        if (completion.success) {
          this.completedEffect = completion.effect ?? null;
        }
      } catch {
        commitSucceeded = false;
        this.completedEffect = null;
      }
    }
    if (!commitSucceeded && pendingAnimationItemId !== null) {
      const remainingUses = this.remainingUses.get(pendingAnimationItemId) ?? 0;
      const maxUses = this.maxUses.get(pendingAnimationItemId) ?? 0;
      this.remainingUses.set(pendingAnimationItemId, Math.min(maxUses, remainingUses + 1));
    }

    this.phase = "idle";
    this.selectedItemId = null;
    this.visualFeedback = null;
    return this.getState();
  }

  getLastCompletedEffect(): DogItemEffect | null {
    return this.completedEffect;
  }

  settleSuccessfulTriples(tripleCount: number): DogKeyDropResult {
    const maxUses = this.maxUses.get("key") ?? 0;
    const currentUses = this.remainingUses.get("key") ?? 0;
    const state = this.session.getState();
    const eligible =
      this.loadout.includes("key") &&
      Number.isSafeInteger(tripleCount) &&
      tripleCount > 0 &&
      state.status === "playing" &&
      state.lockedTraySlotCount > 0 &&
      state.remainingLogicalUnitCount > state.trayFreeCapacity &&
      currentUses < maxUses;
    const dropped = eligible && this.keyDropRandom.next() < DOG_KEY_DROP_RATE;
    if (dropped) {
      this.remainingUses.set("key", Math.min(maxUses, currentUses + 1));
    }

    return Object.freeze({
      dropped,
      remainingUses: this.remainingUses.get("key") ?? 0,
      snapshot: state,
    });
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
    this.pendingAnimationItemId = result.commitAfterAnimation === undefined ? null : itemId;
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
  level: Pick<DogLegeDogLevel, "number"> &
    Partial<Pick<DogLegeDogLevel, "specialMechanisms">>,
  itemId: DogItemId,
): number {
  // Legacy adapter. v13 quota source is getDogV13ItemUses; runtime migration is ticket 27.
  if (itemId === "key") {
    return 0;
  }

  if (itemId === "tray-capacity") {
    return 1;
  }

  const baseUses = level.number % 2 === 0 ? 2 : 1;
  const mechanismType = itemId === "torch" || itemId === "wildcard"
    ? "freeze"
    : itemId === "detector"
      ? "illusion"
      : itemId === "demagnetizer"
        ? "magnetic"
        : undefined;
  if (mechanismType === undefined) {
    return baseUses;
  }

  const configuration = level.specialMechanisms?.find(
    (candidate) => candidate.type === mechanismType,
  );
  if (configuration === undefined) {
    return baseUses;
  }

  const rangeBonus = Math.max(0, Math.ceil((configuration.max - 2) / 2));
  const densityBonus = Math.max(
    0,
    Math.ceil((configuration.densityWeight ?? 1) - 1),
  );
  const configuredBonus = configuration.itemUseBonus ?? 0;
  return baseUses + Math.max(rangeBonus, densityBonus, configuredBonus);
}

interface DogItemBehavior {
  readonly canUse: (context: DogItemAvailabilityContext) => boolean;
  readonly execute: (context: DogItemExecutionContext) => DogItemExecutionResult;
}

const DOG_ITEM_BEHAVIORS: Readonly<Record<DogItemId, DogItemBehavior>> = {
  "triple-removal": {
    canUse: ({ session, target }) => {
      const targetBlockId = getTripleRemovalTarget(target);
      if (targetBlockId !== undefined) {
        return session.getTripleRemovalPlanForTrayBlock(targetBlockId) !== null;
      }

      return session.getTripleRemovalTargetBlockIds().length > 0;
    },
    execute: ({ session, target }) => {
      const targetBlockId = getTripleRemovalTarget(target);
      const plan = targetBlockId === undefined
        ? null
        : session.getTripleRemovalPlanForTrayBlock(targetBlockId);
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
          trayBlockIds: plan.trayBlockIds,
          blockIds: plan.blockIds,
          removedCount: plan.removedCount,
          tripleCount: plan.tripleCount,
        },
        commit: () => true,
        commitAfterAnimation: () => {
          completed = session.removeTripleForTrayBlock(plan.trayBlockIds[0] ?? "");
          return {
            success: completed.removed,
            effect: completed.removed
              ? {
                  type: "triple-removal" as const,
                  patternType: completed.patternType,
                  trayBlockIds: completed.trayBlockIds,
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
  wildcard: {
    canUse: ({ session, target }) => {
      const patternType = getWildcardTargetPattern(session, target);
      if (patternType !== undefined) {
        return session.getWildcardPlan(patternType) !== null;
      }

      return session.getWildcardTargetBlockIds().length > 0;
    },
    execute: ({ session, target }) => {
      const patternType = getWildcardTargetPattern(session, target);
      if (patternType === undefined) {
        return { success: false, visualFeedback: "wildcard" };
      }

      const plan = session.getWildcardPlan(patternType);
      if (plan === null) {
        return { success: false, visualFeedback: "wildcard" };
      }

      return {
        success: true,
        visualFeedback: "wildcard",
        effect: toWildcardEffect(plan),
        commitAfterAnimation: () => {
          const completed = session.useWildcard(patternType);
          return {
            success: completed.used,
            effect: completed.used ? toWildcardEffect(completed) : undefined,
          };
        },
      };
    },
  },
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

      const revealTarget = getBoardBlockTarget(target);
      return revealTarget !== undefined && session.canRevealIllusionBlock(revealTarget.blockId);
    },
    execute: ({ session, target }) => {
      const revealTarget = target === undefined ? undefined : getBoardBlockTarget(target);
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
  demagnetizer: {
    canUse: ({ session, target }) => {
      if (target === undefined) {
        return session.getDemagnetizerTargetBlockIds().length > 0;
      }

      const demagnetizerTarget = getBoardBlockTarget(target);
      return demagnetizerTarget !== undefined && session.canDemagnetizeMagneticBlock(
        demagnetizerTarget.blockId,
      );
    },
    execute: ({ session, target }) => {
      const demagnetizerTarget = target === undefined
        ? undefined
        : getBoardBlockTarget(target);
      if (
        demagnetizerTarget === undefined ||
        !session.canDemagnetizeMagneticBlock(demagnetizerTarget.blockId)
      ) {
        return { success: false, visualFeedback: "demagnetizer" };
      }

      return {
        success: true,
        visualFeedback: "demagnetizer",
        effect: {
          type: "demagnetize" as const,
          blockId: demagnetizerTarget.blockId,
        },
        commitAfterAnimation: () => {
          const completed = session.demagnetizeMagneticBlock(demagnetizerTarget.blockId);
          return {
            success: completed.demagnetized,
            effect: completed.demagnetized
              ? {
                  type: "demagnetize" as const,
                  blockId: completed.blockId,
                }
              : undefined,
          };
        },
      };
    },
  },
  key: {
    canUse: ({ session }) => session.canUnlockTraySlot(),
    execute: ({ session }) => {
      const unlocked = session.unlockTraySlot();
      if (!unlocked.unlocked || unlocked.unlockedSlotIndex === null) {
        return { success: false, visualFeedback: "key" };
      }

      return {
        success: true,
        visualFeedback: "key",
        effect: {
          type: "unlock" as const,
          unlockedSlotIndex: unlocked.unlockedSlotIndex,
        },
      };
    },
  },
};

function toWildcardEffect(
  resolution: GameSessionWildcardResolution,
): DogWildcardItemEffect {
  return {
    type: "wildcard",
    patternType: resolution.patternType,
    wildcardBlockId: resolution.wildcardBlockId,
    compensatedBlockId: resolution.compensatedBlockId,
    removedCount: resolution.removedCount,
    tripleCount: resolution.tripleCount,
    meltedBlockIds: resolution.meltedBlockIds,
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

  if (targetType === "tray-block") {
    return target.type === "tray-block";
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

function getBoardBlockTarget(
  target: DogItemTarget,
): { readonly blockId: string } | undefined {
  return target.type === "block" ? { blockId: target.blockId } : undefined;
}

function getTripleRemovalTarget(
  target: DogItemTarget | undefined,
): string | undefined {
  return target?.type === "tray-block" ? target.blockId : undefined;
}

function getWildcardTargetPattern(
  session: GameSession,
  target: DogItemTarget | undefined,
): DogPatternType | undefined {
  if (target?.type !== "tray-block") {
    return undefined;
  }

  return session.getState().trayBlocks.find(
    (block) => block.id === target.blockId,
  )?.patternType;
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
