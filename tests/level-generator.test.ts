import { describe, expect, it } from "vitest";
import {
  DOG_PATTERN_TYPES,
  DOG_SHAPE_TEMPLATES,
  LEVEL_GENERATOR_VERSION,
  LevelGenerator,
  getBlockCount,
  getMaxLayers,
  getPatternTypeCount,
  getShapePool,
} from "../src/games/dog-lege-dog";

describe("LevelGenerator", () => {
  it("通过明确的关卡号、seed 与生成器版本稳定生成同一棋盘", () => {
    const generator = new LevelGenerator();
    const request = {
      levelNumber: 12,
      seed: "replay-seed",
      generatorVersion: LEVEL_GENERATOR_VERSION,
    } as const;

    const first = generator.generate(request);
    const second = generator.generate(request);

    expect(second).toEqual(first);
    expect(first.number).toBe(request.levelNumber);
    expect(first.generatorVersion).toBe(request.generatorVersion);
    expect(first.seed).toContain(request.seed);
  });

  it("按关卡阶段递增方块数量、层数、形状池与图案池", () => {
    expect([1, 5, 6, 10, 11, 15, 16, 20, 21, 25, 26].map(getBlockCount)).toEqual([
      90,
      90,
      108,
      108,
      126,
      126,
      144,
      144,
      162,
      162,
      180,
    ]);
    expect([1, 5, 6, 15, 16, 30, 31, 100].map(getMaxLayers)).toEqual([
      3,
      3,
      4,
      4,
      5,
      5,
      6,
      6,
    ]);
    expect([1, 5, 6, 15, 16, 30, 31, 100].map(getPatternTypeCount)).toEqual([
      4,
      4,
      6,
      6,
      8,
      8,
      10,
      10,
    ]);
    expect(getShapePool(5)).toEqual(["rectangle"]);
    expect(getShapePool(6)).toEqual(["rectangle", "star"]);
    expect(getShapePool(16)).toEqual(["rectangle", "star", "heart"]);
    expect(getShapePool(31)).toEqual(["rectangle", "star", "heart", "irregular"]);
  });

  it("为四类形状提供多个预定义网格变体", () => {
    const variantsByShape = new Map<string, Set<string>>();
    for (const template of DOG_SHAPE_TEMPLATES) {
      const variants = variantsByShape.get(template.shape) ?? new Set<string>();
      variants.add(template.id);
      variantsByShape.set(template.shape, variants);
      expect(template.rows).toHaveLength(template.height);
      expect(template.rows.every((row) => row.length === template.width)).toBe(true);
    }

    expect([...variantsByShape.keys()].sort()).toEqual([
      "heart",
      "irregular",
      "rectangle",
      "star",
    ]);
    expect([...variantsByShape.values()].every((variants) => variants.size >= 2)).toBe(true);
  });

  it("生成关卡结构满足形状、图案与层叠不变量", () => {
    const generator = new LevelGenerator();

    for (const levelNumber of [2, 5, 6, 15, 16, 30, 31, 60, 100]) {
      const level = generator.generate({
        levelNumber,
        seed: `invariant-${levelNumber}`,
        generatorVersion: LEVEL_GENERATOR_VERSION,
      });
      const playableCells = new Set(level.board.playableCells.map((cell) => `${cell.x}:${cell.y}`));

      expect(level.blocks).toHaveLength(getBlockCount(levelNumber));
      expect(new Set(level.blocks.map((block) => block.z))).toHaveLength(getMaxLayers(levelNumber));
      expect(level.patternTypes).toHaveLength(getPatternTypeCount(levelNumber));
      expect(level.patternTypes.every((patternType) => DOG_PATTERN_TYPES.includes(patternType))).toBe(
        true,
      );

      for (const patternType of level.patternTypes) {
        expect(
          level.blocks.filter((block) => block.patternType === patternType).length % 3,
        ).toBe(0);
      }

      for (const block of level.blocks) {
        expect(Number.isInteger(block.x)).toBe(true);
        expect(Number.isInteger(block.y)).toBe(true);
        expect(block.rotation).toBe(0);
        for (let y = block.y; y < block.y + block.height; y += 1) {
          for (let x = block.x; x < block.x + block.width; x += 1) {
            expect(playableCells.has(`${x}:${y}`)).toBe(true);
          }
        }
      }

      for (let index = 0; index < level.blocks.length; index += 1) {
        const block = level.blocks[index];
        for (let otherIndex = index + 1; otherIndex < level.blocks.length; otherIndex += 1) {
          const other = level.blocks[otherIndex];
          if (block.z === other.z) {
            expect(hasPositiveAreaOverlap(block, other)).toBe(false);
          }
        }

        const higherBlocks = level.blocks.filter(
          (other) => other.z > block.z && hasPositiveAreaOverlap(block, other),
        );
        expect(higherBlocks.length).toBeLessThanOrEqual(4);
      }
    }
  });

  it("可稳定加载第 2–100 关，不因模板选择抛错", () => {
    const generator = new LevelGenerator();

    for (let levelNumber = 2; levelNumber <= 100; levelNumber += 1) {
      expect(() =>
        generator.generate({
          levelNumber,
          seed: `range-${levelNumber}`,
          generatorVersion: LEVEL_GENERATOR_VERSION,
        }),
      ).not.toThrow();
    }
  });
});

function hasPositiveAreaOverlap(
  first: { x: number; y: number; width: number; height: number },
  second: { x: number; y: number; width: number; height: number },
): boolean {
  return (
    first.x < second.x + second.width &&
    second.x < first.x + first.width &&
    first.y < second.y + second.height &&
    second.y < first.y + first.height
  );
}
