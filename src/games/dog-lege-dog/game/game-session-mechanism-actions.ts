import type { DogTrayBlock } from "@/games/dog-lege-dog/levels/first-level";
import { resolveDogTrayMatches } from "@/games/dog-lege-dog/levels/level-rules";
import {
  DOG_FREEZE_MECHANISM_TYPE,
  DOG_ILLUSION_MECHANISM_TYPE,
  DOG_MAGNETIC_MECHANISM_TYPE,
} from "@/games/dog-lege-dog/game/special-mechanisms";
import type {
  GameSessionDemagnetizeResult,
  GameSessionMeltLocation,
  GameSessionMeltResult,
  GameSessionRevealResult,
} from "@/games/dog-lege-dog/game/game-session-contracts";
import {
  createDemagnetizeResult,
  createMeltResult,
  createRevealResult,
} from "@/games/dog-lege-dog/game/game-session-results";
import {
  removeSpecialMechanism,
  type GameSessionState,
} from "@/games/dog-lege-dog/game/game-session-state";

export class GameSessionMechanismActions {
  constructor(private readonly state: GameSessionState) {}

  getDemagnetizerTargetBlockIds(): readonly string[] {
    if (this.state.status !== "playing" || this.state.isSelectionPending()) {
      return Object.freeze([]);
    }

    return Object.freeze(
      [...this.state.remainingBlocks.values()]
        .filter((block) => this.canDemagnetizeMagneticBlock(block.id))
        .map((block) => block.id),
    );
  }

  canDemagnetizeMagneticBlock(blockId: string): boolean {
    if (
      this.state.status !== "playing" ||
      this.state.isSelectionPending() ||
      !this.state.canSelectBlock(blockId)
    ) {
      return false;
    }
    return this.state.getBlock(blockId)?.specialMechanism?.type === DOG_MAGNETIC_MECHANISM_TYPE;
  }

  demagnetizeMagneticBlock(blockId: string): GameSessionDemagnetizeResult {
    if (!this.canDemagnetizeMagneticBlock(blockId)) {
      return createDemagnetizeResult(this.state.getState(), false, blockId);
    }

    const block = this.state.getBlock(blockId);
    if (block === undefined) {
      return createDemagnetizeResult(this.state.getState(), false, blockId);
    }

    this.state.replaceRemainingBlock(blockId, removeSpecialMechanism(block));
    this.state.updateResult();
    return createDemagnetizeResult(this.state.getState(), true, blockId);
  }

  canMeltFrozenBlock(blockId: string, location: GameSessionMeltLocation): boolean {
    if (this.state.status !== "playing" || this.state.isSelectionPending()) {
      return false;
    }
    if (location === "board" && !this.state.canSelectBlock(blockId)) {
      return false;
    }

    const block = location === "board"
      ? this.state.getBlock(blockId)
      : this.state.tray.find((candidate) => candidate.id === blockId);
    return block?.specialMechanism?.type === DOG_FREEZE_MECHANISM_TYPE;
  }

  meltFrozenBlock(
    blockId: string,
    location: GameSessionMeltLocation,
  ): GameSessionMeltResult {
    if (!this.canMeltFrozenBlock(blockId, location)) {
      return createMeltResult(this.state.getState(), false, blockId, location, 0, 0, []);
    }

    if (location === "board") {
      const block = this.state.getBlock(blockId);
      if (block === undefined) {
        return createMeltResult(this.state.getState(), false, blockId, location, 0, 0, []);
      }

      this.state.replaceRemainingBlock(blockId, removeSpecialMechanism(block));
      this.state.updateResult();
      return createMeltResult(this.state.getState(), true, blockId, location, 0, 0, [blockId]);
    }

    const trayIndex = this.state.tray.findIndex((candidate) => candidate.id === blockId);
    const block = trayIndex < 0 ? undefined : this.state.tray[trayIndex];
    if (block === undefined) {
      return createMeltResult(this.state.getState(), false, blockId, location, 0, 0, []);
    }

    this.state.tray[trayIndex] = removeSpecialMechanism(block);
    const resolution = resolveDogTrayMatches(
      this.state.tray,
      this.state.specialMechanismHandlers,
    );
    this.state.updateResult();
    return createMeltResult(
      this.state.getState(),
      true,
      blockId,
      location,
      resolution.removedCount,
      resolution.tripleCount,
      [blockId, ...resolution.meltedBlockIds],
    );
  }

  canRevealIllusionBlock(blockId: string): boolean {
    return this.state.status === "playing" &&
      !this.state.isSelectionPending() &&
      this.state.canSelectBlock(blockId) &&
      this.state.getBlock(blockId)?.specialMechanism?.type === DOG_ILLUSION_MECHANISM_TYPE;
  }

  revealIllusionBlock(blockId: string): GameSessionRevealResult {
    if (!this.canRevealIllusionBlock(blockId)) {
      return createRevealResult(this.state.getState(), false, blockId);
    }

    const block = this.state.getBlock(blockId);
    if (block === undefined) {
      return createRevealResult(this.state.getState(), false, blockId);
    }

    this.state.replaceRemainingBlock(blockId, removeSpecialMechanism(block));
    this.state.updateResult();
    return createRevealResult(this.state.getState(), true, blockId);
  }
}
