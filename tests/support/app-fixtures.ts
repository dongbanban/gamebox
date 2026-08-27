import { mountApp as mountGameboxApp, type MountAppOptions } from "@/app";
import { GAME_ID, type StorageLike } from "@/progress-store";
import { TEST_LEVEL, TEST_RUN_SEED } from "./dog-level-fixture";

export class DamagedStorage implements StorageLike {
  getItem(): string {
    return "{damaged";
  }

  setItem(): void {
    throw new Error("storage unavailable");
  }

  removeItem(): void {
    throw new Error("storage unavailable");
  }
}

export class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

export function mountApp(root: HTMLElement, options: MountAppOptions = {}) {
  return mountGameboxApp(root, {
    ...options,
    runSeedFactory: options.runSeedFactory ?? (() => TEST_RUN_SEED),
  });
}

export function completeFirstLevel(root: HTMLElement): void {
  confirmDogLoadout(root);
  for (const blockId of TEST_LEVEL.solutionPath) {
    root
      .querySelector<HTMLButtonElement>(
        `[data-testid="dog-block"][data-block-id="${blockId}"]`,
      )
      ?.click();
  }
}

export function confirmDogLoadout(root: HTMLElement): void {
  if (root.querySelector('[data-testid="dog-loadout-panel"]') === null) return;
  for (const itemId of ["triple-removal", "tray-capacity", "wildcard"]) {
    root.querySelector<HTMLButtonElement>(`[data-loadout-id="${itemId}"]`)?.click();
  }
  root.querySelector<HTMLButtonElement>('[data-action="confirm-loadout"]')?.click();
}

export function requestLevelThroughNavigationSeam(root: HTMLElement, levelNumber: number): void {
  const request = document.createElement("button");
  request.dataset.action = "select-level";
  request.dataset.gameId = GAME_ID;
  request.dataset.levelNumber = String(levelNumber);
  root.append(request);
  request.click();
}

export function dispatchBeforeUnload(): BeforeUnloadEvent {
  const event = new Event("beforeunload", { cancelable: true }) as BeforeUnloadEvent;
  window.dispatchEvent(event);
  return event;
}

export function readActiveGameSnapshot(root: HTMLElement): {
  readonly blockIds: readonly (string | undefined)[];
  readonly trayPatterns: readonly (string | undefined)[];
  readonly inputLocked: string | undefined;
} {
  return {
    blockIds: [...root.querySelectorAll<HTMLElement>('[data-testid="dog-block"]')].map(
      (block) => block.dataset.blockId,
    ),
    trayPatterns: [...root.querySelectorAll<HTMLElement>('[data-testid="dog-tray-slot"]')].map(
      (slot) => slot.dataset.patternType,
    ),
    inputLocked: root.querySelector<HTMLElement>('[data-testid="dog-game"]')?.dataset.inputLocked,
  };
}
