import { DOG_V13_CONFIG } from "@/games/dog-lege-dog/game/v13-config";
import type { DogV13Config } from "@/games/dog-lege-dog/game/v13-config";

export function getDogTrayLockCount(
  runSeed: string,
  generatorVersion: number,
  config: DogV13Config = DOG_V13_CONFIG,
): number {
  if (generatorVersion < config.game.generatorVersion) {
    return 0;
  }

  return new SeededRandom(`${runSeed}:tray-lock-slot-count`).nextInt(
    config.tray.maxLockedSlotCount + 1,
  );
}

export function getCandidateRandomSeed(
  gameId: string,
  levelSeed: string,
  attempt: number,
): string {
  return `${gameId}:${levelSeed}:attempt-${attempt}`;
}

export function getGuaranteedRandomSeed(gameId: string, levelSeed: string): string {
  return `${gameId}:guaranteed:${levelSeed}`;
}

let generatedRunSeedCount = 0;

/** Creates an external attempt seed; generation itself remains fully seeded. */
export function createRunSeed(): string {
  generatedRunSeedCount += 1;
  const counter = generatedRunSeedCount.toString(36);
  const timestamp = Date.now().toString(36);
  const cryptoApi = globalThis.crypto;

  if (cryptoApi?.getRandomValues !== undefined) {
    const values = new Uint32Array(2);
    cryptoApi.getRandomValues(values);
    return `run-${timestamp}-${counter}-${values[0]!.toString(36)}-${values[1]!.toString(36)}`;
  }

  return `run-${timestamp}-${counter}`;
}

export function weightedPick<T>(
  values: readonly T[],
  weights: readonly number[],
  random: SeededRandom,
): T {
  const totalWeight = weights.reduce((total, weight) => total + weight, 0);
  let target = random.next() * totalWeight;
  for (let index = 0; index < values.length; index += 1) {
    target -= weights[index];
    if (target < 0) {
      return values[index];
    }
  }

  return values[values.length - 1];
}

export class SeededRandom {
  private state: number;

  constructor(seed: string) {
    this.state = hashSeed(seed);
  }

  next(): number {
    this.state = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    this.state ^= this.state + Math.imul(this.state ^ (this.state >>> 7), 61 | this.state);
    return ((this.state ^ (this.state >>> 14)) >>> 0) / 4_294_967_296;
  }

  nextInt(maxExclusive: number): number {
    return Math.floor(this.next() * maxExclusive);
  }

  clone(): SeededRandom {
    const clone = new SeededRandom("clone");
    clone.state = this.state;
    return clone;
  }

  stateKey(): string {
    return this.state.toString(36);
  }

  shuffle<T>(values: T[]): T[] {
    for (let index = values.length - 1; index > 0; index -= 1) {
      const swapIndex = this.nextInt(index + 1);
      [values[index], values[swapIndex]] = [values[swapIndex], values[index]];
    }
    return values;
  }
}

function hashSeed(seed: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }

  return hash || 1;
}
