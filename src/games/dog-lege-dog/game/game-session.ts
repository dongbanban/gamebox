import {
  type DogLegeDogLevel,
  type DogPatternType,
} from "@/games/dog-lege-dog/levels/level-types";
import { DOG_V13_CONFIG } from "@/games/dog-lege-dog/game/v13-config";
import { GameSessionMechanismActions } from "@/games/dog-lege-dog/game/game-session-mechanism-actions";
import { GameSessionSelectionRuntime } from "@/games/dog-lege-dog/game/game-session-selection";
import { GameSessionState } from "@/games/dog-lege-dog/game/game-session-state";
import { GameSessionTrayActions } from "@/games/dog-lege-dog/game/game-session-tray-actions";
import type {
  GameSessionDemagnetizeResult,
  GameSessionMeltLocation,
  GameSessionMeltResult,
  GameSessionPendingSelectionResult,
  GameSessionRevealResult,
  GameSessionSelectionResult,
  GameSessionSnapshot,
  GameSessionShuffleState,
  GameSessionTripleRemovalPlan,
  GameSessionTripleRemovalResult,
  GameSessionUnlockResult,
  GameSessionWildcardPlan,
  GameSessionWildcardResult,
  GameSessionOptions,
} from "@/games/dog-lege-dog/game/game-session-contracts";
import { createUnlockResult } from "@/games/dog-lege-dog/game/game-session-results";

export const GAME_SESSION_BASE_TRAY_CAPACITY = DOG_V13_CONFIG.tray.baseCapacity;
export const GAME_SESSION_TRAY_CAPACITY = GAME_SESSION_BASE_TRAY_CAPACITY;
export const GAME_SESSION_MAX_TRAY_CAPACITY = DOG_V13_CONFIG.tray.maxCapacity;

export class GameSession {
  private readonly state: GameSessionState;
  private readonly selection: GameSessionSelectionRuntime;
  private readonly trayActions: GameSessionTrayActions;
  private readonly mechanismActions: GameSessionMechanismActions;

  constructor(level: DogLegeDogLevel);
  constructor(options: GameSessionOptions);
  constructor(levelOrOptions: DogLegeDogLevel | GameSessionOptions) {
    const options = isLevel(levelOrOptions) ? { level: levelOrOptions } : levelOrOptions;
    this.state = new GameSessionState(options);
    this.selection = new GameSessionSelectionRuntime(this.state, () => this.getState());
    this.trayActions = new GameSessionTrayActions(this.state);
    this.mechanismActions = new GameSessionMechanismActions(this.state);
  }

  getState(): GameSessionSnapshot {
    return this.state.getState();
  }

  canSelectBlock(blockId: string): boolean {
    return this.state.canSelectBlock(blockId);
  }

  increaseTrayCapacity(): boolean {
    const increased = this.state.increaseTrayCapacity();
    if (increased) {
      this.trayActions.clearCaches();
    }
    return increased;
  }

  canUnlockTraySlot(): boolean {
    return this.state.canUnlockTraySlot();
  }

  unlockTraySlot(): GameSessionUnlockResult {
    const unlockedSlotIndex = this.state.unlockTraySlot();
    if (unlockedSlotIndex === null) {
      return createUnlockResult(this.state.getState(), false, null);
    }

    this.trayActions.clearCaches();
    return createUnlockResult(this.state.getState(), true, unlockedSlotIndex);
  }

  getWildcardPlan(patternType: DogPatternType): GameSessionWildcardPlan | null {
    return this.trayActions.getWildcardPlan(patternType);
  }

  getWildcardTargetBlockIds(): readonly string[] {
    return this.trayActions.getWildcardTargetBlockIds();
  }

  useWildcard(patternType: DogPatternType): GameSessionWildcardResult {
    return this.trayActions.useWildcard(patternType);
  }

  getTripleRemovalTargetBlockIds(): readonly string[] {
    return this.trayActions.getTripleRemovalTargetBlockIds();
  }

