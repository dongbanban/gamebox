import type { GameResult } from "@/catalog";
import { ProgressStore } from "@/progress-store";
import {
  areDogLoadoutsEqual,
  isDogItemId,
  isValidDogLoadout,
  type DogItemId,
} from "@/games/dog-lege-dog/game/dog-loadout";
import {
  DOG_GAME_ID,
  DOG_V13_CONFIG,
  type DogV13Config,
} from "@/games/dog-lege-dog/game/game-config";
import { renderResultLoadoutEditor } from "@/app/app-views";

export interface ResultLoadoutControllerOptions {
  readonly root: HTMLElement;
  readonly store: ProgressStore;
  readonly getResult: () => GameResult | null;
  readonly getResultRunSeed: () => string | undefined;
  readonly config?: DogV13Config;
  readonly onApplied: (result: GameResult, runSeed: string | undefined) => void;
}

export class ResultLoadoutController {
  private readonly root: HTMLElement;
  private readonly store: ProgressStore;
  private readonly getResult: () => GameResult | null;
  private readonly getResultRunSeed: () => string | undefined;
  private readonly config: DogV13Config;
  private readonly onApplied: (result: GameResult, runSeed: string | undefined) => void;
  private draft: readonly DogItemId[] = [];
  private confirming = false;

  constructor(options: ResultLoadoutControllerOptions) {
    this.root = options.root;
    this.store = options.store;
    this.getResult = options.getResult;
    this.getResultRunSeed = options.getResultRunSeed;
    this.config = options.config ?? DOG_V13_CONFIG;
    this.onApplied = options.onApplied;
  }

  reset(): void {
    this.draft = [];
    this.confirming = false;
  }

  open(): void {
    const result = this.getResult();
    const loadout = result?.gameId === DOG_GAME_ID
      ? this.store.snapshot().state?.games[DOG_GAME_ID]?.loadout
      : null;
    if (
      result === null ||
      result.gameId !== DOG_GAME_ID ||
      !isValidDogLoadout(loadout, this.config.items.loadoutSize)
    ) {
      return;
    }

    this.draft = [...loadout];
    this.confirming = false;
    this.render();
  }

  toggle(itemId: string | undefined): void {
    if (this.getResult() === null || itemId === undefined || !isDogItemId(itemId)) {
      return;
    }

    this.draft = this.draft.includes(itemId)
      ? this.draft.filter((selectedItemId) => selectedItemId !== itemId)
      : this.draft.length < this.config.items.loadoutSize
        ? [...this.draft, itemId]
        : this.draft;
    this.confirming = false;
    this.render();
  }

  close(): void {
    this.root.querySelector('[data-testid="dog-result-loadout-editor"]')?.remove();
    this.reset();
  }

  requestConfirmation(): void {
    const current = this.getCurrentLoadout();
    if (
      !isValidDogLoadout(current, this.config.items.loadoutSize) ||
      !isValidDogLoadout(this.draft, this.config.items.loadoutSize)
    ) {
      return;
    }

    if (areDogLoadoutsEqual(current, this.draft, this.config.items.loadoutSize)) {
      this.close();
      return;
    }

    this.confirming = true;
    this.render();
  }

  cancelConfirmation(): void {
    this.confirming = false;
    this.render();
  }

  apply(): void {
    const result = this.getResult();
    const current = this.getCurrentLoadout();
    if (
      result === null ||
      result.gameId !== DOG_GAME_ID ||
      !this.confirming ||
      !isValidDogLoadout(current, this.config.items.loadoutSize) ||
      !isValidDogLoadout(this.draft, this.config.items.loadoutSize) ||
      areDogLoadoutsEqual(current, this.draft, this.config.items.loadoutSize)
    ) {
      return;
    }

    this.store.setGameLoadout(DOG_GAME_ID, this.draft);
    const runSeed = result.status === "lost" ? this.getResultRunSeed() : undefined;
    this.reset();
    this.onApplied(result, runSeed);
  }

  private getCurrentLoadout(): readonly string[] | null | undefined {
    return this.store.snapshot().state?.games[DOG_GAME_ID]?.loadout;
  }

  private render(): void {
    const result = this.getResult();
    if (result === null || result.gameId !== DOG_GAME_ID) {
      return;
    }

    let editorRoot = this.root.querySelector<HTMLElement>(
      '[data-testid="dog-result-loadout-editor"]',
    );
    if (editorRoot === null) {
      const resultCard = this.root.querySelector<HTMLElement>(".game-result-card");
      if (resultCard === null) {
        return;
      }

      resultCard.insertAdjacentHTML(
        "beforeend",
        '<div data-testid="dog-result-loadout-editor"></div>',
      );
      editorRoot = resultCard.querySelector<HTMLElement>(
        '[data-testid="dog-result-loadout-editor"]',
      );
    }
    if (editorRoot === null) {
      return;
    }

    const current = this.getCurrentLoadout();
    if (!isValidDogLoadout(current, this.config.items.loadoutSize)) {
      return;
    }

    const levelNumber = result.status === "won"
      ? result.levelNumber + 1
      : result.levelNumber;
    editorRoot.innerHTML = renderResultLoadoutEditor({
      draft: this.draft,
      current,
      levelNumber,
      confirming: this.confirming,
      changeTarget: result.status === "won" ? "next" : "current",
      config: this.config,
    });
  }
}
