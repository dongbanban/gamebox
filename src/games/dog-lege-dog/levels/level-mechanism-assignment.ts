import {
  createDogIllusionMechanism,
  createDogSpecialMechanism,
  DOG_SPECIAL_MECHANISM_MIDDLE_LAYER_RATIO,
  DOG_TWIN_MECHANISM_TYPE,
} from "@/games/dog-lege-dog/game/special-mechanisms";
import type {
  DogBlock,
  DogSpecialMechanismConfig,
} from "@/games/dog-lege-dog/levels/level-types";
import type { SeededRandom } from "@/games/dog-lege-dog/levels/level-random";

interface PhysicalRemovalGroup {
  readonly groupIndex: number;
  readonly indices: readonly number[];
}

/**
 * Assigns v13 mechanisms without searching every possible mechanism layout.
 * The generated removal path is grouped into logical triples first: freezes
 * lead a group and magnetic blocks close a group, so their entry effects keep
 * the path's triple boundaries intact.
 */
export function assignDogV13SpecialMechanisms(
  blocks: readonly DogBlock[],
  configurations: readonly DogSpecialMechanismConfig[],
  removalOrder: readonly number[],
  random: SeededRandom,
  maxLayers: number,
): readonly DogBlock[] {
  const requestedCounts = new Map(
    configurations.map((configuration) => [configuration.type, configuration.min]),
  );
  validateRequestedCounts(configurations, requestedCounts);

  const groups = createPhysicalRemovalGroups(blocks, removalOrder);
  const usedIndices = new Set<number>();
  const assignments = new Map<number, string>();

  for (const [index, block] of blocks.entries()) {
    if (block.specialMechanism === undefined) {
      continue;
    }
    if (block.specialMechanism.type !== DOG_TWIN_MECHANISM_TYPE) {
      throw new Error("狗了个狗 v13 mechanism assignment received a preassigned mechanism");
    }
    usedIndices.add(index);
  }

  const twinCount = countAssignments(blocks, DOG_TWIN_MECHANISM_TYPE);
  if (twinCount !== (requestedCounts.get(DOG_TWIN_MECHANISM_TYPE) ?? 0)) {
    throw new Error("狗了个狗 v13 twin count does not match mechanism plan");
  }

  assignGroupLeadMechanisms(
    groups,
    blocks,
    requestedCounts.get("freeze") ?? 0,
    "freeze",
    usedIndices,
    assignments,
    random,
  );
  assignGroupTailMechanisms(
    groups,
    blocks,
    requestedCounts.get("magnetic") ?? 0,
    usedIndices,
    assignments,
    random,
  );
  assignRemainingMechanisms(
    blocks,
    requestedCounts.get("illusion") ?? 0,
    "illusion",
    usedIndices,
    assignments,
    random,
  );

  const assignedBlocks = blocks.map((block, index) => {
    const type = assignments.get(index);
    if (type === undefined) {
      return block;
    }
    return {
      ...block,
      specialMechanism: type === "illusion"
        ? createDogIllusionMechanism(block.patternType, random)
        : createDogSpecialMechanism(type),
    };
  });

  validateAssignedComposition(
    assignedBlocks,
    configurations,
    maxLayers,
  );
  return assignedBlocks;
}

function validateRequestedCounts(
  configurations: readonly DogSpecialMechanismConfig[],
  requestedCounts: ReadonlyMap<string, number>,
): void {
  if (configurations.length !== 4) {
    throw new Error("狗了个狗 v13 mechanism plan must contain four types");
  }
  const seen = new Set<string>();
  for (const configuration of configurations) {
    if (seen.has(configuration.type)) {
      throw new Error(`狗了个狗 duplicate v13 mechanism plan: ${configuration.type}`);
    }
    seen.add(configuration.type);
    const count = requestedCounts.get(configuration.type);
    if (
      count === undefined ||
      !Number.isSafeInteger(count) ||
      count < 1 ||
      configuration.max !== count
    ) {
      throw new Error(`狗了个狗 v13 mechanism count is not fixed: ${configuration.type}`);
    }
  }
}

