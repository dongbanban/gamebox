import type { DogLegeDogLevel } from "@/games/dog-lege-dog/levels/level-types";

export function freezeDogLegeDogLevel(level: DogLegeDogLevel): DogLegeDogLevel {
  return deepFreeze(level);
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object") {
    return value;
  }

  const objectValue = value as object;
  if (seen.has(objectValue)) {
    return value;
  }

  seen.add(objectValue);
  const properties = value as Record<PropertyKey, unknown>;
  for (const key of Reflect.ownKeys(objectValue)) {
    deepFreeze(properties[key], seen);
  }

  return Object.freeze(value);
}
