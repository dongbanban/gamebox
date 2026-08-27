import type {
  DogSpecialMechanismHandler,
  DogPatternType,
  DogTrayBlock,
} from "@/games/dog-lege-dog/levels/level-types";
import {
  applyDogTraySuccessfulTripleEffects,
  insertDogBlockIntoTray,
  resolveDogTrayMatches,
} from "@/games/dog-lege-dog/levels/level-rules";
import { findSolvabilityFromState } from "@/games/dog-lege-dog/levels/level-solvability";
import {
  DOG_FREEZE_MECHANISM_TYPE,
} from "@/games/dog-lege-dog/game/special-mechanisms";
import type {
  GameSessionTripleRemovalPlan,
  GameSessionTripleRemovalResult,
  GameSessionWildcardPlan,
  GameSessionWildcardResolution,
  GameSessionWildcardResult,
} from "@/games/dog-lege-dog/game/game-session-contracts";
import {
  createFailedWildcardResult,
  createTripleRemovalResult,
  createWildcardResult,
} from "@/games/dog-lege-dog/game/game-session-results";
import {
  cloneTrayBlock,
  toTrayBlock,
  type GameSessionState,
} from "@/games/dog-lege-dog/game/game-session-state";

interface InternalWildcardPlan extends GameSessionWildcardPlan {
  readonly nextTray: readonly DogTrayBlock[];
  readonly wildcardSequence: number;
}

export class GameSessionTrayActions {
  private readonly tripleRemovalPlanCache = new Map<
    string,
    GameSessionTripleRemovalPlan | null
  >();
  private readonly wildcardPlanCache = new Map<
    DogPatternType,
    InternalWildcardPlan | null
  >();
  private wildcardSequence = 0;

  constructor(private readonly state: GameSessionState) {}

  clearCaches(): void {
    this.tripleRemovalPlanCache.clear();
    this.wildcardPlanCache.clear();
  }

  getWildcardPlan(patternType: DogPatternType): GameSessionWildcardPlan | null {
    if (this.wildcardPlanCache.has(patternType)) {
      return this.wildcardPlanCache.get(patternType) ?? null;
    }

    const plan = this.findWildcardPlan(patternType);
    this.wildcardPlanCache.set(patternType, plan);
    return plan;
  }

  getWildcardTargetBlockIds(): readonly string[] {
    return Object.freeze(
      this.state.tray
        .filter((block) => this.getWildcardPlan(block.patternType) !== null)
        .map((block) => block.id),
    );
  }

  useWildcard(patternType: DogPatternType): GameSessionWildcardResult {
    const plan = this.wildcardPlanCache.get(patternType) ?? this.findWildcardPlan(patternType);
    if (plan === null) {
      return createFailedWildcardResult(this.state.getState(), patternType);
    }

    const compensatedBlock = this.state.getBlock(plan.compensatedBlockId);
    const compensatedBlockIndex = this.state.graph.indexById.get(plan.compensatedBlockId);
    if (
      compensatedBlock === undefined ||
      compensatedBlockIndex === undefined ||
      compensatedBlock.patternType !== patternType ||
      compensatedBlock.specialMechanism?.type === DOG_FREEZE_MECHANISM_TYPE ||
      this.state.canSelectBlock(plan.compensatedBlockId)
    ) {
      this.clearCaches();
      return createFailedWildcardResult(this.state.getState(), patternType);
    }

    if (this.state.removeRemainingBlock(plan.compensatedBlockId) === undefined) {
      this.clearCaches();
      return createFailedWildcardResult(this.state.getState(), patternType);
    }
    this.state.tray.splice(0, this.state.tray.length, ...plan.nextTray.map(cloneTrayBlock));
    this.wildcardSequence = plan.wildcardSequence;
    this.clearCaches();
    this.state.updateResult();
    return createWildcardResult(this.state.getState(), plan);
  }

