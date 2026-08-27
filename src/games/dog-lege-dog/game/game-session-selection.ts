import {
  type DogBlock,
  type DogPatternType,
} from "@/games/dog-lege-dog/levels/level-types";
import {
  insertDogBlockIntoTray,
  resolveDogTrayMatches,
} from "@/games/dog-lege-dog/levels/level-rules";
import {
  chooseDogMagneticTargetIndex,
  insertDogMagneticBlocks,
} from "@/games/dog-lege-dog/levels/level-mechanism-resolution";
import {
  DOG_MAGNETIC_MECHANISM_TYPE,
} from "@/games/dog-lege-dog/game/special-mechanisms";
import type {
  GameSessionMagneticResolution,
  GameSessionPendingSelectionResult,
  GameSessionSelectionResult,
  GameSessionSnapshot,
} from "@/games/dog-lege-dog/game/game-session-contracts";
import {
  createSelectionResult,
} from "@/games/dog-lege-dog/game/game-session-results";
import {
  removeSpecialMechanism,
  toTrayBlock,
  type GameSessionState,
} from "@/games/dog-lege-dog/game/game-session-state";

export class GameSessionSelectionRuntime {
  constructor(
    private readonly state: GameSessionState,
    private readonly getSnapshot: () => GameSessionSnapshot = () => this.state.getState(),
  ) {}

  selectBlock(blockId: string): GameSessionSelectionResult {
    if (!this.startBlockSelection(blockId)) {
      return createSelectionResult(this.getSnapshot(), false, 0);
    }

    return this.completeBlockSelection();
  }

  beginBlockSelection(blockId: string): GameSessionPendingSelectionResult {
    if (!this.startBlockSelection(blockId)) {
      return {
        selected: false,
        magneticResolution: null,
        snapshot: this.getSnapshot(),
      };
    }

    const pendingSelection = this.state.pendingSelection;
    return {
      selected: true,
      magneticResolution: pendingSelection === null
        ? null
        : createPendingMagneticResolution(pendingSelection),
      snapshot: this.getSnapshot(),
    };
  }

  completeBlockSelection(): GameSessionSelectionResult {
    const pendingSelection = this.state.pendingSelection;
    if (pendingSelection === null) {
      return createSelectionResult(this.getSnapshot(), false, 0);
    }

    if (pendingSelection.block.specialMechanism?.type === DOG_MAGNETIC_MECHANISM_TYPE) {
      this.completeMagneticEntry();
      return this.resolveMagneticEntry();
    }

    this.state.pendingSelection = null;
    const resolution = insertDogBlockIntoTray(
      this.state.tray,
      toTrayBlock(pendingSelection.block),
      this.state.specialMechanismHandlers,
      { allowFrozenFinalTriple: this.state.remainingBlocks.size === 0 },
    );
    this.state.updateResult();

    return createSelectionResult(
      this.getSnapshot(),
      true,
      resolution.removedCount,
      resolution.tripleCount,
      resolution.meltedBlockIds,
    );
  }

  completeMagneticEntry(): GameSessionMagneticResolution | null {
    const pendingSelection = this.state.pendingSelection;
    if (
      pendingSelection === null ||
      pendingSelection.block.specialMechanism?.type !== DOG_MAGNETIC_MECHANISM_TYPE
    ) {
      return null;
    }

    this.state.pendingSelection = null;
    const magneticResolution = this.enterMagneticBlocks(pendingSelection);
    this.state.pendingMagneticResolution = magneticResolution;
    return magneticResolution;
  }

  resolveMagneticEntry(): GameSessionSelectionResult {
    const magneticResolution = this.state.pendingMagneticResolution;
    if (magneticResolution === null) {
      return createSelectionResult(this.getSnapshot(), false, 0);
    }

    this.state.pendingMagneticResolution = null;
    const resolution = resolveDogTrayMatches(
      this.state.tray,
      this.state.specialMechanismHandlers,
      { allowFrozenFinalTriple: this.state.remainingBlocks.size === 0 },
    );
    this.state.updateResult();
    return createSelectionResult(
      this.getSnapshot(),
      true,
      resolution.removedCount,
      resolution.tripleCount,
      resolution.meltedBlockIds,
      magneticResolution,
    );
  }

  private startBlockSelection(blockId: string): boolean {
    if (!this.state.canSelectBlock(blockId)) {
      return false;
    }

    const block = this.state.getBlock(blockId);
    const blockIndex = this.state.graph.indexById.get(blockId);
    if (block === undefined || blockIndex === undefined) {
      return false;
    }

    const selectedBlock = this.state.removeRemainingBlock(blockId);
    if (selectedBlock === undefined) {
      return false;
    }
    const magneticTargetBlockId = selectedBlock.specialMechanism?.type === DOG_MAGNETIC_MECHANISM_TYPE
      ? this.chooseMagneticTarget(selectedBlock, blockIndex)
      : null;
    this.state.pendingSelection = {
      block: selectedBlock,
      magneticTargetBlockId,
    };
    return true;
  }

  private enterMagneticBlocks(
    pendingSelection: {
      readonly block: DogBlock;
      readonly magneticTargetBlockId: string | null;
    },
  ): GameSessionMagneticResolution {
    const magneticSource = removeSpecialMechanism(toTrayBlock(pendingSelection.block));
    const targetBlockId = pendingSelection.magneticTargetBlockId;
    const targetBlock = targetBlockId === null
      ? undefined
      : this.state.getBlock(targetBlockId);

    if (targetBlock !== undefined) {
      const removedTarget = this.state.removeRemainingBlock(targetBlock.id);
      if (removedTarget === undefined) {
        throw new Error(`狗了个狗 magnetic target block is missing: ${targetBlock.id}`);
      }
    }

    const targetTrayBlockIds = insertDogMagneticBlocks(
      this.state.tray,
      magneticSource,
      targetBlock === undefined ? undefined : toTrayBlock(targetBlock),
      this.state.specialMechanismHandlers,
    );

    return Object.freeze({
      sourceBlockId: pendingSelection.block.id,
      targetBlockId: targetBlock === undefined ? null : targetBlock.id,
      targetTrayBlockIds,
    });
  }

  private chooseMagneticTarget(sourceBlock: DogBlock, sourceBlockIndex: number): string | null {
    const targetBlockIndex = chooseDogMagneticTargetIndex(
      this.state.level,
      sourceBlockIndex,
      this.state.getRemainingBlockMask(),
      this.state.higherBlockCounts,
      this.state.magneticRandom,
    );
    return targetBlockIndex === null
      ? null
      : this.state.level.blocks[targetBlockIndex]?.id ?? null;
  }
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
