import type { DogItemTarget } from "@/games/dog-lege-dog/game/dog-item-runtime";

export function findDogBlockElement(root: HTMLElement, blockId: string): HTMLElement | null {
  return [...root.querySelectorAll<HTMLElement>('[data-testid="dog-block"]')].find(
    (block) => block.dataset.blockId === blockId,
  ) ?? null;
}

export function findDogTrayBlockElement(
  root: HTMLElement,
  blockId: string,
): HTMLElement | null {
  return [...root.querySelectorAll<HTMLElement>(
    '[data-testid="dog-tray-slot"][data-block-id]',
  )].find((slot) => slot.dataset.blockId === blockId) ?? null;
}

export function findDogTrayInsertionTarget(
  root: HTMLElement,
  insertionIndex: number,
  patternType: string | undefined,
): HTMLElement | null {
  const slots = getOpenDogTraySlots(root);
  return slots[insertionIndex] ?? findDogTrayTarget(root, patternType);
}

export function findDogTrayTarget(
  root: HTMLElement,
  patternType: string | undefined,
): HTMLElement | null {
  const slots = getOpenDogTraySlots(root);
  return slots.find(
    (slot) => patternType !== undefined && slot.dataset.patternType === patternType,
  ) ?? slots.find((slot) => slot.dataset.patternType === undefined) ?? slots[0] ?? null;
}

export function captureDogTrayBlockRects(
  root: HTMLElement,
): ReadonlyMap<string, DOMRect> {
  const rects = new Map<string, DOMRect>();
  for (const slot of root.querySelectorAll<HTMLElement>(
    '[data-testid="dog-tray-slot"][data-block-id]',
  )) {
    const blockId = slot.dataset.blockId;
    if (blockId !== undefined) {
      rects.set(blockId, slot.getBoundingClientRect());
    }
  }
  return rects;
}

export function captureDogTripleRemovalSourceRects(
  root: HTMLElement,
  blockIds: readonly string[],
): ReadonlyMap<string, DOMRect> {
  const rects = new Map<string, DOMRect>();
  for (const blockId of blockIds) {
    const block = findDogBlockElement(root, blockId);
    if (block !== null) {
      rects.set(blockId, block.getBoundingClientRect());
    }
  }
  return rects;
}

export function findDogItemTargetElement(
  root: HTMLElement,
  target: DogItemTarget,
): HTMLElement | null {
  const testId = target.type === "tray-block" ? "dog-tray-slot" : "dog-block";
  return [...root.querySelectorAll<HTMLElement>(`[data-testid="${testId}"]`)].find(
    (element) => element.dataset.blockId === target.blockId,
  ) ?? null;
}

function getOpenDogTraySlots(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>('[data-testid="dog-tray-slot"]')]
    .filter((slot) => slot.dataset.slotState !== "locked");
}
