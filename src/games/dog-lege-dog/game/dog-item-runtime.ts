import {
  GameSession,
  type GameSessionShuffleTransaction,
} from "@/games/dog-lege-dog/game/game-session";
import type {
  DogLegeDogLevel,
} from "@/games/dog-lege-dog/levels/level-types";
import {
  type DogItemId,
} from "@/games/dog-lege-dog/game/dog-loadout";
import {
  DOG_V13_CONFIG,
  getDogV13ItemUses,
  type DogV13Config,
} from "@/games/dog-lege-dog/game/v13-config";
import { SeededRandom } from "@/games/dog-lege-dog/levels/level-random";
import {
  createDogItemRuntimeDefinitions,
  DOG_ITEM_RUNTIME_DEFINITIONS,
} from "@/games/dog-lege-dog/game/dog-item-behaviors";
import { getDogItemUses, normalizeDogItemUses } from "@/games/dog-lege-dog/game/dog-item-quota";
import type {
  DogItemActionResult,
  DogItemAvailabilityContext,
  DogItemExecutionResult,
  DogItemRuntimeDefinition,
  DogItemRuntimeOptions,
  DogItemRuntimePhase,
  DogItemRuntimeSnapshot,
  DogItemState,
  DogItemTarget,
  DogKeyDropResult,
  DogItemEffect,
  DogItemAnimationCompletion,
} from "@/games/dog-lege-dog/game/dog-item-contracts";

export class DogItemRuntime {
  private readonly config: DogV13Config;
  private readonly level: DogLegeDogLevel;
  private readonly session: GameSession;
  private readonly loadout: readonly DogItemId[];
  private readonly definitions: ReadonlyMap<DogItemId, DogItemRuntimeDefinition>;
  private keyDropRandom: SeededRandom;
  private readonly maxUses = new Map<DogItemId, number>();
  private readonly remainingUses = new Map<DogItemId, number>();
  private phase: DogItemRuntimePhase = "idle";
  private selectedItemId: DogItemId | null = null;
  private visualFeedback: DogItemState["visualFeedback"] | null = null;
  private pendingAnimationCommit: (() => DogItemAnimationCompletion) | null = null;
  private pendingAnimationItemId: DogItemId | null = null;
  private completedEffect: DogItemEffect | null = null;
  private restoreCheckpoint: RestoreCheckpoint | null = null;

  constructor(options: DogItemRuntimeOptions) {
    this.config = options.config ?? DOG_V13_CONFIG;
    this.level = options.level;
    this.session = options.session;
    this.loadout = Object.freeze([...options.loadout]);
    this.keyDropRandom = new SeededRandom(`${options.level.runSeed}:key-drop`);
    this.definitions = new Map(
      (options.definitions ?? createDogItemRuntimeDefinitions(this.config)).map((definition) => [
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
        : normalizeDogItemUses(definition.getUses(this.level, this.config));
      this.maxUses.set(itemId, maxUses);
      this.remainingUses.set(
        itemId,
        itemId === "key" ? this.config.items.key.initialUses : maxUses,
      );
    }
  }

  getState(): DogItemRuntimeSnapshot {
    const tripleRemovalTargetBlockIds = this.session.getTripleRemovalTargetBlockIds();
    const wildcardTargetBlockIds = this.selectedItemId === "wildcard"
      ? this.session.getWildcardTargetBlockIds()
      : [];
    const demagnetizerTargetBlockIds = this.phase === "targeting" &&
        this.selectedItemId === "demagnetizer"
      ? this.session.getDemagnetizerTargetBlockIds()
      : [];
    const sessionState = this.session.getState();
    const items = this.loadout.map((itemId) => {
      const runtimeDefinition = this.getDefinition(itemId);
      const { definition } = runtimeDefinition;
      const maxUses = this.maxUses.get(itemId) ?? 0;
      const remainingUses = this.remainingUses.get(itemId) ?? 0;
      const available = this.phase === "idle" &&
        sessionState.status === "playing" &&
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
      selectedItemTargetType: this.selectedItemId === null
        ? null
        : this.getDefinition(this.selectedItemId).definition.targetType,
      visualFeedback: this.visualFeedback,
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
    const restoreTransaction = pendingAnimationItemId === "restore-whistle"
      ? this.session.getLastShuffleTransaction()
      : null;
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
          if (
            restoreTransaction !== null &&
            this.restoreCheckpoint?.transaction === restoreTransaction
          ) {
            this.remainingUses.set("key", this.restoreCheckpoint.keyUses);
            this.keyDropRandom = this.restoreCheckpoint.keyDropRandom.clone();
            this.restoreCheckpoint = null;
          }
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
    const restoreTransaction = this.session.getLastShuffleTransaction();
    if (
      restoreTransaction !== null &&
      tripleCount > 0 &&
      this.restoreCheckpoint?.transaction !== restoreTransaction
    ) {
      this.restoreCheckpoint = {
        transaction: restoreTransaction,
        keyUses: currentUses,
        keyDropRandom: this.keyDropRandom.clone(),
      };
    }
    const state = this.session.getState();
    const eligible = this.loadout.includes("key") &&
      Number.isSafeInteger(tripleCount) &&
      tripleCount > 0 &&
      state.status === "playing" &&
      state.lockedTraySlotCount > 0 &&
      state.remainingLogicalUnitCount > state.trayFreeCapacity &&
      currentUses < maxUses;
    const dropped = eligible && this.keyDropRandom.next() < this.config.items.key.dropRate;
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
        config: this.config,
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
        config: this.config,
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

interface RestoreCheckpoint {
  readonly transaction: GameSessionShuffleTransaction;
  readonly keyUses: number;
  readonly keyDropRandom: SeededRandom;
}

export {
  DOG_ITEM_RUNTIME_DEFINITIONS,
  getDogItemUses,
  getDogV13ItemUses,
};

export type {
  DogItemActionResult,
  DogItemAnimationCompletion,
  DogItemAvailabilityContext,
  DogItemEffect,
  DogItemExecutionContext,
  DogItemExecutionResult,
  DogItemRuntimeDefinition,
  DogItemRuntimeOptions,
  DogItemRuntimePhase,
  DogItemRuntimeSnapshot,
  DogItemState,
  DogItemTarget,
  DogKeyDropResult,
} from "@/games/dog-lege-dog/game/dog-item-contracts";

function matchesTargetType(
  targetType: import("@/games/dog-lege-dog/game/dog-loadout").DogItemTargetType,
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
