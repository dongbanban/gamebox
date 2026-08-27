export type BrowserSpecialMechanism = "freeze" | "illusion" | "magnetic" | "twin";

export interface BrowserBlock {
  readonly id: string;
  readonly patternType: string;
  readonly specialMechanism?: BrowserSpecialMechanism;
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface BrowserTrayBlock {
  readonly id: string;
  readonly patternType: string;
  readonly frozen: boolean;
  readonly freezeProgress: number;
}

export function findIndependentSolvablePath(
  blocks: readonly BrowserBlock[],
  runSeed: string,
  trayCapacity: number,
): string[] {
  const remaining = new Set(blocks.map((block) => block.id));
  const result = searchIndependentSolvability(
    blocks,
    remaining,
    [],
    [],
    new Set(),
    new BrowserSeededRandom(`${runSeed}:magnetic-target`),
    trayCapacity,
    { attempts: 0, maxAttempts: 100_000 },
  );
  if (result === undefined) {
    throw new Error("E2E could not find an independent solvable path");
  }

  return [...result];
}

function searchIndependentSolvability(
  blocks: readonly BrowserBlock[],
  remaining: ReadonlySet<string>,
  tray: readonly BrowserTrayBlock[],
  path: readonly string[],
  failedStates: Set<string>,
  magneticRandom: BrowserSeededRandom,
  trayCapacity: number,
  context: { attempts: number; readonly maxAttempts: number },
): readonly string[] | undefined {
  if (remaining.size === 0) {
    return tray.length === 0 ? path : undefined;
  }

  const stateKey = `${[...remaining].sort().join(",")}:${tray
    .map((block) => `${block.id}:${block.patternType}:${block.frozen}:${block.freezeProgress}`)
    .join(",")}:${magneticRandom.stateKey()}`;
  if (failedStates.has(stateKey)) {
    return undefined;
  }

  const selectable = blocks
    .filter((block) => remaining.has(block.id))
    .filter((block) => !blocks.some(
      (higher) => remaining.has(higher.id) && higher.z > block.z && overlaps(higher, block),
    ))
    .sort((first, second) => {
      const firstMatches = trailingMatchCount(tray, first.patternType);
      const secondMatches = trailingMatchCount(tray, second.patternType);
      return (
        secondMatches - firstMatches ||
        second.z - first.z ||
        first.id.localeCompare(second.id)
      );
    });

  for (const block of selectable) {
    context.attempts += 1;
    if (context.attempts > context.maxAttempts) {
      return undefined;
    }

    const resolution = resolveIndependentSelection(
      blocks,
      block,
      remaining,
      tray,
      magneticRandom,
    );
    resolveIndependentTrayMatches(
      resolution.tray,
      resolution.remaining.size === 0 && canResolveAllIndependentTrayBlocks(resolution.tray),
    );
    if (
      resolution.tray.length > trayCapacity ||
      (resolution.tray.length === trayCapacity &&
        resolution.remaining.size > 0 &&
        !hasCapacityRelievingSelection(
          blocks,
          resolution.remaining,
          resolution.tray,
          resolution.magneticRandom,
          trayCapacity,
        ))
    ) {
      continue;
    }

    const result = searchIndependentSolvability(
      blocks,
      resolution.remaining,
      resolution.tray,
      [...path, block.id],
      failedStates,
      resolution.magneticRandom,
      trayCapacity,
      context,
    );
    if (result !== undefined) {
      return result;
    }
  }

  failedStates.add(stateKey);
  return undefined;
}

interface IndependentSelectionResolution {
  readonly remaining: Set<string>;
  readonly tray: BrowserTrayBlock[];
  readonly magneticRandom: BrowserSeededRandom;
}

function resolveIndependentSelection(
  blocks: readonly BrowserBlock[],
  selectedBlock: BrowserBlock,
  remaining: ReadonlySet<string>,
  tray: readonly BrowserTrayBlock[],
  magneticRandom: BrowserSeededRandom,
): IndependentSelectionResolution {
  const nextRemaining = new Set(remaining);
  nextRemaining.delete(selectedBlock.id);
  const nextTray = tray.map((trayBlock) => ({ ...trayBlock }));
  const nextMagneticRandom = magneticRandom.clone();
  const target = selectedBlock.specialMechanism === "magnetic"
    ? chooseIndependentMagneticTarget(
        blocks,
        selectedBlock,
        nextRemaining,
        nextMagneticRandom,
      )
    : undefined;
  if (target !== undefined) {
    nextRemaining.delete(target.id);
  }

  nextTray.push(...toIndependentTrayBlocks(selectedBlock));
  if (target !== undefined) {
    nextTray.push(...toIndependentTrayBlocks(target));
  }
  return {
    remaining: nextRemaining,
    tray: nextTray,
    magneticRandom: nextMagneticRandom,
  };
}

function toIndependentTrayBlocks(
  block: BrowserBlock,
): BrowserTrayBlock[] {
  if (block.specialMechanism === "twin") {
    return [
      {
        id: `${block.id}-1`,
        patternType: block.patternType,
        frozen: false,
        freezeProgress: 0,
      },
      {
        id: `${block.id}-2`,
        patternType: block.patternType,
        frozen: false,
        freezeProgress: 0,
      },
    ];
  }
  return [
    {
      id: block.id,
      patternType: block.patternType,
      frozen: block.specialMechanism === "freeze",
      freezeProgress: 0,
    },
  ];
}

function chooseIndependentMagneticTarget(
  blocks: readonly BrowserBlock[],
  source: BrowserBlock,
  remaining: ReadonlySet<string>,
  magneticRandom: BrowserSeededRandom,
): BrowserBlock | undefined {
  const candidates = blocks.filter((block) =>
    remaining.has(block.id) &&
    block.specialMechanism !== "magnetic" &&
    block.patternType !== source.patternType,
  );
  if (candidates.length === 0) {
    return undefined;
  }

  const selectableCandidates = candidates.filter((block) =>
    isIndependentSelectable(blocks, block, remaining),
  );
  const candidatePool = selectableCandidates.length > 0
    ? selectableCandidates
    : candidates;
  return candidatePool[magneticRandom.nextInt(candidatePool.length)];
}

function isIndependentSelectable(
  blocks: readonly BrowserBlock[],
  block: BrowserBlock,
  remaining: ReadonlySet<string>,
): boolean {
  return !blocks.some((higher) =>
    remaining.has(higher.id) &&
    higher.z > block.z &&
    overlaps(higher, block),
  );
}

function hasCapacityRelievingSelection(
  blocks: readonly BrowserBlock[],
  remaining: ReadonlySet<string>,
  tray: readonly BrowserTrayBlock[],
  magneticRandom: BrowserSeededRandom,
  trayCapacity: number,
): boolean {
  for (const block of blocks) {
    if (!remaining.has(block.id) || !isIndependentSelectable(blocks, block, remaining)) {
      continue;
    }
    const resolution = resolveIndependentSelection(
      blocks,
      block,
      remaining,
      tray,
      magneticRandom,
    );
    resolveIndependentTrayMatches(
      resolution.tray,
      resolution.remaining.size === 0 && canResolveAllIndependentTrayBlocks(resolution.tray),
    );
    if (resolution.tray.length <= trayCapacity) {
      return true;
    }
  }
  return false;
}

function overlaps(first: BrowserBlock, second: BrowserBlock): boolean {
  return (
    Math.min(first.x + 4, second.x + 4) > Math.max(first.x, second.x) &&
    Math.min(first.y + 4, second.y + 4) > Math.max(first.y, second.y)
  );
}

function trailingMatchCount(
  tray: readonly BrowserTrayBlock[],
  patternType: string,
): number {
  let count = 0;
  for (let index = tray.length - 1; index >= 0; index -= 1) {
    const block = tray[index];
    if (
      block === undefined ||
      block.frozen ||
      block.patternType !== patternType
    ) {
      break;
    }

    count += 1;
  }

  return count;
}

function resolveIndependentTrayMatches(
  tray: BrowserTrayBlock[],
  allowFrozenMatches: boolean,
): void {
  while (true) {
    const groups: Array<{ patternType: string; indexes: number[] }> = [];
    let currentGroup: { patternType: string; indexes: number[] } | undefined;
    for (let index = 0; index < tray.length; index += 1) {
      const block = tray[index];
      const matchable = block !== undefined && (!block.frozen || allowFrozenMatches);
      if (!matchable) {
        currentGroup = undefined;
        continue;
      }

      if (
        currentGroup !== undefined &&
        currentGroup.patternType === block.patternType
      ) {
        currentGroup.indexes.push(index);
      } else {
        currentGroup = { patternType: block.patternType, indexes: [index] };
        groups.push(currentGroup);
      }
    }

    const removalIndexes = groups.flatMap(({ indexes }) =>
      indexes.slice(0, Math.floor(indexes.length / 3) * 3),
    );
    if (removalIndexes.length === 0) {
      return;
    }

    const removalSet = new Set(removalIndexes);
    const triplePatterns = groups.flatMap(({ patternType, indexes }) =>
      Array.from({ length: Math.floor(indexes.length / 3) }, () => patternType),
    );
    tray.splice(
      0,
      tray.length,
      ...tray.filter((_, index) => !removalSet.has(index)),
    );
    for (let index = 0; index < tray.length; index += 1) {
      const block = tray[index];
      if (block === undefined || !block.frozen) {
        continue;
      }

      const successfulTripleCount = triplePatterns.length;
      if (successfulTripleCount === 0) {
        continue;
      }

      const freezeProgress = block.freezeProgress + successfulTripleCount;
      tray[index] = {
        ...block,
        frozen: freezeProgress < 2,
        freezeProgress,
      };
    }
  }
}

function canResolveAllIndependentTrayBlocks(
  tray: readonly BrowserTrayBlock[],
): boolean {
  const simulatedTray = tray.map((block) => ({ ...block }));
  while (simulatedTray.length > 0) {
    const beforeLength = simulatedTray.length;
    resolveIndependentTrayMatches(simulatedTray, true);
    if (simulatedTray.length === beforeLength) {
      return false;
    }
  }

  return true;
}

class BrowserSeededRandom {
  private state: number;

  constructor(seed: string) {
    this.state = hashBrowserSeed(seed);
  }

  next(): number {
    this.state = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    this.state ^= this.state + Math.imul(this.state ^ (this.state >>> 7), 61 | this.state);
    return ((this.state ^ (this.state >>> 14)) >>> 0) / 4_294_967_296;
  }

  nextInt(maxExclusive: number): number {
    return Math.floor(this.next() * maxExclusive);
  }

  clone(): BrowserSeededRandom {
    const clone = new BrowserSeededRandom("clone");
    clone.state = this.state;
    return clone;
  }

  stateKey(): string {
    return this.state.toString(36);
  }
}

function hashBrowserSeed(seed: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash || 1;
}
