import type { DogPatternType } from "@/games/dog-lege-dog/levels/level-types";
import type {
  GameSession,
  GameSessionMeltLocation,
  GameSessionMeltResult,
  GameSessionWildcardResolution,
} from "@/games/dog-lege-dog/game/game-session";
import {
  DOG_ITEM_DEFINITIONS,
  getDogItemDefinition,
  type DogItemId,
} from "@/games/dog-lege-dog/game/dog-loadout";
import {
  DOG_V13_CONFIG,
  type DogV13Config,
} from "@/games/dog-lege-dog/game/v13-config";
import type {
  DogItemAnimationCompletion,
  DogItemAvailabilityContext,
  DogItemEffect,
  DogItemExecutionContext,
  DogItemExecutionResult,
  DogItemRuntimeDefinition,
  DogItemTarget,
} from "@/games/dog-lege-dog/game/dog-item-contracts";

interface DogItemBehavior {
  readonly canUse: (context: DogItemAvailabilityContext) => boolean;
  readonly execute: (context: DogItemExecutionContext) => DogItemExecutionResult;
}

const DOG_ITEM_BEHAVIORS: Readonly<Record<DogItemId, DogItemBehavior>> = {
  "triple-removal": {
    canUse: ({ session, target }) => {
      const targetBlockId = getTripleRemovalTarget(target);
      return targetBlockId === undefined
        ? session.getTripleRemovalTargetBlockIds().length > 0
        : session.getTripleRemovalPlanForTrayBlock(targetBlockId) !== null;
    },
    execute: ({ session, target }) => {
      const targetBlockId = getTripleRemovalTarget(target);
      const plan = targetBlockId === undefined
        ? null
        : session.getTripleRemovalPlanForTrayBlock(targetBlockId);
      if (plan === null) {
        return { success: false, visualFeedback: "triple-removal" };
      }

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
          const completed = session.removeTripleForTrayBlock(plan.trayBlockIds[0] ?? "");
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
          } satisfies DogItemAnimationCompletion;
        },
      };
    },
  },
  "tray-capacity": {
    canUse: ({ config, session }) =>
      session.getState().status === "playing" &&
      session.getState().trayCapacity < config.tray.maxCapacity,
    execute: ({ session }) => ({
      success: true,
      visualFeedback: "tray-capacity",
      commit: () => session.increaseTrayCapacity(),
    }),
  },
  wildcard: {
    canUse: ({ session, target }) => {
      const patternType = getWildcardTargetPattern(session, target);
      return patternType === undefined
        ? session.getWildcardTargetBlockIds().length > 0
        : session.getWildcardPlan(patternType) !== null;
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
      return meltTarget !== undefined &&
        session.canMeltFrozenBlock(meltTarget.blockId, meltTarget.location);
    },
    execute: ({ session, target }) => {
      const meltTarget = target === undefined ? undefined : getMeltTarget(target);
      if (meltTarget === undefined ||
        !session.canMeltFrozenBlock(meltTarget.blockId, meltTarget.location)) {
        return { success: false, visualFeedback: "torch" };
      }

      return {
        success: true,
        visualFeedback: "torch",
        effect: {
          type: "melt" as const,
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
            effect: completed.melted ? toMeltEffect(completed) : undefined,
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
        effect: { type: "reveal" as const, blockId: revealTarget.blockId },
        commitAfterAnimation: () => {
          const completed = session.revealIllusionBlock(revealTarget.blockId);
          return {
            success: completed.revealed,
            effect: completed.revealed
              ? { type: "reveal" as const, blockId: completed.blockId }
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
      return demagnetizerTarget !== undefined &&
        session.canDemagnetizeMagneticBlock(demagnetizerTarget.blockId);
    },
    execute: ({ session, target }) => {
      const demagnetizerTarget = target === undefined
        ? undefined
        : getBoardBlockTarget(target);
      if (demagnetizerTarget === undefined ||
        !session.canDemagnetizeMagneticBlock(demagnetizerTarget.blockId)) {
        return { success: false, visualFeedback: "demagnetizer" };
      }

      return {
        success: true,
        visualFeedback: "demagnetizer",
        effect: { type: "demagnetize" as const, blockId: demagnetizerTarget.blockId },
        commitAfterAnimation: () => {
          const completed = session.demagnetizeMagneticBlock(demagnetizerTarget.blockId);
          return {
            success: completed.demagnetized,
            effect: completed.demagnetized
              ? { type: "demagnetize" as const, blockId: completed.blockId }
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
        effect: { type: "unlock" as const, unlockedSlotIndex: unlocked.unlockedSlotIndex },
      };
    },
  },
  "restore-whistle": {
    canUse: ({ session }) => session.canRestoreLastShuffle(),
    execute: ({ session }) => ({
      success: session.canRestoreLastShuffle(),
      visualFeedback: "restore-whistle",
      effect: { type: "restore-shuffle" },
      commitAfterAnimation: () => ({
        success: session.restoreLastShuffle(),
        effect: { type: "restore-shuffle" },
      }),
    }),
  },
};

export function createDogItemRuntimeDefinitions(
  config: DogV13Config = DOG_V13_CONFIG,
): readonly DogItemRuntimeDefinition[] {
  return Object.freeze(
    DOG_ITEM_DEFINITIONS.map((baseDefinition) => {
      const definition = getDogItemDefinition(baseDefinition.id, config);
      return Object.freeze({
        definition,
        ...DOG_ITEM_BEHAVIORS[definition.id],
      });
    }),
  );
}

function toWildcardEffect(
  resolution: GameSessionWildcardResolution,
): Extract<DogItemEffect, { readonly type: "wildcard" }> {
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

function toMeltEffect(
  result: GameSessionMeltResult,
): Extract<DogItemEffect, { readonly type: "melt" }> {
  return {
    type: "melt",
    blockId: result.blockId,
    location: result.location,
    removedCount: result.removedCount,
    tripleCount: result.tripleCount,
    meltedBlockIds: result.meltedBlockIds,
  };
}

function hasMeltableFrozenBlock(session: GameSession): boolean {
  const state = session.getState();
  return state.remainingBlocks.some((block) => session.canMeltFrozenBlock(block.id, "board")) ||
    state.trayBlocks.some((block) => session.canMeltFrozenBlock(block.id, "tray"));
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
  return session.getState().trayBlocks.find((block) => block.id === target.blockId)?.patternType;
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
