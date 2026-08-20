import { describe, expect, it } from "vitest";
import {
  DOG_ITEM_DEFINITIONS,
  DOG_ITEM_IDS,
  DOG_LOADOUT_SIZE,
  areDogLoadoutsEqual,
  isValidDogLoadout,
} from "@/games/dog-lege-dog";
import {
  renderDogLoadoutEditor,
  renderDogLoadoutSummary,
} from "@/games/dog-lege-dog/game/dog-loadout";

describe("狗了个狗道具组", () => {
  it("固定提供五种可展示道具，并要求选择三个不同 ID", () => {
    expect(DOG_ITEM_IDS).toEqual([
      "triple-removal",
      "tray-capacity",
      "wildcard",
      "torch",
      "detector",
    ]);
    expect(DOG_ITEM_DEFINITIONS).toHaveLength(5);
    expect(DOG_ITEM_DEFINITIONS.every((item) => item.name && item.description && item.icon)).toBe(true);
    expect(DOG_LOADOUT_SIZE).toBe(3);
    expect(isValidDogLoadout(["triple-removal", "tray-capacity", "wildcard"])).toBe(true);
    expect(isValidDogLoadout(["triple-removal", "tray-capacity"])).toBe(false);
    expect(isValidDogLoadout(["triple-removal", "triple-removal", "wildcard"])).toBe(false);
    expect(isValidDogLoadout(["triple-removal", "tray-capacity", "unknown"])).toBe(false);
  });

  it("把同组识别为取消，把替换至少一个道具识别为变更", () => {
    const current = ["triple-removal", "tray-capacity", "wildcard"] as const;

    expect(areDogLoadoutsEqual(current, ["wildcard", "triple-removal", "tray-capacity"])).toBe(true);
    expect(areDogLoadoutsEqual(current, ["triple-removal", "tray-capacity", "torch"])).toBe(false);
  });

  it("以浮层渲染选组，并把已选道具渲染成摘要缩略图", () => {
    const editor = renderDogLoadoutEditor({
      mode: "initial",
      draft: [],
      current: null,
      levelNumber: 1,
      confirming: false,
    });
    const summary = renderDogLoadoutSummary([
      "triple-removal",
      "tray-capacity",
      "wildcard",
    ]);

    expect(editor).toContain('data-testid="dog-loadout-modal"');
    expect(editor).toContain('role="dialog"');
    expect(summary.match(/data-testid="dog-loadout-thumbnail"/g)).toHaveLength(3);
    expect(summary).toContain('role="img" aria-label="道具三消移除"');
    expect(summary).toContain('data-action="edit-loadout"');
    expect(summary).toContain(">变更</button>");
  });
});
