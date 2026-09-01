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
  it("固定提供八种可展示道具，并要求选择三个不同 ID", () => {
    expect(DOG_ITEM_IDS).toEqual([
      "triple-removal",
      "tray-capacity",
      "wildcard",
      "torch",
      "detector",
      "demagnetizer",
      "key",
      "restore-whistle",
    ]);
    expect(DOG_ITEM_DEFINITIONS).toHaveLength(8);
    expect(DOG_ITEM_DEFINITIONS.every((item) => item.name && item.description && item.icon)).toBe(true);
    expect(DOG_ITEM_DEFINITIONS.map((item) => item.targetType)).toEqual([
      "tray-block",
      "none",
      "tray-block",
      "block",
      "block",
      "block",
      "none",
      "none",
    ]);
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
      itemUses: {
        "triple-removal": 1,
        "tray-capacity": 1,
        wildcard: 1,
        demagnetizer: 1,
        key: 0,
      },
    });
    const changeEditor = renderDogLoadoutEditor({
      mode: "change",
      draft: ["triple-removal", "tray-capacity", "wildcard"],
      current: ["triple-removal", "tray-capacity", "wildcard"],
      levelNumber: 1,
      confirming: false,
    });
    const changeConfirmation = renderDogLoadoutEditor({
      mode: "change",
      draft: ["triple-removal", "tray-capacity", "torch"],
      current: ["triple-removal", "tray-capacity", "wildcard"],
      levelNumber: 1,
      confirming: true,
    });
    const summary = renderDogLoadoutSummary([
      "triple-removal",
      "tray-capacity",
      "wildcard",
    ], false, [
      { id: "triple-removal", remainingUses: 0, available: false },
      { id: "tray-capacity", remainingUses: 1, available: true },
      { id: "wildcard", remainingUses: 2, available: false },
    ]);
    const targetingSummary = renderDogLoadoutSummary(
      ["triple-removal", "tray-capacity", "wildcard"],
      true,
      [],
      { targetType: "tray-block" },
    );

    expect(editor).toContain('data-testid="dog-loadout-modal"');
    expect(editor).toContain('role="dialog"');
    expect(editor).toContain('src="assets/dog-item-icons/triple-removal.svg"');
    expect(editor).toContain('src="assets/dog-item-icons/demagnetizer.svg"');
    expect(editor).toContain('src="assets/dog-item-icons/key.svg"');
    expect(editor).toContain('src="assets/dog-item-icons/restore-whistle.svg"');
    expect(editor).toContain("复原哨");
    expect(editor).toContain("本关 1 次");
    expect(editor).toContain("本关 0 次");
    expect(editor).not.toContain("DOG · LOADOUT");
    expect(editor).toContain(">清空</button>");
    expect(editor).toMatch(/data-action="confirm-loadout"[^>]*>\s*确认\s*<\/button>/);
    expect(changeEditor).toMatch(
      /<button class="text-button dog-loadout-editor__clear"[^>]*data-action="cancel-loadout">取消<\/button>/,
    );
    expect(changeEditor).toMatch(/data-action="confirm-loadout"[^>]*>\s*确认\s*<\/button>/);
    expect(changeConfirmation).toMatch(
      /<button class="text-button dog-loadout-editor__clear"[^>]*data-action="cancel-loadout-confirmation">取消<\/button>/,
    );
    expect(changeConfirmation).toMatch(
      /<button class="primary-button"[^>]*data-action="apply-loadout-change">确认<\/button>/,
    );
    expect(changeConfirmation).not.toMatch(
      /data-action="cancel-loadout-confirmation">返回修改<\/button>/,
    );
    expect(changeConfirmation).not.toMatch(
      /data-action="apply-loadout-change">确认更换<\/button>/,
    );
    expect(summary.match(/data-testid="dog-loadout-thumbnail"/g)).toHaveLength(3);
    expect(summary.match(/data-action="use-item"/g)).toHaveLength(3);
    expect(summary).toContain('data-item-id="tray-capacity"');
    expect(summary).toContain('aria-label="道具三消移除，剩余 0 次"');
    expect(summary).not.toContain('role="img"');
    expect(summary).toContain('src="assets/dog-item-icons/triple-removal.svg"');
    expect(summary).toContain('src="assets/dog-item-icons/tray-capacity-plus-one.svg"');
    expect(summary).toContain('src="assets/dog-item-icons/wildcard.svg"');
    expect(summary).not.toContain("dog-loadout-summary__label");
    expect(summary).not.toContain("dog-loadout-thumbnail__name");
    expect(summary).toContain("dog-loadout-thumbnail__icon");
    expect(summary.match(/data-testid="dog-loadout-thumbnail-uses"/g)).toHaveLength(3);
    expect(summary).toContain('data-item-available="false"');
    expect(summary).toContain("dog-loadout-thumbnail--unavailable");
    expect(summary.match(/disabled/g)).toHaveLength(2);
    expect(summary).not.toContain("dog-item-panel");
    expect(summary).toContain(">1</span>");
    expect(summary).toContain('data-action="edit-loadout"');
    expect(summary).toContain(">变更</button>");
    expect(targetingSummary).not.toContain("dog-item-panel");
    expect(targetingSummary).toMatch(
      /<div class="dog-loadout-summary__actions"[^>]*>[\s\S]*data-action="cancel-item-target"[\s\S]*data-action="edit-loadout"[\s\S]*<\/div>/,
    );
    expect(targetingSummary).toContain('data-testid="dog-item-targeting"');
    expect(targetingSummary).not.toContain('data-action="select-item-pattern"');

    const blockTargetingSummary = renderDogLoadoutSummary(
      ["triple-removal", "tray-capacity", "wildcard"],
      true,
      [],
      { targetType: "block" },
    );
    expect(blockTargetingSummary).toContain("选择道具目标");
    expect(blockTargetingSummary).toContain("dog-item-targeting");
    expect(blockTargetingSummary).toContain('data-action="cancel-item-target"');
  });
});
