import {
  FIRST_LEVEL,
  type DogBlock,
  type DogLegeDogLevel,
  type DogPatternType,
  type DogSpecialMechanismHandler,
  type DogTrayBlock,
} from "@/games/dog-lege-dog/levels/first-level";
import { createBlockGraph, type BlockGraph } from "@/games/dog-lege-dog/levels/level-graph";
import { freezeDogLegeDogLevel } from "@/games/dog-lege-dog/levels/level-immutability";
import {
  applyDogTraySuccessfulTripleEffects,
  insertDogTrayBlock,
  insertDogBlockIntoTray,
  prepareDogTrayBlocks,
  resolveDogTrayMatches,
} from "@/games/dog-lege-dog/levels/level-rules";
import { findSolvabilityFromState } from "@/games/dog-lege-dog/levels/level-solvability";
import {
  createDogSpecialMechanismHandlerMap,
  DOG_SPECIAL_MECHANISM_HANDLERS,
  DOG_FREEZE_MECHANISM_TYPE,
  DOG_ILLUSION_MECHANISM_TYPE,
  DOG_MAGNETIC_MECHANISM_TYPE,
  DOG_TWIN_MECHANISM_TYPE,
  getDogLogicalBlockCount,
  getDogTrayLogicalUnitCount,
} from "@/games/dog-lege-dog/game/special-mechanisms";
import { SeededRandom } from "@/games/dog-lege-dog/levels/level-random";

export const GAME_SESSION_BASE_TRAY_CAPACITY = 7 as const;
export const GAME_SESSION_TRAY_CAPACITY = GAME_SESSION_BASE_TRAY_CAPACITY;
export const GAME_SESSION_MAX_TRAY_CAPACITY = 8 as const;

export type GameSessionStatus = "playing" | "won" | "lost";

export interface GameSessionOptions {
  readonly level?: DogLegeDogLevel;
  readonly initialTray?: readonly DogPatternType[];
  readonly initialTrayBlocks?: readonly DogTrayBlock[];
  readonly initialTrayCapacity?: number;
  readonly specialMechanismHandlers?: readonly DogSpecialMechanismHandler[];
}

export interface GameSessionSnapshot {
  readonly status: GameSessionStatus;
  readonly level: DogLegeDogLevel;
  readonly remainingBlocks: readonly DogBlock[];
  readonly tray: readonly DogPatternType[];
  readonly trayBlocks: readonly DogTrayBlock[];
  readonly trayCapacity: number;
  readonly remainingLogicalUnitCount: number;
  readonly trayLogicalUnitCount: number;
  readonly selectableBlockIds: readonly string[];
}

export interface GameSessionPendingSelectionResult {
  readonly selected: boolean;
  readonly magneticResolution: GameSessionMagneticResolution | null;
  readonly snapshot: GameSessionSnapshot;
}

export interface GameSessionMagneticResolution {
  readonly sourceBlockId: string;
  readonly targetBlockId: string | null;
  readonly targetTrayBlockIds: readonly string[];
}

export interface GameSessionSelectionResult extends GameSessionSnapshot {
  readonly magneticResolution: GameSessionMagneticResolution | null;
  readonly selected: boolean;
  readonly removedCount: number;
  readonly snapshot: GameSessionSnapshot;
  readonly tripleCount: number;
  readonly meltedBlockIds: readonly string[];
}

export type GameSessionMeltLocation = "board" | "tray";

export interface GameSessionMeltResult extends GameSessionSnapshot {
  readonly melted: boolean;
  readonly location: GameSessionMeltLocation;
  readonly blockId: string;
  readonly removedCount: number;
  readonly tripleCount: number;
  readonly meltedBlockIds: readonly string[];
  readonly snapshot: GameSessionSnapshot;
}

export interface GameSessionRevealResult extends GameSessionSnapshot {
  readonly revealed: boolean;
  readonly blockId: string;
  readonly snapshot: GameSessionSnapshot;
}

export interface GameSessionDemagnetizeResult extends GameSessionSnapshot {
  readonly demagnetized: boolean;
  readonly blockId: string;
  readonly snapshot: GameSessionSnapshot;
}

export interface GameSessionTripleRemovalPlan {
  readonly patternType: DogPatternType;
  readonly trayBlockIds: readonly string[];
  readonly blockIds: readonly string[];
  readonly removedCount: 3;
  readonly tripleCount: 1;
}

export interface GameSessionTripleRemovalResult extends GameSessionSnapshot {
  readonly removed: boolean;
  readonly patternType: DogPatternType;
  readonly trayBlockIds: readonly string[];
  readonly blockIds: readonly string[];
  readonly removedCount: number;
  readonly tripleCount: number;
  readonly meltedBlockIds: readonly string[];
  readonly snapshot: GameSessionSnapshot;
}

export interface GameSessionWildcardResolution {
  readonly patternType: DogPatternType;
  readonly wildcardBlockId: string;
  readonly compensatedBlockId: string;
  readonly removedCount: number;
  readonly tripleCount: number;
  readonly meltedBlockIds: readonly string[];
}

export type GameSessionWildcardPlan = GameSessionWildcardResolution;

interface GameSessionWildcardResultBase extends GameSessionSnapshot {
  readonly patternType: DogPatternType;
  readonly snapshot: GameSessionSnapshot;
}

