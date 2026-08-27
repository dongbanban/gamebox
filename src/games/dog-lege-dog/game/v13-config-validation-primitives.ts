import type { DogV13ConfigIssue } from "@/games/dog-lege-dog/game/v13-config-types";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function asRecord(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}

export function asNumber(value: unknown): number | undefined {
  return isFiniteNumber(value) ? value : undefined;
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function cloneAndFreeze<T>(value: T): T {
  if (Array.isArray(value)) {
    return Object.freeze(value.map((entry) => cloneAndFreeze(entry))) as T;
  }
  if (isRecord(value)) {
    return Object.freeze(
      Object.fromEntries(
        Object.entries(value).map(([key, entry]) => [key, cloneAndFreeze(entry)]),
      ),
    ) as T;
  }
  return value;
}

export function requiredObject(
  parent: Record<string, unknown>,
  key: string,
  issues: DogV13ConfigIssue[],
  prefix = "",
): void {
  const path = prefix.length === 0 ? key : `${prefix}.${key}`;
  if (!isRecord(parent[key])) {
    issues.push({ path, code: "required", message: "必须是对象" });
  }
}

export function validateRange(
  value: unknown,
  path: string,
  min: number,
  max: number,
  issues: DogV13ConfigIssue[],
  inclusiveMin = true,
): void {
  if (!isFiniteNumber(value)) {
    issues.push({ path, code: "type", message: "必须是有限数字" });
    return;
  }
  if (value < min || (!inclusiveMin && value === min) || value > max) {
    issues.push({ path, code: "range", message: `必须位于 ${min} 与 ${max} 之间` });
  }
}

export function validateFiniteNumber(
  value: unknown,
  path: string,
  min: number,
  issues: DogV13ConfigIssue[],
): void {
  if (!isFiniteNumber(value)) {
    issues.push({ path, code: "type", message: "必须是有限数字" });
    return;
  }
  if (value < min) {
    issues.push({ path, code: "range", message: `不能小于 ${min}` });
  }
}

export function validateInteger(
  value: unknown,
  path: string,
  min: number,
  issues: DogV13ConfigIssue[],
  max = Number.MAX_SAFE_INTEGER,
): void {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    issues.push({ path, code: "type", message: "必须是安全整数" });
    return;
  }
  if (value < min || value > max) {
    issues.push({ path, code: "range", message: `必须位于 ${min} 与 ${max} 之间` });
  }
}

export function validateNonEmptyString(
  value: unknown,
  path: string,
  issues: DogV13ConfigIssue[],
): void {
  if (typeof value !== "string" || value.trim().length === 0) {
    issues.push({ path, code: "required", message: "必须是非空字符串" });
  }
}

export function validateStringArray(
  value: unknown,
  path: string,
  issues: DogV13ConfigIssue[],
): void {
  if (!Array.isArray(value)) {
    issues.push({ path, code: "type", message: "必须是数组" });
    return;
  }
  value.forEach((entry, index) => {
    if (typeof entry !== "string" || entry.trim().length === 0) {
      issues.push({ path: `${path}[${index}]`, code: "type", message: "必须是非空字符串" });
    }
  });
}

export function validateAssetMap(
  value: unknown,
  path: string,
  keys: readonly string[] | unknown,
  issues: DogV13ConfigIssue[],
): void {
  const record = asRecord(value);
  if (record === undefined) {
    issues.push({ path, code: "required", message: "必须是对象" });
    return;
  }
  if (!Array.isArray(keys)) return;
  for (const key of keys) validateNonEmptyString(record[key], `${path}.${key}`, issues);
}

export function validateLevelNumberArray(
  value: unknown,
  path: string,
  maxLevel: number | undefined,
  issues: DogV13ConfigIssue[],
): void {
  if (!Array.isArray(value)) {
    issues.push({ path, code: "type", message: "必须是关卡号数组" });
    return;
  }
  validateUnique(value, path, issues);
  for (const [index, levelNumber] of value.entries()) {
    validateInteger(levelNumber, `${path}[${index}]`, 1, issues, maxLevel);
  }
}

export function validateUnique(
  values: readonly unknown[],
  path: string,
  issues: DogV13ConfigIssue[],
): void {
  const seen = new Set<unknown>();
  values.forEach((value, index) => {
    if (seen.has(value)) {
      issues.push({ path: `${path}[${index}]`, code: "duplicate", message: "不能重复" });
    }
    seen.add(value);
  });
}

export function validateRangeObject(
  value: unknown,
  path: string,
  issues: DogV13ConfigIssue[],
  min: number,
  max: number,
  requireInteger = false,
): void {
  const record = asRecord(value);
  if (record === undefined) {
    issues.push({ path, code: "required", message: "必须是对象" });
    return;
  }
  if (requireInteger) {
    validateInteger(record.min, `${path}.min`, min, issues, max);
    validateInteger(record.max, `${path}.max`, min, issues, max);
  } else {
    validateRange(record.min, `${path}.min`, min, max, issues);
    validateRange(record.max, `${path}.max`, min, max, issues);
  }
  if (isFiniteNumber(record.min) && isFiniteNumber(record.max) && record.max < record.min) {
    issues.push({ path, code: "relation", message: "max 不能小于 min" });
  }
}
