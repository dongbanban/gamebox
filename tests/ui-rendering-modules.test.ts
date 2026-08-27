// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { FIRST_LEVEL, type DogBlock } from "@/games/dog-lege-dog";
import { getDogPatternAssetUrl } from "@/games/dog-lege-dog/assets/game-assets";
import { renderDogItemAsset } from "@/games/dog-lege-dog/assets/item-assets";
import {
  DOG_V13_CONFIG,
  type DogV13Config,
} from "@/games/dog-lege-dog/game/game-config";
import { renderDogBlock } from "@/games/dog-lege-dog/game/game-renderer-blocks";
import {
  renderDogSpecialMechanismModal,
  renderDogSpecialMechanismThumbnail,
} from "@/games/dog-lege-dog/game/game-renderer-mechanisms";
import { renderDogTraySlots } from "@/games/dog-lege-dog/game/game-renderer-tray";
import {
  renderDogLoadoutEditor,
  renderDogLoadoutSummary,
} from "@/games/dog-lege-dog/game/dog-loadout";
import { renderRegistrationView } from "@/app/app-views";
import { startDogLegeDogGame } from "@/games/dog-lege-dog";

describe("狗了个狗 UI rendering seams", () => {
  it("renders ordinary and mechanism blocks through independent block seam", () => {
    const ordinaryBlock = createBlock("ordinary", "傻狗");
    const illusionBlock = createBlock("illusion", "傻狗", {
      type: "illusion",
      state: { status: "disguised", disguisedPatternType: "打工狗" },
    });
    const twinBlock = createBlock("twin", "傻狗", {
      type: "twin",
      state: { status: "twin" },
    });

    const ordinary = renderDogBlock(ordinaryBlock, createBlockRenderOptions(ordinaryBlock));
    const illusion = renderDogBlock(illusionBlock, createBlockRenderOptions(illusionBlock));
    const twin = renderDogBlock(twinBlock, createBlockRenderOptions(twinBlock));

    expect(ordinary).toContain('data-block-id="ordinary"');
    expect(ordinary).toContain("dog-block--silly-dog");
    expect(ordinary).toContain("dog-block--board");
    expect(ordinary).not.toContain("data-special-mechanism=");
    expect(illusion).toContain('data-special-mechanism="illusion"');
    expect(illusion).toContain("data-disguised-pattern-type=\"打工狗\"");
    expect(illusion).toContain("dog-block--board");
    expect(illusion).toContain("dog-block__glyph--fuzzy");
    expect(twin).toContain('data-special-mechanism="twin"');
    expect(twin).toContain("dog-block--board");
    expect(twin).toContain("dog-block--special-twin");
  });

  it("renders tray slots and mechanism thumbnails without app lifecycle", () => {
    const game = startDogLegeDogGame(document.createElement("div"), {
      runSeed: "ui-rendering-seam",
    });
    const session = game.getState().session;
    const tray = renderDogTraySlots(session);
    const twinBlock = createBlock("twin", "单身狗", {
      type: "twin",
      state: { status: "twin" },
    });
    const illusionBlock = createBlock("illusion", "傻狗", {
      type: "illusion",
      state: { status: "masked", disguisedPatternType: "打工狗" },
    });
    const thumbnail = renderDogSpecialMechanismThumbnail(twinBlock);
    const illusionThumbnail = renderDogSpecialMechanismThumbnail(illusionBlock);

    expect(tray.match(/data-testid="dog-tray-slot"/g)).toHaveLength(session.trayCapacity);
    expect(tray).toContain('data-slot-state="empty"');
    expect(thumbnail).toContain('data-testid="dog-special-mechanism-thumbnail"');
    expect(thumbnail).toContain('data-special-mechanism="twin"');
    expect(thumbnail).toContain("dog-block--single-dog");
    expect(thumbnail).not.toContain("dog-block--special-twin");
    expect(thumbnail).toContain("dog-block--mechanism-preview");
    expect(illusionThumbnail).toContain('data-special-mechanism="illusion"');
    expect(illusionThumbnail).toContain("dog-block--silly-dog");
    expect(illusionThumbnail).not.toContain("dog-block--working-dog");
    expect(illusionThumbnail).not.toContain("dog-block--special-illusion");
    expect(illusionThumbnail).not.toContain("dog-block__glyph--fuzzy");
    expect(illusionThumbnail).not.toContain("--dog-illusion-image");

    game.destroy();
  });

  it("reads visual and mechanism copy from v13 UI config", () => {
    const config = createUiConfig();
    const block = createBlock("configured", "傻狗");
    const markup = renderDogBlock(block, {
      ...createBlockRenderOptions(block),
      config,
    });
    const modal = renderDogSpecialMechanismModal(FIRST_LEVEL, config);

    expect(markup).toContain("--block-width: 64px");
    expect(modal).toContain("定制机制说明");
  });

  it("keeps app-facing assets and loadout copy on the config seam", () => {
    const config = createUiConfig();
    const registration = renderRegistrationView(
      { state: null, persistence: "persistent", warning: null },
      {
        ...config,
        ui: {
          ...config.ui,
          copy: {
            ...config.ui.copy,
            app: {
              ...config.ui.copy.app,
              registrationTitle: "定制注册标题",
            },
          },
        },
      },
    );
    const editor = renderDogLoadoutEditor({
      mode: "initial",
      draft: ["key"],
      current: null,
      levelNumber: 1,
      confirming: false,
      config,
    });
    const summary = renderDogLoadoutSummary(["key"], false, [], undefined, false, config);

    expect(getDogPatternAssetUrl("傻狗", config)).toContain("custom-silly-dog.svg");
    expect(renderDogItemAsset("key", config)).toContain("custom-key.svg");
    expect(editor).toContain("定制道具选择");
    expect(editor).toContain("定制钥匙");
    expect(summary).toContain("定制道具组");
    expect(registration).toContain("定制注册标题");
  });
});