export type GameSessionWildcardResult =
  | (GameSessionWildcardResultBase & { readonly used: false })
  | (GameSessionWildcardResultBase &
      GameSessionWildcardResolution & { readonly used: true });

interface InternalGameSessionWildcardPlan extends GameSessionWildcardPlan {
  readonly nextTray: readonly DogTrayBlock[];
  readonly wildcardSequence: number;
}

export class GameSession {
  private readonly level: DogLegeDogLevel;
  private readonly graph: BlockGraph;
  private readonly remainingBlocks = new Map<string, DogBlock>();
  private readonly higherBlockCounts: number[];
  private readonly specialMechanismHandlers: ReadonlyMap<string, DogSpecialMechanismHandler>;
  private readonly magneticRandom: SeededRandom;
  private tray: DogTrayBlock[];
  private pendingMagneticResolution: GameSessionMagneticResolution | null = null;
  private pendingSelection: {
    readonly block: DogBlock;
    readonly magneticTargetBlockId: string | null;
  } | null = null;
  private trayCapacity: number;
  private status: GameSessionStatus = "playing";
  private readonly tripleRemovalPlanCache = new Map<
    string,
    GameSessionTripleRemovalPlan | null
  >();
  private readonly wildcardPlanCache = new Map<
    DogPatternType,
    InternalGameSessionWildcardPlan | null
  >();
  private wildcardSequence = 0;

  constructor(level?: DogLegeDogLevel);
  constructor(options?: GameSessionOptions);
  constructor(levelOrOptions: DogLegeDogLevel | GameSessionOptions = FIRST_LEVEL) {
    const options = isLevel(levelOrOptions) ? { level: levelOrOptions } : levelOrOptions;
    this.level = freezeDogLegeDogLevel(options.level ?? FIRST_LEVEL);
    this.magneticRandom = new SeededRandom(`${this.level.runSeed}:magnetic-target`);
    this.graph = createBlockGraph(this.level.blocks);
    this.higherBlockCounts = [...this.graph.higherBlockCounts];
    this.specialMechanismHandlers = createDogSpecialMechanismHandlerMap(
      options.specialMechanismHandlers ?? DOG_SPECIAL_MECHANISM_HANDLERS,
    );
    this.trayCapacity = options.initialTrayCapacity ?? GAME_SESSION_BASE_TRAY_CAPACITY;
    if (
      !Number.isInteger(this.trayCapacity) ||
      this.trayCapacity < GAME_SESSION_BASE_TRAY_CAPACITY ||
      this.trayCapacity > GAME_SESSION_MAX_TRAY_CAPACITY
    ) {
      throw new Error("GameSession tray capacity must be an integer between 7 and 8");
    }
    for (const block of this.level.blocks) {
      if (
        block.specialMechanism !== undefined &&
        !this.specialMechanismHandlers.has(block.specialMechanism.type)
      ) {
        throw new Error(
          `狗了个狗 special mechanism handler is missing: ${block.specialMechanism.type}`,
        );
      }
    }
    if (options.initialTray !== undefined && options.initialTrayBlocks !== undefined) {
      throw new Error("GameSession cannot receive both initialTray and initialTrayBlocks");
    }
    if (
      options.initialTrayBlocks?.some(
        (block) => block.specialMechanism?.type === DOG_ILLUSION_MECHANISM_TYPE,
      )
    ) {
      throw new Error("GameSession illusion blocks cannot start in the tray");
    }
    this.tray = options.initialTrayBlocks === undefined
      ? (options.initialTray ?? []).map((patternType, index) => ({
          id: `initial-tray-${index + 1}`,
          patternType,
        }))
      : options.initialTrayBlocks.flatMap((block) =>
          prepareDogTrayBlocks({ ...block }, this.specialMechanismHandlers),
        );

    for (const block of this.level.blocks) {
      if (this.remainingBlocks.has(block.id)) {
        throw new Error(`Duplicate 狗了个狗 block id: ${block.id}`);
      }

      this.remainingBlocks.set(block.id, block);
    }

    resolveDogTrayMatches(this.tray, this.specialMechanismHandlers);
    if (getDogTrayLogicalUnitCount(this.tray) > this.trayCapacity) {
      throw new Error(`GameSession tray cannot contain more than ${this.trayCapacity} blocks`);
    }
    this.updateResult();
  }

  getState(): GameSessionSnapshot {
    const remainingBlocks = Object.freeze([...this.remainingBlocks.values()]);
    const trayBlocks = Object.freeze(
      this.getVisibleTrayBlocks().map(cloneTrayBlock),
    );

    return Object.freeze({
      status: this.status,
      level: this.level,
      remainingBlocks,
      tray: Object.freeze(trayBlocks.map((block) => block.patternType)),
      trayBlocks,
      trayCapacity: this.trayCapacity,
      remainingLogicalUnitCount: getDogLogicalBlockCount([...this.remainingBlocks.values()]),
      trayLogicalUnitCount: getDogTrayLogicalUnitCount(trayBlocks),
      selectableBlockIds: Object.freeze(this.getSelectableBlockIds()),
    });
  }

  canSelectBlock(blockId: string): boolean {
    if (this.status !== "playing" || this.isSelectionPending()) {
      return false;
    }

    const block = this.remainingBlocks.get(blockId);
    if (block === undefined) {
      return false;
    }

    const blockIndex = this.graph.indexById.get(blockId);
    return blockIndex !== undefined && this.higherBlockCounts[blockIndex] === 0;
  }