  getTripleRemovalTargetBlockIds(): readonly string[] {
    const targetBlockIds: string[] = [];
    for (let index = 0; index < this.state.tray.length - 1; index += 1) {
      const first = this.state.tray[index];
      const second = this.state.tray[index + 1];
      if (!isOrdinaryMatchingPair(first, second)) {
        continue;
      }

      const plan = this.getTripleRemovalPlanForTrayBlock(first.id);
      if (plan !== null) {
        targetBlockIds.push(...plan.trayBlockIds);
      }
    }
    return Object.freeze(targetBlockIds);
  }

  getTripleRemovalTargetPatterns(): readonly DogPatternType[] {
    const patterns: DogPatternType[] = [];
    for (let index = 0; index < this.state.tray.length - 1; index += 1) {
      const first = this.state.tray[index];
      const second = this.state.tray[index + 1];
      if (
        !isOrdinaryMatchingPair(first, second) ||
        patterns.includes(first.patternType) ||
        this.getTripleRemovalPlanForTrayBlock(first.id) === null
      ) {
        continue;
      }
      patterns.push(first.patternType);
    }
    return Object.freeze(patterns);
  }

  getTripleRemovalPlan(patternType: DogPatternType): GameSessionTripleRemovalPlan | null {
    for (let index = 0; index < this.state.tray.length - 1; index += 1) {
      const first = this.state.tray[index];
      const second = this.state.tray[index + 1];
      if (
        first?.patternType === patternType &&
        isOrdinaryMatchingPair(first, second)
      ) {
        const plan = this.getTripleRemovalPlanForTrayBlock(first.id);
        if (plan !== null) {
          return plan;
        }
      }
    }
    return null;
  }

  getTripleRemovalPlanForTrayBlock(blockId: string): GameSessionTripleRemovalPlan | null {
    let index = this.state.tray.findIndex((block) => block.id === blockId);
    let first = this.state.tray[index];
    let second = this.state.tray[index + 1];
    if (!isOrdinaryMatchingPair(first, second)) {
      index -= 1;
      first = this.state.tray[index];
      second = this.state.tray[index + 1];
    }
    if (!isOrdinaryMatchingPair(first, second)) {
      return null;
    }

    const cacheKey = `${first.id}:${second.id}`;
    if (this.tripleRemovalPlanCache.has(cacheKey)) {
      return this.tripleRemovalPlanCache.get(cacheKey) ?? null;
    }

    const plan = this.findTripleRemovalPlan([first.id, second.id]);
    this.tripleRemovalPlanCache.set(cacheKey, plan);
    return plan;
  }

  removeTriple(patternType: DogPatternType): GameSessionTripleRemovalResult {
    const plan = this.getTripleRemovalPlan(patternType);
    if (plan === null) {
      return this.failedTripleRemoval(patternType);
    }
    return this.removeTripleForTrayBlock(plan.trayBlockIds[0] ?? "");
  }

  removeTripleForTrayBlock(blockId: string): GameSessionTripleRemovalResult {
    const targetBlock = this.state.tray.find((block) => block.id === blockId);
    const fallbackPattern = targetBlock?.patternType ?? this.state.level.patternTypes[0]!;
    const plan = this.getTripleRemovalPlanForTrayBlock(blockId);
    if (plan === null) {
      return this.failedTripleRemoval(fallbackPattern);
    }

    const selectedBlocks = plan.blockIds.map((candidateBlockId) => {
      const block = this.state.getBlock(candidateBlockId);
      return block !== undefined &&
        block.specialMechanism === undefined &&
        this.state.canSelectBlock(candidateBlockId)
        ? block
        : undefined;
    });
    if (selectedBlocks.some((block) => block === undefined)) {
      this.clearCaches();
      return this.failedTripleRemoval(plan.patternType);
    }

    for (const block of selectedBlocks) {
      if (block === undefined || this.state.removeRemainingBlock(block.id) === undefined) {
        this.clearCaches();
        return this.failedTripleRemoval(plan.patternType);
      }
    }

    this.state.tray.splice(
      0,
      this.state.tray.length,
      ...this.state.tray.filter((block) => !plan.trayBlockIds.includes(block.id)),
    );
    const meltedBlockIds = applyDogTraySuccessfulTripleEffects(
      this.state.tray,
      this.state.specialMechanismHandlers,
      plan.tripleCount,
      [plan.patternType],
    );

    this.clearCaches();
    this.state.updateResult();
    return createTripleRemovalResult(
      this.state.getState(),
      true,
      plan.patternType,
      plan.blockIds,
      plan.removedCount,
      plan.tripleCount,
      meltedBlockIds,
      plan.trayBlockIds,
    );
  }

