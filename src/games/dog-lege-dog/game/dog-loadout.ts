import { renderDogItemAsset } from "@/games/dog-lege-dog/assets/item-assets";

export const DOG_LOADOUT_SIZE = 3 as const;

export const DOG_ITEM_IDS = Object.freeze([
  "triple-removal",
  "tray-capacity",
  "wildcard",
  "torch",
  "detector",
] as const);

export type DogItemId = (typeof DOG_ITEM_IDS)[number];

export type DogItemTargetType =
  | "none"
  | "tray-block"
  | "block";

export type DogItemVisualFeedback = DogItemId;

export interface DogItemDefinition {
  readonly id: DogItemId;
  readonly name: string;
  readonly icon: string;
  readonly description: string;
  readonly targetType: DogItemTargetType;
  readonly visualFeedback: DogItemVisualFeedback;
}

export const DOG_ITEM_DEFINITIONS: readonly DogItemDefinition[] = Object.freeze([
  Object.freeze({
    id: "triple-removal",
    name: "道具三消移除",
    icon: "✦",
    description: "选择槽内相邻方块并一次移除",
    targetType: "tray-block",
    visualFeedback: "triple-removal",
  }),
  Object.freeze({
    id: "tray-capacity",
    name: "暂存槽容量提升",
    icon: "+1",
    description: "当前关卡暂存槽增加 1 格",
    targetType: "none",
    visualFeedback: "tray-capacity",
  }),
  Object.freeze({
    id: "wildcard",
    name: "万能方块",
    icon: "◇",
    description: "点击槽内方块复制其图案",
    targetType: "tray-block",
    visualFeedback: "wildcard",
  }),
  Object.freeze({
    id: "torch",
    name: "火把",
    icon: "火",
    description: "融化一个冻结方块",
    targetType: "block",
    visualFeedback: "torch",
  }),
  Object.freeze({
    id: "detector",
    name: "检测仪",
    icon: "⌕",
    description: "揭示一个幻化方块",
    targetType: "block",
    visualFeedback: "detector",
  }),
]);

const DOG_ITEM_ID_SET: ReadonlySet<string> = new Set(DOG_ITEM_IDS);

export function isDogItemId(value: string): value is DogItemId {
  return DOG_ITEM_ID_SET.has(value);
}

export function isValidDogLoadout(
  value: readonly string[] | null | undefined,
): value is readonly DogItemId[] {
  return (
    value !== null &&
    value !== undefined &&
    value.length === DOG_LOADOUT_SIZE &&
    new Set(value).size === DOG_LOADOUT_SIZE &&
    value.every(isDogItemId)
  );
}

export function normalizeDogLoadout(
  value: readonly string[] | null | undefined,
): readonly DogItemId[] | null {
  return isValidDogLoadout(value) ? [...value] : null;
}

export function areDogLoadoutsEqual(
  first: readonly string[] | null | undefined,
  second: readonly string[] | null | undefined,
): boolean {
  if (!isValidDogLoadout(first) || !isValidDogLoadout(second)) {
    return first === second;
  }

  return first.every((itemId) => second.includes(itemId));
}

export function getDogItemDefinition(itemId: DogItemId): DogItemDefinition {
  const definition = DOG_ITEM_DEFINITIONS.find((item) => item.id === itemId);
  if (definition === undefined) {
    throw new Error(`Unknown 狗了个狗 item id: ${itemId}`);
  }

  return definition;
}

export interface DogLoadoutEditorRenderOptions {
  readonly mode: "initial" | "change";
  readonly draft: readonly DogItemId[];
  readonly current: readonly DogItemId[] | null;
  readonly levelNumber: number;
  readonly confirming: boolean;
  readonly changeTarget?: "current" | "next";
  readonly itemUses?: Partial<Record<DogItemId, number>>;
}

export interface DogLoadoutSummaryItemState {
  readonly id: DogItemId;
  readonly remainingUses: number;
  readonly available: boolean;
}

export interface DogLoadoutSummaryTargetState {
  readonly targetType: DogItemTargetType | null;
}