  getTripleRemovalTargetPatterns(): readonly DogPatternType[] {
    return this.trayActions.getTripleRemovalTargetPatterns();
  }

  getTripleRemovalPlan(patternType: DogPatternType): GameSessionTripleRemovalPlan | null {
    return this.trayActions.getTripleRemovalPlan(patternType);
  }

  getTripleRemovalPlanForTrayBlock(blockId: string): GameSessionTripleRemovalPlan | null {
    return this.trayActions.getTripleRemovalPlanForTrayBlock(blockId);
  }

  canRemoveTriple(patternType: DogPatternType): boolean {
    return this.getTripleRemovalPlan(patternType) !== null;
  }

  removeTriple(patternType: DogPatternType): GameSessionTripleRemovalResult {
    return this.trayActions.removeTriple(patternType);
  }

  removeTripleForTrayBlock(blockId: string): GameSessionTripleRemovalResult {
    return this.trayActions.removeTripleForTrayBlock(blockId);
  }

  canMeltFrozenBlock(blockId: string, location: GameSessionMeltLocation): boolean {
    return this.mechanismActions.canMeltFrozenBlock(blockId, location);
  }

  meltFrozenBlock(blockId: string, location: GameSessionMeltLocation): GameSessionMeltResult {
    const result = this.mechanismActions.meltFrozenBlock(blockId, location);
    this.trayActions.clearCaches();
    return result;
  }

  canRevealIllusionBlock(blockId: string): boolean {
    return this.mechanismActions.canRevealIllusionBlock(blockId);
  }

  revealIllusionBlock(blockId: string): GameSessionRevealResult {
    const result = this.mechanismActions.revealIllusionBlock(blockId);
    this.trayActions.clearCaches();
    return result;
  }

  getDemagnetizerTargetBlockIds(): readonly string[] {
    return this.mechanismActions.getDemagnetizerTargetBlockIds();
  }

  canDemagnetizeMagneticBlock(blockId: string): boolean {
    return this.mechanismActions.canDemagnetizeMagneticBlock(blockId);
  }

  demagnetizeMagneticBlock(blockId: string): GameSessionDemagnetizeResult {
    const result = this.mechanismActions.demagnetizeMagneticBlock(blockId);
    this.trayActions.clearCaches();
    return result;
  }

  selectBlock(blockId: string): GameSessionSelectionResult {
    const result = this.selection.selectBlock(blockId);
    this.trayActions.clearCaches();
    return result;
  }

  beginBlockSelection(blockId: string): GameSessionPendingSelectionResult {
    const result = this.selection.beginBlockSelection(blockId);
    this.trayActions.clearCaches();
    return result;
  }

  completeBlockSelection(): GameSessionSelectionResult {
    const result = this.selection.completeBlockSelection();
    this.trayActions.clearCaches();
    return result;
  }

  completeMagneticEntry(): ReturnType<GameSessionSelectionRuntime["completeMagneticEntry"]> {
    const result = this.selection.completeMagneticEntry();
    this.trayActions.clearCaches();
    return result;
  }

  resolveMagneticEntry(): GameSessionSelectionResult {
    const result = this.selection.resolveMagneticEntry();
    this.trayActions.clearCaches();
    return result;
  }
}

export type {
  GameSessionDemagnetizeResult,
  GameSessionMeltLocation,
  GameSessionMeltResult,
  GameSessionMagneticResolution,
  GameSessionOptions,
  GameSessionPendingSelectionResult,
  GameSessionSelectionResult,
  GameSessionSnapshot,
  GameSessionShuffleState,
  GameSessionStatus,
  GameSessionTripleRemovalPlan,
  GameSessionTripleRemovalResult,
  GameSessionUnlockResult,
  GameSessionWildcardPlan,
  GameSessionWildcardResolution,
  GameSessionWildcardResult,
} from "@/games/dog-lege-dog/game/game-session-contracts";

function isLevel(value: DogLegeDogLevel | GameSessionOptions): value is DogLegeDogLevel {
  return "blocks" in value;
}