  private failedTripleRemoval(patternType: DogPatternType): GameSessionTripleRemovalResult {
    return createTripleRemovalResult(this.state.getState(), false, patternType, [], 0, 0, []);
  }

  private findWildcardPlan(patternType: DogPatternType): InternalWildcardPlan | null {
    if (
      this.state.status !== "playing" ||
      this.state.isSelectionPending() ||
      !this.state.level.patternTypes.includes(patternType) ||
      !this.state.tray.some((block) => block.patternType === patternType)
    ) {
      return null;
    }

    const compensatedCandidates = [...this.state.remainingBlocks.values()].filter(
      (block) =>
        block.patternType === patternType &&
        block.specialMechanism?.type !== DOG_FREEZE_MECHANISM_TYPE &&
        !this.state.canSelectBlock(block.id),
    );
    const solvabilityLevel = this.state.getCurrentSolvabilityLevel();
    const wildcardIdentity = this.getNextWildcardIdentity();
    for (const compensatedBlock of compensatedCandidates) {
      const nextTray = this.state.tray.map(cloneTrayBlock);
      const resolution = resolveWildcardTrayInsertion(
        nextTray,
        { id: wildcardIdentity.id, patternType, visualMarker: "wildcard" },
        this.state.specialMechanismHandlers,
      );
      const solvability = findSolvabilityFromState(solvabilityLevel, {
        remainingBlockIds: [...this.state.remainingBlocks.keys()].filter(
          (blockId) => blockId !== compensatedBlock.id,
        ),
        initialTray: nextTray,
        trayCapacity: this.state.getEffectiveTrayCapacity(),
        branchBudget: Math.max(64, this.state.remainingBlocks.size * 2),
        specialMechanismHandlers: [...this.state.specialMechanismHandlers.values()],
      });
      if (solvability.status !== "solvable") {
        continue;
      }

      return Object.freeze({
        patternType,
        wildcardBlockId: wildcardIdentity.id,
        compensatedBlockId: compensatedBlock.id,
        removedCount: resolution.removedCount,
        tripleCount: resolution.tripleCount,
        meltedBlockIds: Object.freeze([...resolution.meltedBlockIds]),
        nextTray: Object.freeze(nextTray.map(cloneTrayBlock)),
        wildcardSequence: wildcardIdentity.sequence,
      });
    }
    return null;
  }

  private getNextWildcardIdentity(): { readonly id: string; readonly sequence: number } {
    const currentIds = new Set([
      ...this.state.remainingBlocks.keys(),
      ...this.state.tray.map((block) => block.id),
    ]);
    let sequence = this.wildcardSequence + 1;
    while (currentIds.has(`wildcard-${sequence}`)) {
      sequence += 1;
    }
    return { id: `wildcard-${sequence}`, sequence };
  }