export function renderDogLoadoutEditor({
  mode,
  draft,
  current,
  levelNumber,
  confirming,
  changeTarget = "current",
  itemUses,
}: DogLoadoutEditorRenderOptions): string {
  const isChange = mode === "change";
  const isNextChange = changeTarget === "next";
  const canConfirm = isValidDogLoadout(draft) && (!isChange || !areDogLoadoutsEqual(current, draft));
  const title = isChange ? "更换道具组" : "选择本关道具";
  const intro = isChange
    ? isNextChange
      ? `新道具组将在第 ${levelNumber} 关生效。新组合至少替换一种道具。`
      : `当前道具组将应用于第 ${levelNumber} 关。新组合至少替换一种道具。`
    : `本关棋盘已生成。选择 ${DOG_LOADOUT_SIZE} 种不同道具后确认。`;
  const titleId = `dog-loadout-title-${mode}`;
  const options = DOG_ITEM_DEFINITIONS.map((item) => {
    const selected = draft.includes(item.id);
    const uses = itemUses?.[item.id];
    return `
      <button
        class="dog-loadout-option${selected ? " dog-loadout-option--selected" : ""}"
        type="button"
        data-action="toggle-loadout"
        data-testid="dog-loadout-option"
        data-loadout-id="${item.id}"
        aria-pressed="${selected}"
      >
        <span class="dog-loadout-option__icon" aria-hidden="true">${renderDogItemAsset(item.id)}</span>
        <span class="dog-loadout-option__body">
          <strong>${item.name}</strong>
          <span>${item.description}</span>
          <small>${uses === undefined ? "次数按关卡规则初始化" : `本关 ${uses} 次`}</small>
        </span>
        <span class="dog-loadout-option__check" aria-hidden="true">${selected ? "✓" : ""}</span>
      </button>
    `;
  }).join("");

  const confirmation = confirming
    ? `
        <div class="dog-loadout-confirmation" data-testid="dog-loadout-confirmation" role="alert">
          <strong>确认更换道具组？</strong>
          <p>${isNextChange
            ? `确认后进入第 ${levelNumber} 关，已完成关卡、奖励与解锁保持不变。`
            : "确认后将重置本关局内状态"}</p>
          <div class="dog-loadout-confirmation__actions">
            <button class="text-button" type="button" data-action="cancel-loadout-confirmation">返回修改</button>
            <button class="primary-button" type="button" data-action="apply-loadout-change">确认更换</button>
          </div>
        </div>
      `
    : `
        <div class="dog-loadout-editor__actions">
          <button class="text-button" type="button" data-action="cancel-loadout">${isChange ? "取消" : "清空"}</button>
          <button class="primary-button" type="button" data-action="confirm-loadout" data-testid="dog-loadout-confirm" ${canConfirm ? "" : "disabled"}>
            确认
          </button>
        </div>
      `;

  return `
    <div class="dog-loadout-modal" data-testid="dog-loadout-modal" role="dialog" aria-modal="true" aria-labelledby="${titleId}">
      <div class="dog-loadout-modal__backdrop" aria-hidden="true"></div>
      <section class="dog-loadout" data-testid="dog-loadout-panel" data-mode="${mode}">
        <div class="dog-loadout__heading">
          <div>
            <h3 id="${titleId}">${title}</h3>
            <p>${intro}</p>
          </div>
          <span class="dog-loadout__count" data-testid="dog-loadout-count">${draft.length}/${DOG_LOADOUT_SIZE}</span>
        </div>
        <div class="dog-loadout__options">${options}</div>
        ${confirmation}
      </section>
    </div>
  `;
}

export function renderDogLoadoutSummary(
  loadout: readonly DogItemId[],
  inputLocked = false,
  itemStates: readonly DogLoadoutSummaryItemState[] = [],
  targetState?: DogLoadoutSummaryTargetState,
): string {
  const targetType = targetState?.targetType ?? null;
  const isTargeting = targetType !== null;
  const targetPrompt = isTargeting
    ? `
        <div class="dog-item-targeting" data-testid="dog-item-targeting" role="status">
          <span class="dog-item-targeting__label">选择道具目标</span>
        </div>
      `
    : "";

  return `
    <section
      class="dog-loadout-summary"
      data-testid="dog-loadout-summary"
      data-target-type="${targetType ?? ""}"
      aria-label="当前道具组"
    >
      <div class="dog-loadout-summary__items">
        ${loadout.map((itemId) => {
          const item = getDogItemDefinition(itemId);
          const state = itemStates.find((itemState) => itemState.id === itemId);
          const available = !inputLocked && (state?.available ?? true);
          const remainingUses = state?.remainingUses;
          const remainingLabel = remainingUses === undefined ? "" : `，剩余 ${remainingUses} 次`;
          const usageBadge = remainingUses === undefined
            ? ""
            : `<span class="dog-loadout-thumbnail__uses" data-testid="dog-loadout-thumbnail-uses" aria-hidden="true">${remainingUses}</span>`;
          return `<button
            class="dog-loadout-thumbnail${available ? "" : " dog-loadout-thumbnail--unavailable"}"
            type="button"
            data-action="use-item"
            data-item-id="${itemId}"
            data-item-target-type="${item.targetType}"
            data-item-feedback="${item.visualFeedback}"
            data-testid="dog-loadout-thumbnail"
            data-loadout-id="${itemId}"
            data-item-available="${available}"
            aria-label="${item.name}${remainingLabel}"
            ${available ? "" : "disabled"}
          >
            <span class="dog-loadout-thumbnail__icon" aria-hidden="true">${renderDogItemAsset(item.id)}</span>
            ${usageBadge}
          </button>`;
        }).join("")}
      </div>
      <div class="dog-loadout-summary__actions" data-testid="dog-loadout-actions">
        ${targetType === null
          ? ""
          : '<button class="text-button dog-loadout-summary__cancel" type="button" data-action="cancel-item-target">取消</button>'}
        <button class="text-button dog-loadout-summary__edit" type="button" data-action="edit-loadout" data-testid="dog-edit-loadout" ${inputLocked ? "disabled" : ""}>变更</button>
      </div>
      ${targetPrompt}
    </section>
  `;
}