function createUiConfig(): DogV13Config {
  return {
    ...DOG_V13_CONFIG,
    ui: {
      ...DOG_V13_CONFIG.ui,
      visual: {
        ...DOG_V13_CONFIG.ui.visual,
        blockSizePx: 64,
      },
      copy: {
        ...DOG_V13_CONFIG.ui.copy,
        loadout: {
          ...DOG_V13_CONFIG.ui.copy.loadout,
          initialTitle: "定制道具选择",
          summaryAriaLabel: "定制道具组",
        },
        items: {
          ...DOG_V13_CONFIG.ui.copy.items,
          key: {
            ...DOG_V13_CONFIG.ui.copy.items.key,
            name: "定制钥匙",
          },
        },
        specialMechanisms: {
          ...DOG_V13_CONFIG.ui.copy.specialMechanisms,
          title: "定制机制说明",
        },
      },
    },
    assets: {
      ...DOG_V13_CONFIG.assets,
      patterns: {
        ...DOG_V13_CONFIG.assets.patterns,
        傻狗: "custom-silly-dog.svg",
      },
      items: {
        ...DOG_V13_CONFIG.assets.items,
        key: "custom-key.svg",
      },
    },
  };
}

function createBlock(
  id: string,
  patternType: DogBlock["patternType"],
  specialMechanism?: DogBlock["specialMechanism"],
): DogBlock {
  const source = FIRST_LEVEL.blocks[0];
  if (source === undefined) {
    throw new Error("FIRST_LEVEL must contain a block");
  }

  return {
    ...source,
    id,
    patternType,
    ...(specialMechanism === undefined ? {} : { specialMechanism }),
  };
}

function createBlockRenderOptions(block: DogBlock) {
  return {
    boardPixelWidth: FIRST_LEVEL.board.width * 12,
    boardPixelHeight: FIRST_LEVEL.board.height * 12,
    selectableBlockIds: [block.id],
    inputLocked: false,
    itemTargetType: null,
    itemTargetId: null,
    targetBlockIds: [],
  } as const;
}