  private findTripleRemovalPlan(
    trayBlockIds: readonly [string, string],
  ): GameSessionTripleRemovalPlan | null {
    if (this.state.status !== "playing" || this.state.isSelectionPending()) {
      return null;
    }

    const [firstTrayBlockId, secondTrayBlockId] = trayBlockIds;
    const firstTrayBlockIndex = this.state.tray.findIndex((block) => block.id === firstTrayBlockId);
    const firstTrayBlock = this.state.tray[firstTrayBlockIndex];
    const secondTrayBlock = this.state.tray[firstTrayBlockIndex + 1];
    if (
      !isOrdinaryMatchingPair(firstTrayBlock, secondTrayBlock) ||
      firstTrayBlock.id !== firstTrayBlockId ||
      secondTrayBlock.id !== secondTrayBlockId
    ) {
      return null;
    }
    const patternType = firstTrayBlock.patternType;
    const candidates = [...this.state.remainingBlocks.values()].filter(
      (block) =>
        block.patternType === patternType &&
        block.specialMechanism === undefined &&
        this.state.canSelectBlock(block.id),
    );
    if (candidates.length === 0) {
      return null;
    }
    candidates.sort((first, second) => {
      const firstIndex = this.state.graph.indexById.get(first.id) ?? Number.MAX_SAFE_INTEGER;
      const secondIndex = this.state.graph.indexById.get(second.id) ?? Number.MAX_SAFE_INTEGER;
      return (
        this.state.graph.lowerBlockIndicesByHigher[secondIndex]!.length -
          this.state.graph.lowerBlockIndicesByHigher[firstIndex]!.length ||
        firstIndex - secondIndex
      );
    });

    const solvabilityLevel = this.state.getCurrentSolvabilityLevel();
    for (const candidate of candidates) {
      const simulatedTray = this.state.tray
        .filter((block) => !trayBlockIds.includes(block.id))
        .map(cloneTrayBlock);
      const solvability = findSolvabilityFromState(solvabilityLevel, {
        remainingBlockIds: [...this.state.remainingBlocks.keys()].filter(
          (blockId) => blockId !== candidate.id,
        ),
        initialTray: simulatedTray,
        trayCapacity: this.state.getEffectiveTrayCapacity(),
        branchBudget: Math.max(64, this.state.remainingBlocks.size * 2),
        specialMechanismHandlers: [...this.state.specialMechanismHandlers.values()],
      });
      if (solvability.status === "solvable") {
        return Object.freeze({
          patternType,
          trayBlockIds: Object.freeze([...trayBlockIds]),
          blockIds: Object.freeze([candidate.id]),
          removedCount: 3,
          tripleCount: 1,
        });
      }
    }
    return null;
  }
}

function resolveWildcardTrayInsertion(
  tray: DogTrayBlock[],
  wildcardBlock: DogTrayBlock,
  handlers: ReadonlyMap<string, DogSpecialMechanismHandler>,
): {
  readonly removedCount: number;
  readonly tripleCount: number;
  readonly meltedBlockIds: readonly string[];
} {
  const pairIndex = findWildcardSuffixPairIndex(tray, wildcardBlock.patternType);
  if (pairIndex < 0) {
    return insertDogBlockIntoTray(tray, wildcardBlock, handlers);
  }

  tray.splice(pairIndex, 2);
  const meltedBlockIds = applyDogTraySuccessfulTripleEffects(
    tray,
    handlers,
    1,
    [wildcardBlock.patternType],
  );
  const cascaded = resolveDogTrayMatches(tray, handlers);
  return {
    removedCount: 3 + cascaded.removedCount,
    tripleCount: 1 + cascaded.tripleCount,
    meltedBlockIds: Object.freeze([
      ...meltedBlockIds,
      ...cascaded.meltedBlockIds,
    ]),
  };
}

function findWildcardSuffixPairIndex(
  tray: readonly DogTrayBlock[],
  patternType: DogPatternType,
): number {
  const pairIndex = tray.length - 2;
  const first = tray[pairIndex];
  const second = tray[pairIndex + 1];
  return first?.patternType === patternType &&
    second?.patternType === patternType &&
    isWildcardMatchParticipant(first) &&
    isWildcardMatchParticipant(second)
    ? pairIndex
    : -1;
}

function isWildcardMatchParticipant(block: DogTrayBlock): boolean {
  return block.specialMechanism === undefined ||
    block.specialMechanism.type === DOG_FREEZE_MECHANISM_TYPE;
}

function isOrdinaryMatchingPair(
  first: DogTrayBlock | undefined,
  second: DogTrayBlock | undefined,
): first is DogTrayBlock {
  return first !== undefined &&
    second !== undefined &&
    first.specialMechanism === undefined &&
    second.specialMechanism === undefined &&
    first.patternType === second.patternType;
}