  increaseTrayCapacity(): boolean {
    if (
      this.status !== "playing" ||
      this.isSelectionPending() ||
      this.trayCapacity >= GAME_SESSION_MAX_TRAY_CAPACITY
    ) {
      return false;
    }

    this.trayCapacity += 1;
    this.clearItemPlanCaches();
    return true;
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
      this.tray
        .filter((block) => this.getWildcardPlan(block.patternType) !== null)
        .map((block) => block.id),
    );
  }

  useWildcard(patternType: DogPatternType): GameSessionWildcardResult {
    const plan = this.wildcardPlanCache.get(patternType) ?? this.findWildcardPlan(patternType);
    if (plan === null) {
      return this.createFailedWildcardResult(patternType);
    }

    const compensatedBlock = this.remainingBlocks.get(plan.compensatedBlockId);
    const compensatedBlockIndex = this.graph.indexById.get(plan.compensatedBlockId);
    if (
      compensatedBlock === undefined ||
      compensatedBlockIndex === undefined ||
      compensatedBlock.patternType !== patternType ||
      compensatedBlock.specialMechanism?.type === DOG_FREEZE_MECHANISM_TYPE ||
      this.canSelectBlock(plan.compensatedBlockId)
    ) {
      this.clearItemPlanCaches();
      return this.createFailedWildcardResult(patternType);
    }

    this.remainingBlocks.delete(plan.compensatedBlockId);
    for (const lowerBlockIndex of this.graph.lowerBlockIndicesByHigher[compensatedBlockIndex]) {
      this.higherBlockCounts[lowerBlockIndex] -= 1;
    }
    this.tray = plan.nextTray.map(cloneTrayBlock);
    this.wildcardSequence = plan.wildcardSequence;
    this.clearItemPlanCaches();
    this.updateResult();
    return this.createWildcardResult(plan);
  }

  getTripleRemovalTargetBlockIds(): readonly string[] {
    const targetBlockIds: string[] = [];
    for (let index = 0; index < this.tray.length - 1; index += 1) {
      const first = this.tray[index];
      const second = this.tray[index + 1];
      if (!isOrdinaryMatchingPair(first, second)) {
        continue;
      }

      const plan = this.getTripleRemovalPlanForTrayBlock(first.id);
      if (plan === null) {
        continue;
      }

      targetBlockIds.push(...plan.trayBlockIds);
    }

    return Object.freeze(targetBlockIds);
  }

  getTripleRemovalTargetPatterns(): readonly DogPatternType[] {
    const patterns: DogPatternType[] = [];
    for (let index = 0; index < this.tray.length - 1; index += 1) {
      const first = this.tray[index];
      const second = this.tray[index + 1];
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

  getTripleRemovalPlan(
    patternType: DogPatternType,
  ): GameSessionTripleRemovalPlan | null {
    for (let index = 0; index < this.tray.length - 1; index += 1) {
      const first = this.tray[index];
      const second = this.tray[index + 1];
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

  getTripleRemovalPlanForTrayBlock(
    blockId: string,
  ): GameSessionTripleRemovalPlan | null {
    let index = this.tray.findIndex((block) => block.id === blockId);
    let first = this.tray[index];
    let second = this.tray[index + 1];
    if (!isOrdinaryMatchingPair(first, second)) {
      index -= 1;
      first = this.tray[index];
      second = this.tray[index + 1];
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

  canRemoveTriple(patternType: DogPatternType): boolean {
    return this.getTripleRemovalPlan(patternType) !== null;
  }

  removeTriple(patternType: DogPatternType): GameSessionTripleRemovalResult {
    const plan = this.getTripleRemovalPlan(patternType);
    if (plan === null) {
      return this.createTripleRemovalResult(false, patternType, [], 0, 0, []);
    }

    return this.removeTripleForTrayBlock(plan.trayBlockIds[0] ?? "");
  }

  removeTripleForTrayBlock(blockId: string): GameSessionTripleRemovalResult {
    const targetBlock = this.tray.find((block) => block.id === blockId);
    const fallbackPattern = targetBlock?.patternType ?? this.level.patternTypes[0]!;
    const plan = this.getTripleRemovalPlanForTrayBlock(blockId);
    if (plan === null) {
      return this.createTripleRemovalResult(false, fallbackPattern, [], 0, 0, []);
    }

    const selectedBlocks = plan.blockIds.map((candidateBlockId) => {
      const block = this.remainingBlocks.get(candidateBlockId);
      if (
        block === undefined ||
        block.specialMechanism !== undefined ||
        !this.canSelectBlock(candidateBlockId)
      ) {
        return undefined;
      }
      return block;
    });
    if (selectedBlocks.some((block) => block === undefined)) {
      this.clearItemPlanCaches();
      return this.createTripleRemovalResult(false, plan.patternType, [], 0, 0, []);
    }

    for (const block of selectedBlocks) {
      if (block === undefined) {
        continue;
      }

      const blockIndex = this.graph.indexById.get(block.id);
      if (blockIndex === undefined) {
        this.clearItemPlanCaches();
        return this.createTripleRemovalResult(false, plan.patternType, [], 0, 0, []);
      }

      this.remainingBlocks.delete(block.id);
      for (const lowerBlockIndex of this.graph.lowerBlockIndicesByHigher[blockIndex]) {
        this.higherBlockCounts[lowerBlockIndex] -= 1;
      }
    }

    this.tray = this.tray.filter((block) => !plan.trayBlockIds.includes(block.id));
    const meltedBlockIds = applyDogTraySuccessfulTripleEffects(
      this.tray,
      this.specialMechanismHandlers,
      plan.tripleCount,
      [plan.patternType],
    );

    this.clearItemPlanCaches();
    this.updateResult();
    return this.createTripleRemovalResult(
      true,
      plan.patternType,
      plan.blockIds,
      plan.removedCount,
      plan.tripleCount,
      meltedBlockIds,
      plan.trayBlockIds,
    );
  }

  canMeltFrozenBlock(blockId: string, location: GameSessionMeltLocation): boolean {
    if (this.status !== "playing" || this.isSelectionPending()) {
      return false;
    }

    if (location === "board" && !this.canSelectBlock(blockId)) {
      return false;
    }

    const block = location === "board"
      ? this.remainingBlocks.get(blockId)
      : this.tray.find((candidate) => candidate.id === blockId);
    return block?.specialMechanism?.type === DOG_FREEZE_MECHANISM_TYPE;
  }

  canRevealIllusionBlock(blockId: string): boolean {
    if (this.status !== "playing" || this.isSelectionPending()) {
      return false;
    }

    if (!this.canSelectBlock(blockId)) {
      return false;
    }

    return this.remainingBlocks.get(blockId)?.specialMechanism?.type === DOG_ILLUSION_MECHANISM_TYPE;
  }

  revealIllusionBlock(blockId: string): GameSessionRevealResult {
    if (!this.canRevealIllusionBlock(blockId)) {
      return this.createRevealResult(false, blockId);
    }

    const block = this.remainingBlocks.get(blockId);
    if (block === undefined) {
      return this.createRevealResult(false, blockId);
    }

    this.remainingBlocks.set(blockId, removeSpecialMechanism(block));
    this.clearItemPlanCaches();
    this.updateResult();
    return this.createRevealResult(true, blockId);
  }

  getDemagnetizerTargetBlockIds(): readonly string[] {
    if (this.status !== "playing" || this.isSelectionPending()) {
      return Object.freeze([]);
    }

    return Object.freeze(
      [...this.remainingBlocks.values()]
        .filter((block) => this.canDemagnetizeMagneticBlock(block.id))
        .map((block) => block.id),
    );
  }

  canDemagnetizeMagneticBlock(blockId: string): boolean {
    if (this.status !== "playing" || this.isSelectionPending() || !this.canSelectBlock(blockId)) {
      return false;
    }

    return this.remainingBlocks.get(blockId)?.specialMechanism?.type === DOG_MAGNETIC_MECHANISM_TYPE;
  }

  demagnetizeMagneticBlock(blockId: string): GameSessionDemagnetizeResult {
    if (!this.canDemagnetizeMagneticBlock(blockId)) {
      return this.createDemagnetizeResult(false, blockId);
    }

    const block = this.remainingBlocks.get(blockId);
    if (block === undefined) {
      return this.createDemagnetizeResult(false, blockId);
    }

    this.remainingBlocks.set(blockId, removeSpecialMechanism(block));
    this.clearItemPlanCaches();
    this.updateResult();
    return this.createDemagnetizeResult(true, blockId);
  }

  meltFrozenBlock(
    blockId: string,
    location: GameSessionMeltLocation,
  ): GameSessionMeltResult {
    if (!this.canMeltFrozenBlock(blockId, location)) {
      return this.createMeltResult(false, blockId, location, 0, 0, []);
    }

    if (location === "board") {
      const block = this.remainingBlocks.get(blockId);
      if (block === undefined) {
        return this.createMeltResult(false, blockId, location, 0, 0, []);
      }

      this.remainingBlocks.set(blockId, removeSpecialMechanism(block));
      this.clearItemPlanCaches();
      this.updateResult();
      return this.createMeltResult(true, blockId, location, 0, 0, [blockId]);
    }

    const trayIndex = this.tray.findIndex((candidate) => candidate.id === blockId);
    const block = trayIndex < 0 ? undefined : this.tray[trayIndex];
    if (block === undefined) {
      return this.createMeltResult(false, blockId, location, 0, 0, []);
    }

    this.tray[trayIndex] = removeSpecialMechanism(block);
    const resolution = resolveDogTrayMatches(this.tray, this.specialMechanismHandlers);
    this.clearItemPlanCaches();
    this.updateResult();
    return this.createMeltResult(
      true,
      blockId,
      location,
      resolution.removedCount,
      resolution.tripleCount,
      [blockId, ...resolution.meltedBlockIds],
    );
  }

  selectBlock(blockId: string): GameSessionSelectionResult {
    if (!this.startBlockSelection(blockId)) {
      return this.createSelectionResult(false, 0);
    }

    return this.completeBlockSelection();
  }

  beginBlockSelection(blockId: string): GameSessionPendingSelectionResult {
    if (!this.startBlockSelection(blockId)) {
      return {
        selected: false,
        magneticResolution: null,
        snapshot: this.getState(),
      };
    }

    const pendingSelection = this.pendingSelection;
    return {
      selected: true,
      magneticResolution: pendingSelection === null
        ? null
        : createPendingMagneticResolution(pendingSelection),
      snapshot: this.getState(),
    };
  }

  completeBlockSelection(): GameSessionSelectionResult {
    const pendingSelection = this.pendingSelection;
    if (pendingSelection === null) {
      return this.createSelectionResult(false, 0);
    }

    if (pendingSelection.block.specialMechanism?.type === DOG_MAGNETIC_MECHANISM_TYPE) {
      this.completeMagneticEntry();
      return this.resolveMagneticEntry();
    }

    this.pendingSelection = null;
    const resolution = insertDogBlockIntoTray(
      this.tray,
      toTrayBlock(pendingSelection.block),
      this.specialMechanismHandlers,
      { allowFrozenFinalTriple: this.remainingBlocks.size === 0 },
    );
    this.clearItemPlanCaches();
    this.updateResult();

    return this.createSelectionResult(
      true,
      resolution.removedCount,
      resolution.tripleCount,
      resolution.meltedBlockIds,
    );
  }

  private getSelectableBlockIds(): string[] {
    if (this.status !== "playing" || this.isSelectionPending()) {
      return [];
    }

    return [...this.remainingBlocks.values()]
      .filter((block) => {
        const blockIndex = this.graph.indexById.get(block.id);
        return blockIndex !== undefined && this.higherBlockCounts[blockIndex] === 0;
      })
      .map((block) => block.id);
  }

  private startBlockSelection(blockId: string): boolean {
    if (!this.canSelectBlock(blockId)) {
      return false;
    }

    const block = this.remainingBlocks.get(blockId);
    const blockIndex = this.graph.indexById.get(blockId);
    if (block === undefined || blockIndex === undefined) {
      return false;
    }

    this.clearItemPlanCaches();
    this.remainingBlocks.delete(blockId);
    for (const lowerBlockIndex of this.graph.lowerBlockIndicesByHigher[blockIndex]) {
      this.higherBlockCounts[lowerBlockIndex] -= 1;
    }
    const magneticTargetBlockId = block.specialMechanism?.type === DOG_MAGNETIC_MECHANISM_TYPE
      ? this.chooseMagneticTarget(block)
      : null;
    this.pendingSelection = { block, magneticTargetBlockId };
    return true;
  }

  completeMagneticEntry(): GameSessionMagneticResolution | null {
    const pendingSelection = this.pendingSelection;
    if (
      pendingSelection === null ||
      pendingSelection.block.specialMechanism?.type !== DOG_MAGNETIC_MECHANISM_TYPE
    ) {
      return null;
    }

    this.pendingSelection = null;
    const magneticResolution = this.enterMagneticBlocks(pendingSelection);
    this.pendingMagneticResolution = magneticResolution;
    this.clearItemPlanCaches();
    return magneticResolution;
  }

  resolveMagneticEntry(): GameSessionSelectionResult {
    const magneticResolution = this.pendingMagneticResolution;
    if (magneticResolution === null) {
      return this.createSelectionResult(false, 0);
    }

    this.pendingMagneticResolution = null;
    const resolution = resolveDogTrayMatches(this.tray, this.specialMechanismHandlers, {
      allowFrozenFinalTriple: this.remainingBlocks.size === 0,
    });
    this.clearItemPlanCaches();
    this.updateResult();
    return this.createSelectionResult(
      true,
      resolution.removedCount,
      resolution.tripleCount,
      resolution.meltedBlockIds,
      magneticResolution,
    );
  }

  private enterMagneticBlocks(pendingSelection: {
    readonly block: DogBlock;
    readonly magneticTargetBlockId: string | null;
  }): GameSessionMagneticResolution {
    const magneticSource = removeSpecialMechanism(toTrayBlock(pendingSelection.block));
    insertDogTrayBlock(this.tray, magneticSource);
    const targetTrayBlockIds: string[] = [];
    const targetBlockId = pendingSelection.magneticTargetBlockId;
    const targetBlock = targetBlockId === null
      ? undefined
      : this.remainingBlocks.get(targetBlockId);

    if (targetBlock !== undefined) {
      const targetBlockIndex = this.graph.indexById.get(targetBlock.id);
      if (targetBlockIndex === undefined) {
        throw new Error(`狗了个狗 magnetic target block is missing from graph: ${targetBlock.id}`);
      }

      this.remainingBlocks.delete(targetBlock.id);
      for (const lowerBlockIndex of this.graph.lowerBlockIndicesByHigher[targetBlockIndex]) {
        this.higherBlockCounts[lowerBlockIndex] -= 1;
      }

      const preparedTargetBlocks = prepareDogTrayBlocks(
        toTrayBlock(targetBlock),
        this.specialMechanismHandlers,
      );
      for (const preparedTargetBlock of preparedTargetBlocks) {
        insertDogTrayBlock(this.tray, preparedTargetBlock);
        targetTrayBlockIds.push(preparedTargetBlock.id);
      }
    }

    return Object.freeze({
      sourceBlockId: pendingSelection.block.id,
      targetBlockId: targetBlock === undefined ? null : targetBlock.id,
      targetTrayBlockIds: Object.freeze([...targetTrayBlockIds]),
    });
  }

  private chooseMagneticTarget(sourceBlock: DogBlock): string | null {
    const candidates = [...this.remainingBlocks.values()].filter(
      (block) =>
        block.specialMechanism?.type !== DOG_MAGNETIC_MECHANISM_TYPE &&
        block.patternType !== sourceBlock.patternType,
    );
    if (candidates.length === 0) {
      return null;
    }

    const selectableCandidates = candidates.filter((block) => this.canSelectBlock(block.id));
    const candidatePool = selectableCandidates.length > 0 ? selectableCandidates : candidates;
    return candidatePool[this.magneticRandom.nextInt(candidatePool.length)]?.id ?? null;
  }

  private createSelectionResult(
    selected: boolean,
    removedCount: number,
    tripleCount = 0,
    meltedBlockIds: readonly string[] = [],
    magneticResolution: GameSessionMagneticResolution | null = null,
  ): GameSessionSelectionResult {
    const snapshot = this.getState();
    const result = {
      ...snapshot,
    } as GameSessionSelectionResult;
    Object.defineProperties(result, {
      magneticResolution: {
        configurable: false,
        enumerable: false,
        value: magneticResolution,
        writable: false,
      },
      selected: {
        configurable: false,
        enumerable: false,
        value: selected,
        writable: false,
      },
      removedCount: {
        configurable: false,
        enumerable: false,
        value: removedCount,
        writable: false,
      },
      tripleCount: {
        configurable: false,
        enumerable: false,
        value: tripleCount,
        writable: false,
      },
      meltedBlockIds: {
        configurable: false,
        enumerable: false,
        value: Object.freeze([...meltedBlockIds]),
        writable: false,
      },
      snapshot: {
        configurable: false,
        enumerable: false,
        value: snapshot,
        writable: false,
      },
    });
    return Object.freeze(result);
  }

  private createTripleRemovalResult(
    removed: boolean,
    patternType: DogPatternType,
    blockIds: readonly string[],
    removedCount: number,
    tripleCount: number,
    meltedBlockIds: readonly string[],
    trayBlockIds: readonly string[] = [],
  ): GameSessionTripleRemovalResult {
    const snapshot = this.getState();
    const result = {
      ...snapshot,
    } as GameSessionTripleRemovalResult;
    Object.defineProperties(result, {
      removed: {
        configurable: false,
        enumerable: false,
        value: removed,
        writable: false,
      },
      patternType: {
        configurable: false,
        enumerable: false,
        value: patternType,
        writable: false,
      },
      trayBlockIds: {
        configurable: false,
        enumerable: false,
        value: Object.freeze([...trayBlockIds]),
        writable: false,
      },
      blockIds: {
        configurable: false,
        enumerable: false,
        value: Object.freeze([...blockIds]),
        writable: false,
      },
      removedCount: {
        configurable: false,
        enumerable: false,
        value: removedCount,
        writable: false,
      },
      tripleCount: {
        configurable: false,
        enumerable: false,
        value: tripleCount,
        writable: false,
      },
      meltedBlockIds: {
        configurable: false,
        enumerable: false,
        value: Object.freeze([...meltedBlockIds]),
        writable: false,
      },
      snapshot: {
        configurable: false,
        enumerable: false,
        value: snapshot,
        writable: false,
      },
    });
    return Object.freeze(result);
  }

  private findWildcardPlan(
    patternType: DogPatternType,
  ): InternalGameSessionWildcardPlan | null {
    if (
      this.status !== "playing" ||
      this.isSelectionPending() ||
      !this.level.patternTypes.includes(patternType) ||
      !this.tray.some((block) => block.patternType === patternType)
    ) {
      return null;
    }

    const compensatedCandidates = [...this.remainingBlocks.values()].filter(
      (block) =>
        block.patternType === patternType &&
        block.specialMechanism?.type !== DOG_FREEZE_MECHANISM_TYPE &&
        !this.canSelectBlock(block.id),
    );
    const solvabilityLevel = this.createCurrentSolvabilityLevel();
    const wildcardIdentity = this.getNextWildcardIdentity();
    for (const compensatedBlock of compensatedCandidates) {
      const nextTray = this.tray.map(cloneTrayBlock);
      const resolution = resolveWildcardTrayInsertion(
        nextTray,
        {
          id: wildcardIdentity.id,
          patternType,
          visualMarker: "wildcard",
        },
        this.specialMechanismHandlers,
      );
      const solvability = findSolvabilityFromState(solvabilityLevel, {
        remainingBlockIds: [...this.remainingBlocks.keys()].filter(
          (blockId) => blockId !== compensatedBlock.id,
        ),
        initialTray: nextTray,
        trayCapacity: this.trayCapacity,
        branchBudget: Math.max(64, this.remainingBlocks.size * 2),
        specialMechanismHandlers: [...this.specialMechanismHandlers.values()],
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
      ...this.remainingBlocks.keys(),
      ...this.tray.map((block) => block.id),
    ]);
    let sequence = this.wildcardSequence + 1;
    while (currentIds.has(`wildcard-${sequence}`)) {
      sequence += 1;
    }
    return { id: `wildcard-${sequence}`, sequence };
  }

  private createWildcardResult(
    resolution: GameSessionWildcardResolution,
  ): GameSessionWildcardResult {
    const snapshot = this.getState();
    const result = {
      ...snapshot,
    } as GameSessionWildcardResult;
    Object.defineProperties(result, {
      used: { configurable: false, enumerable: false, value: true, writable: false },
      patternType: {
        configurable: false,
        enumerable: false,
        value: resolution.patternType,
        writable: false,
      },
      wildcardBlockId: {
        configurable: false,
        enumerable: false,
        value: resolution.wildcardBlockId,
        writable: false,
      },
      compensatedBlockId: {
        configurable: false,
        enumerable: false,
        value: resolution.compensatedBlockId,
        writable: false,
      },
      removedCount: {
        configurable: false,
        enumerable: false,
        value: resolution.removedCount,
        writable: false,
      },
      tripleCount: {
        configurable: false,
        enumerable: false,
        value: resolution.tripleCount,
        writable: false,
      },
      meltedBlockIds: {
        configurable: false,
        enumerable: false,
        value: Object.freeze([...resolution.meltedBlockIds]),
        writable: false,
      },
      snapshot: {
        configurable: false,
        enumerable: false,
        value: snapshot,
        writable: false,
      },
    });
    return Object.freeze(result);
  }

  private createFailedWildcardResult(
    patternType: DogPatternType,
  ): GameSessionWildcardResult {
    const snapshot = this.getState();
    const result = {
      ...snapshot,
    } as GameSessionWildcardResult;
    Object.defineProperties(result, {
      used: { configurable: false, enumerable: false, value: false, writable: false },
      patternType: {
        configurable: false,
        enumerable: false,
        value: patternType,
        writable: false,
      },
      snapshot: {
        configurable: false,
        enumerable: false,
        value: snapshot,
        writable: false,
      },
    });
    return Object.freeze(result);
  }

  private clearItemPlanCaches(): void {
    this.tripleRemovalPlanCache.clear();
    this.wildcardPlanCache.clear();
  }

  private createCurrentSolvabilityLevel(): DogLegeDogLevel {
    return {
      ...this.level,
      blocks: this.level.blocks.map(
        (block) => this.remainingBlocks.get(block.id) ?? block,
      ),
    };
  }

  private findTripleRemovalPlan(
    trayBlockIds: readonly [string, string],
  ): GameSessionTripleRemovalPlan | null {
    if (this.status !== "playing" || this.isSelectionPending()) {
      return null;
    }

    const [firstTrayBlockId, secondTrayBlockId] = trayBlockIds;
    const firstTrayBlockIndex = this.tray.findIndex((block) => block.id === firstTrayBlockId);
    const firstTrayBlock = this.tray[firstTrayBlockIndex];
    const secondTrayBlock = this.tray[firstTrayBlockIndex + 1];
    if (
      !isOrdinaryMatchingPair(firstTrayBlock, secondTrayBlock) ||
      firstTrayBlock.id !== firstTrayBlockId ||
      secondTrayBlock.id !== secondTrayBlockId
    ) {
      return null;
    }
    const patternType = firstTrayBlock.patternType;

    const candidates = [...this.remainingBlocks.values()].filter(
      (block) =>
        block.patternType === patternType &&
        block.specialMechanism === undefined &&
        this.canSelectBlock(block.id),
    );
    if (candidates.length === 0) {
      return null;
    }
    candidates.sort((first, second) => {
      const firstIndex = this.graph.indexById.get(first.id) ?? Number.MAX_SAFE_INTEGER;
      const secondIndex = this.graph.indexById.get(second.id) ?? Number.MAX_SAFE_INTEGER;
      return (
        this.graph.lowerBlockIndicesByHigher[secondIndex]!.length -
          this.graph.lowerBlockIndicesByHigher[firstIndex]!.length ||
        firstIndex - secondIndex
      );
    });

    const solvabilityLevel = this.createCurrentSolvabilityLevel();
    for (const candidate of candidates) {
      const candidateIdSet = new Set([candidate.id]);
      const simulatedTray = this.tray
        .filter((block) => !trayBlockIds.includes(block.id))
        .map(cloneTrayBlock);
      const solvability = findSolvabilityFromState(solvabilityLevel, {
        remainingBlockIds: [...this.remainingBlocks.keys()].filter(
          (blockId) => !candidateIdSet.has(blockId),
        ),
        initialTray: simulatedTray,
        trayCapacity: this.trayCapacity,
        branchBudget: Math.max(64, this.remainingBlocks.size * 2),
        specialMechanismHandlers: [...this.specialMechanismHandlers.values()],
      });
      if (solvability.status !== "solvable") {
        continue;
      }

      return Object.freeze({
        patternType,
        trayBlockIds: Object.freeze([...trayBlockIds]),
        blockIds: Object.freeze([candidate.id]),
        removedCount: 3,
        tripleCount: 1,
      });
    }

    return null;
  }

  private createMeltResult(
    melted: boolean,
    blockId: string,
    location: GameSessionMeltLocation,
    removedCount: number,
    tripleCount: number,
    meltedBlockIds: readonly string[],
  ): GameSessionMeltResult {
    const snapshot = this.getState();
    const result = {
      ...snapshot,
    } as GameSessionMeltResult;
    Object.defineProperties(result, {
      melted: {
        configurable: false,
        enumerable: false,
        value: melted,
        writable: false,
      },
      location: {
        configurable: false,
        enumerable: false,
        value: location,
        writable: false,
      },
      blockId: {
        configurable: false,
        enumerable: false,
        value: blockId,
        writable: false,
      },
      removedCount: {
        configurable: false,
        enumerable: false,
        value: removedCount,
        writable: false,
      },
      tripleCount: {
        configurable: false,
        enumerable: false,
        value: tripleCount,
        writable: false,
      },
      meltedBlockIds: {
        configurable: false,
        enumerable: false,
        value: Object.freeze([...meltedBlockIds]),
        writable: false,
      },
      snapshot: {
        configurable: false,
        enumerable: false,
        value: snapshot,
        writable: false,
      },
    });
    return Object.freeze(result);
  }

  private createRevealResult(
    revealed: boolean,
    blockId: string,
  ): GameSessionRevealResult {
    const snapshot = this.getState();
    const result = {
      ...snapshot,
    } as GameSessionRevealResult;
    Object.defineProperties(result, {
      revealed: {
        configurable: false,
        enumerable: false,
        value: revealed,
        writable: false,
      },
      blockId: {
        configurable: false,
        enumerable: false,
        value: blockId,
        writable: false,
      },
      snapshot: {
        configurable: false,
        enumerable: false,
        value: snapshot,
        writable: false,
      },
    });
    return Object.freeze(result);
  }

  private createDemagnetizeResult(
    demagnetized: boolean,
    blockId: string,
  ): GameSessionDemagnetizeResult {
    const snapshot = this.getState();
    const result = {
      ...snapshot,
    } as GameSessionDemagnetizeResult;
    Object.defineProperties(result, {
      demagnetized: {
        configurable: false,
        enumerable: false,
        value: demagnetized,
        writable: false,
      },
      blockId: {
        configurable: false,
        enumerable: false,
        value: blockId,
        writable: false,
      },
      snapshot: {
        configurable: false,
        enumerable: false,
        value: snapshot,
        writable: false,
      },
    });
    return Object.freeze(result);
  }

  private updateResult(): void {
    if (this.isSelectionPending()) {
      this.status = "playing";
      return;
    }

    const trayLogicalUnitCount = getDogTrayLogicalUnitCount(this.tray);
    if (trayLogicalUnitCount > this.trayCapacity) {
      this.status = "lost";
      return;
    }

    if (
      this.remainingBlocks.size === 0 &&
      this.tray.every((block) => block.specialMechanism === undefined)
    ) {
      this.status = "won";
      return;
    }

    if (trayLogicalUnitCount >= this.trayCapacity) {
      this.status = "lost";
    }
  }

  private getVisibleTrayBlocks(): DogTrayBlock[] {
    const trayBlocks = [...this.tray];
    if (this.pendingSelection === null) {
      return trayBlocks;
    }

    const pendingBlock = toTrayBlock(this.pendingSelection.block);
    if (pendingBlock.specialMechanism?.type === DOG_TWIN_MECHANISM_TYPE) {
      trayBlocks.push(...prepareDogTrayBlocks(pendingBlock, this.specialMechanismHandlers));
    } else {
      insertDogTrayBlock(trayBlocks, pendingBlock);
    }
    return trayBlocks;
  }

  private isSelectionPending(): boolean {
    return this.pendingSelection !== null || this.pendingMagneticResolution !== null;
  }
}

function cloneTrayBlock(block: DogTrayBlock): DogTrayBlock {
  if (block.specialMechanism === undefined) {
    return Object.freeze({ ...block });
  }

  return Object.freeze({
    ...block,
    specialMechanism: Object.freeze({
      ...block.specialMechanism,
      state: Object.freeze({ ...block.specialMechanism.state }),
    }),
  });
}

function toTrayBlock(block: DogBlock): DogTrayBlock {
  return {
    id: block.id,
    patternType: block.patternType,
    ...(block.specialMechanism === undefined
      ? {}
      : { specialMechanism: block.specialMechanism }),
  };
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

function removeSpecialMechanism<T extends DogBlock | DogTrayBlock>(block: T): T {
  const { specialMechanism: _specialMechanism, ...meltedBlock } = block;
  return meltedBlock as T;
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
  return (
    first?.patternType === patternType &&
    second?.patternType === patternType &&
    isWildcardMatchParticipant(first) &&
    isWildcardMatchParticipant(second)
  )
    ? pairIndex
    : -1;
}

function isWildcardMatchParticipant(block: DogTrayBlock): boolean {
  return block.specialMechanism === undefined || isFrozenTrayBlock(block);
}

function isFrozenTrayBlock(block: DogTrayBlock): boolean {
  return block.specialMechanism?.type === DOG_FREEZE_MECHANISM_TYPE;
}

function createPendingMagneticResolution(pendingSelection: {
  readonly block: DogBlock;
  readonly magneticTargetBlockId: string | null;
}): GameSessionMagneticResolution | null {
  if (pendingSelection.block.specialMechanism?.type !== DOG_MAGNETIC_MECHANISM_TYPE) {
    return null;
  }

  return Object.freeze({
    sourceBlockId: pendingSelection.block.id,
    targetBlockId: pendingSelection.magneticTargetBlockId,
    targetTrayBlockIds: Object.freeze([]),
  });
}

function isLevel(value: DogLegeDogLevel | GameSessionOptions): value is DogLegeDogLevel {
  return "blocks" in value;
}