function createPhysicalRemovalGroups(
  blocks: readonly DogBlock[],
  removalOrder: readonly number[],
): readonly PhysicalRemovalGroup[] {
  const groups: PhysicalRemovalGroup[] = [];
  let cursor = 0;
  while (cursor < removalOrder.length) {
    const firstIndex = removalOrder[cursor];
    if (firstIndex === undefined || blocks[firstIndex] === undefined) {
      throw new Error("狗了个狗 v13 mechanism assignment path is invalid");
    }
    const size = blocks[firstIndex].specialMechanism?.type === DOG_TWIN_MECHANISM_TYPE ? 2 : 3;
    const indices = removalOrder.slice(cursor, cursor + size);
    if (indices.length !== size || indices.some((index) => blocks[index] === undefined)) {
      throw new Error("狗了个狗 v13 mechanism assignment path has incomplete group");
    }
    groups.push({
      groupIndex: groups.length,
      indices: Object.freeze([...indices]),
    });
    cursor += size;
  }
  return Object.freeze(groups);
}

function assignGroupLeadMechanisms(
  groups: readonly PhysicalRemovalGroup[],
  blocks: readonly DogBlock[],
  count: number,
  type: string,
  usedIndices: Set<number>,
  assignments: Map<number, string>,
  random: SeededRandom,
): void {
  const candidates = groups
    .filter(({ indices }) => indices.length === 3)
    .map(({ groupIndex, indices }) => ({ groupIndex, index: indices[0] }))
    .filter(
      (candidate): candidate is { readonly groupIndex: number; readonly index: number } =>
        candidate.index !== undefined,
    )
    .filter(({ index }) => isEligibleHighLayerBlock(blocks[index], index, usedIndices));
  const twinGroupIndices = new Set(
    groups
      .filter(({ indices }) => indices.length === 2)
      .map(({ groupIndex }) => groupIndex),
  );
  const freezeSafeCandidates = candidates.filter(({ groupIndex }) =>
    !hasTwinInNextGroups(groupIndex, twinGroupIndices, 2),
  );
  const distributedCandidates = selectDistributedGroupCandidates(
    freezeSafeCandidates.length >= count ? freezeSafeCandidates : candidates,
    count,
    random,
  );
  assignFromCandidates(
    distributedCandidates,
    count,
    type,
    blocks,
    usedIndices,
    assignments,
    random,
  );
}

function hasTwinInNextGroups(
  groupIndex: number,
  twinGroupIndices: ReadonlySet<number>,
  lookahead: number,
): boolean {
  for (let offset = 1; offset <= lookahead; offset += 1) {
    if (twinGroupIndices.has(groupIndex + offset)) {
      return true;
    }
  }
  return false;
}

function assignGroupTailMechanisms(
  groups: readonly PhysicalRemovalGroup[],
  blocks: readonly DogBlock[],
  count: number,
  usedIndices: Set<number>,
  assignments: Map<number, string>,
  random: SeededRandom,
): void {
  const candidates = groups
    .filter(({ indices }) => indices.length === 3)
    .map(({ indices }) => indices[2])
    .filter((index): index is number => index !== undefined)
    .filter((index) => isEligibleHighLayerBlock(blocks[index], index, usedIndices));
  assignFromCandidates(candidates, count, "magnetic", blocks, usedIndices, assignments, random);
}

function assignRemainingMechanisms(
  blocks: readonly DogBlock[],
  count: number,
  type: string,
  usedIndices: Set<number>,
  assignments: Map<number, string>,
  random: SeededRandom,
): void {
  const candidates = blocks
    .map((block, index) => index)
    .filter((index) => isEligibleHighLayerBlock(blocks[index], index, usedIndices));
  assignFromCandidates(candidates, count, type, blocks, usedIndices, assignments, random);
}

function assignFromCandidates(
  candidates: readonly number[],
  count: number,
  type: string,
  blocks: readonly DogBlock[],
  usedIndices: Set<number>,
  assignments: Map<number, string>,
  random: SeededRandom,
): void {
  const selected = prioritizeMiddleLayer(candidates, blocks, random).slice(0, count);
  if (selected.length !== count) {
    throw new Error(`狗了个狗 v13 mechanism ${type} has no legal placement capacity`);
  }
  for (const index of selected) {
    if (usedIndices.has(index)) {
      throw new Error(`狗了个狗 v13 mechanism ${type} placement overlaps another mechanism`);
    }
    usedIndices.add(index);
    assignments.set(index, type);
  }
}

function selectDistributedGroupCandidates(
  candidates: readonly { readonly groupIndex: number; readonly index: number }[],
  count: number,
  random: SeededRandom,
): readonly number[] {
  if (count <= 0 || candidates.length === 0) {
    return [];
  }

  const ordered = random.shuffle([...candidates]).sort(
    (first, second) => first.groupIndex - second.groupIndex,
  );
  const selected: number[] = [];
  const selectedGroupIndices = new Set<number>();
  const step = ordered.length / count;
  for (let slot = 0; slot < count; slot += 1) {
    const targetPosition = (slot + 0.5) * step;
    const candidate = ordered
      .map((entry, position) => ({ entry, position }))
      .filter(({ entry }) => !selectedGroupIndices.has(entry.groupIndex))
      .sort(
        (first, second) =>
          Math.abs(first.position - targetPosition) - Math.abs(second.position - targetPosition),
      )[0]?.entry;
    if (candidate === undefined) {
      break;
    }
    selected.push(candidate.index);
    selectedGroupIndices.add(candidate.groupIndex);
  }
  return selected;
}

function prioritizeMiddleLayer(
  candidates: readonly number[],
  blocks: readonly DogBlock[],
  random: SeededRandom,
): number[] {
  return random.shuffle([...candidates]).sort(
    (first, second) =>
      Number(isMiddleLayer(blocks[second], maxLayerIndex(blocks))) -
      Number(isMiddleLayer(blocks[first], maxLayerIndex(blocks))),
  );
}

function validateAssignedComposition(
  blocks: readonly DogBlock[],
  configurations: readonly DogSpecialMechanismConfig[],
  maxLayers: number,
): void {
  const counts = new Map<string, number>();
  let specialCount = 0;
  let middleCount = 0;
  for (const block of blocks) {
    const type = block.specialMechanism?.type;
    if (type === undefined) {
      continue;
    }
    counts.set(type, (counts.get(type) ?? 0) + 1);
    specialCount += 1;
    middleCount += Number(isMiddleLayer(block, maxLayers - 1));
  }
  for (const configuration of configurations) {
    if ((counts.get(configuration.type) ?? 0) !== configuration.min) {
      throw new Error(`狗了个狗 v13 ${configuration.type} assignment count is invalid`);
    }
  }
  if (
    specialCount > 0 &&
    middleCount / specialCount < DOG_SPECIAL_MECHANISM_MIDDLE_LAYER_RATIO
  ) {
    throw new Error("狗了个狗 v13 special mechanism middle-layer ratio is below 70%");
  }
}

function isEligibleHighLayerBlock(
  block: DogBlock | undefined,
  index: number,
  usedIndices: ReadonlySet<number>,
): boolean {
  return block !== undefined && block.z > 0 && block.specialMechanism === undefined &&
    !usedIndices.has(index);
}

function countAssignments(blocks: readonly DogBlock[], type: string): number {
  return blocks.filter((block) => block.specialMechanism?.type === type).length;
}

function isMiddleLayer(block: DogBlock | undefined, maxLayerIndex: number): boolean {
  return block !== undefined && block.z > 0 && block.z < maxLayerIndex;
}

function maxLayerIndex(blocks: readonly DogBlock[]): number {
  return Math.max(1, ...blocks.map((block) => block.z));
}
