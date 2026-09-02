import {
  DOG_V13_ITEM_COPY_KEYS,
  DOG_V13_SCHEMA_VERSION,
  type DogConfigChangeArea,
  type DogV13Config,
  type DogV13DifficultyTarget,
  type DogV13ItemId,
  type DogV13MechanismType,
  type DogV13TestProfile,
} from "@/games/dog-lege-dog/game/v13-config-types";
import { DOG_PATTERN_TYPES, type DogPatternType } from "@/games/dog-lege-dog/levels/level-types";
import DOG_V13_TEST_PROFILES_JSON from "@/games/dog-lege-dog/game/v13-test-profiles.json";

const PATTERN_ASSET_PATHS: Readonly<Record<DogPatternType, string>> = {
  打工狗: "assets/dog-icons-square/01-working-dog.svg",
  单身狗: "assets/dog-icons-square/02-single-dog.svg",
  舔狗: "assets/dog-icons-square/03-licking-dog.svg",
  看门狗: "assets/dog-icons-square/04-guard-dog.svg",
  疯狗: "assets/dog-icons-square/05-mad-dog.svg",
  拆家狗: "assets/dog-icons-square/06-destructive-dog.svg",
  龇牙狗: "assets/dog-icons-square/07-snarling-dog.svg",
  社恐狗: "assets/dog-icons-square/08-shy-dog.svg",
  吃货狗: "assets/dog-icons-square/09-foodie-dog.svg",
  傻狗: "assets/dog-icons-square/10-silly-dog.svg",
};

const ITEM_ASSET_PATHS: Readonly<Record<DogV13ItemId, string>> = {
  "triple-removal": "assets/dog-item-icons/triple-removal.svg",
  "tray-capacity": "assets/dog-item-icons/tray-capacity-plus-one.svg",
  wildcard: "assets/dog-item-icons/wildcard.svg",
  torch: "assets/dog-item-icons/torch.svg",
  detector: "assets/dog-item-icons/detector.svg",
  demagnetizer: "assets/dog-item-icons/demagnetizer.svg",
  key: "assets/dog-item-icons/key.svg",
  "restore-whistle": "assets/dog-item-icons/restore-whistle.svg",
};

export const SUPPORTED_ITEM_IDS: readonly DogV13ItemId[] = DOG_V13_ITEM_COPY_KEYS;

const DIFFICULTY_TARGETS: readonly DogV13DifficultyTarget[] = [
  createDifficultyTarget(1, 2, [0.18, 0.28], [9, 10], [0.78, 0.98]),
  createDifficultyTarget(3, 4, [0.1, 0.28], [9, 10], [0.78, 1]),
  createDifficultyTarget(5, 5, [0.08, 0.24], [9.8, 10.8], [0.8, 1]),
  createDifficultyTarget(6, 6, [0.06, 0.23], [10, 11.2], [0.82, 1]),
  createDifficultyTarget(7, 14, [0.05, 0.22], [10.3, 11.6], [0.83, 1]),
  createDifficultyTarget(15, 15, [0.04, 0.22], [10.5, 11.8], [0.84, 1]),
  createDifficultyTarget(16, 16, [0.02, 0.21], [11, 12.5], [0.85, 1]),
  createDifficultyTarget(17, 29, [0.015, 0.2], [11.5, 13.5], [0.86, 1]),
  createDifficultyTarget(30, 30, [0.01, 0.19], [12, 14], [0.87, 1]),
  createDifficultyTarget(31, 99, [0.01, 0.18], [13, 16], [0.88, 1]),
];

const DOG_V13_TEST_PROFILES_SOURCE =
  DOG_V13_TEST_PROFILES_JSON as unknown as DogV13Config["testProfiles"];

export const DOG_V13_CONFIG_SOURCE: DogV13Config = {
  schemaVersion: DOG_V13_SCHEMA_VERSION,
  game: {
    id: "dog-lege-dog",
    firstLevelNumber: 1,
    maxLevelNumber: 99,
    generatorVersion: 13,
    defaultReward: 100,
  },
  generation: {
    preferWorker: true,
    workerTimeoutMs: 30_000,
    preGenerateNextLevel: true,
    verifyReplayBeforePublish: true,
  },
  board: {
    shape: "irregular",
    logicalCellSize: 4,
    blockWidth: 4,
    blockHeight: 4,
    maxMechanismsPerBlock: 1,
  },
  levels: {
    firstLevelNumber: 1,
    maxLevelNumber: 99,
    logicalBlockCount: {
      start: 90,
      increment: 18,
      incrementEveryLevels: 5,
      cap: 180,
    },
    structureStages: [
      { minLevel: 1, maxLevel: 5, maxLayers: 3, patternTypeCount: 6 },
      { minLevel: 6, maxLevel: 15, maxLayers: 4, patternTypeCount: 8 },
      { minLevel: 16, maxLevel: 30, maxLayers: 5, patternTypeCount: 10 },
      { minLevel: 31, maxLevel: 99, maxLayers: 6, patternTypeCount: 10 },
    ],
  },
  tray: {
    baseCapacity: 7,
    maxCapacity: 8,
    maxLockedSlotCount: 2,
    lockedSlotPlacement: "right",
  },
  items: {
    ids: [
      "triple-removal",
      "tray-capacity",
      "wildcard",
      "torch",
      "detector",
      "demagnetizer",
      "key",
      "restore-whistle",
    ],
    loadoutSize: 3,
    defaultUsesPerLevel: 1,
    maxSuccessfulUsesPerLevel: 1,
    key: {
      id: "key",
      initialUses: 0,
      usesCappedByLockedSlots: true,
      dropRate: 0.3,
    },
  },
  specialMechanisms: {
    logicalBudgetRatio: 0.3,
    budgetRounding: "floor",
    remainderStrategy: "stable-round-robin",
    requireAllTypes: true,
    freezeMeltTripleCount: 2,
    shuffle: {
      enabled: true,
      firstLevelNumber: 3,
      maxPerLevel: 1,
      candidateCount: 8,
      threshold: {
        maxLogicalUnitCount: 5,
        capacityBuffer: 2,
      },
    },
    mechanisms: [
      { type: "freeze", logicalUnitWeight: 1, operationCost: 2 },
      { type: "illusion", logicalUnitWeight: 1, operationCost: 1 },
      { type: "magnetic", logicalUnitWeight: 1, operationCost: 1 },
      { type: "twin", logicalUnitWeight: 2, operationCost: 1 },
      { type: "shuffle", logicalUnitWeight: 1, operationCost: 1 },
    ],
  },
  difficulty: {
    targets: DIFFICULTY_TARGETS,
    scoring: {
      trayPressure: {
        occupancyWeight: 0.88,
        choicePressureWeight: 0.12,
      },
      operationCost: {
        magneticTargetWeight: 1,
      },
      duration: {
        operationCostWeight: 0.2,
        lockWeight: 0.15,
      },
      mistakeRisk: {
        base: 0.15,
        choiceWeight: 0.35,
        trayPressureWeight: 0.25,
        operationCostWeight: 0.15,
        lockWeight: 0.1,
      },
    },
  },
  animation: {
    blockFlightMs: 180,
    illusionRevealMs: 420,
    itemFeedbackMs: 360,
    freezeMeltMs: 1400,
    twinSplitMs: 360,
    magneticAttractionMs: 360,
    keyDropMs: 360,
    trayUnlockMs: 360,
    shuffleArmedMs: 1800,
    shuffleTriggerableMs: 1200,
    inputLockedDuringAnimation: true,
  },
  assets: {
    patterns: PATTERN_ASSET_PATHS,
    items: ITEM_ASSET_PATHS,
    music: "audio/levelmusicloop-tigrun.ogg",
  },
  audio: {
    music: {
      path: "audio/levelmusicloop-tigrun.ogg",
      volume: 0.1,
    },
    effects: {
      select: {
        frequencies: [660, 880],
        durationSeconds: 0.14,
        waveform: "triangle",
        volume: 0.16,
        noteSpacingSeconds: 0.035,
      },
      match: {
        frequencies: [523, 659, 784, 1046],
        durationSeconds: 0.4,
        waveform: "sine",
        volume: 0.3,
        noteSpacingSeconds: 0.055,
      },
      won: {
        frequencies: [659, 784, 988, 1318],
        durationSeconds: 0.5,
        waveform: "sine",
        volume: 0.22,
        noteSpacingSeconds: 0.07,
      },
      lost: {
        frequencies: [220, 174],
        durationSeconds: 0.32,
        waveform: "sawtooth",
        volume: 0.12,
        noteSpacingSeconds: 0.08,
      },
    },
  },
  ui: {
    visual: {
      blockSizePx: 48,
      boardSafeMarginPx: 12,
      keyDropSizePx: 42,
      magneticEffectHeightPx: 32,
      flightTargetScale: 0.48,
    },
    copy: {
      app: {
        brandName: "GAMEBOX",
        registrationTitle: "开始你的第一局",
        registrationIntro: "一次点击创建本地匿名身份，游戏进度只保存在当前浏览器。",
        register: "匿名注册",
        registrationFinePrint: "不需要姓名、密码或邮箱。",
        catalogTitle: "游戏目录",
        reset: "重置本地数据",
        catalogAriaLabel: "游戏目录",
        highestUnlockedLevel: "最高解锁关卡",
        startGame: "开始游戏",
        activeGame: "活动游戏",
        returnCatalog: "返回游戏目录",
        soundEnabled: "音效开启",
        soundDisabled: "音效关闭",
        persistenceSaved: "进度已保存。",
        persistenceTemporary: "当前为临时运行模式，刷新后进度可能丢失。",
        resetConfirmation: "确认重置本地数据？用户、游戏进度、积分与应用设置都会被清除。",
        leaveConfirmation: "当前关卡不会保存，确认离开？",
        generation: {
          loadingTitle: "正在生成第 {levelNumber} 关",
          loadingDescription: "正在验证棋盘结构、特殊机制、可解性与难度。",
          errorTitle: "关卡生成失败",
          errorDescription: "未展示未验证棋盘。可沿用本次 runSeed 重新生成。",
          retry: "重新生成",
          runSeed: "runSeed",
          generatorVersion: "生成器版本",
          workerFailure: "Worker 诊断",
          fallbackFailure: "同步重试诊断",
        },
        result: {
          completedLevel: "完成关卡",
          finalReward: "最终奖励",
          totalScore: "累计积分",
          finalTitle: "最终称号",
          finalTitleValue: "最狗玩家",
          currentLevel: "当前关卡",
          reward: "通关奖励",
          nextLevel: "下一关",
        },
        actions: {
          loadout: "更换道具组",
          nextLevel: "进入下一关",
          retry: "重新挑战",
          replayCurrentLevel: "重玩本关",
        },
      },
      labels: {
        level: "关卡",
        activeLevel: "当前关卡",
        specialMechanism: "查看本关特殊机制",
        board: "第 {level} 关矩形棋盘，{blockCount} 个层叠方块",
        blockSelectable: "可选择方块",
        itemTarget: "选择道具目标",
        tray: "暂存槽",
        lockedTraySlot: "已锁定暂存槽",
        emptyTraySlot: "空暂存槽",
        wildcard: "万能方块",
        match: "三消成功",
        status: {
          won: "通关！棋盘已清空。",
          lost: "失败！暂存槽已满。",
        },
      },
      loadout: {
        initialTitle: "选择本关道具",
        changeTitle: "更换道具组",
        initialIntro: "本关棋盘已生成。选择 {loadoutSize} 种不同道具后确认。",
        changeCurrentIntro: "当前道具组将应用于第 {levelNumber} 关。新组合至少替换一种道具。",
        changeNextIntro: "新道具组将在第 {levelNumber} 关生效。新组合至少替换一种道具。",
        usesFallback: "次数按关卡规则初始化",
        usesPerLevel: "本关 {uses} 次",
        confirmationTitle: "确认更换道具组？",
        confirmationNext: "确认后进入第 {levelNumber} 关，已完成关卡、奖励与解锁保持不变。",
        confirmationCurrent: "确认后将重置本关局内状态",
        cancel: "取消",
        clear: "清空",
        confirm: "确认",
        summaryAriaLabel: "当前道具组",
        edit: "变更",
        targetPrompt: "选择道具目标",
        remainingUses: "，剩余 {uses} 次",
      },
      items: {
        "triple-removal": {
          name: "道具三消移除",
          icon: "✦",
          description: "选择槽内相邻方块并一次移除",
        },
        "tray-capacity": {
          name: "暂存槽容量提升",
          icon: "+1",
          description: "当前关卡暂存槽增加 1 格",
        },
        wildcard: {
          name: "万能方块",
          icon: "◇",
          description: "点击槽内方块复制其图案",
        },
        torch: {
          name: "火把",
          icon: "火",
          description: "融化一个冻结方块",
        },
        detector: {
          name: "检测仪",
          icon: "⌕",
          description: "揭示一个幻化方块",
        },
        demagnetizer: {
          name: "消磁仪",
          icon: "⊖",
          description: "移除一个磁吸方块的磁性",
        },
        key: {
          name: "钥匙",
          icon: "⚿",
          description: "解锁一个暂存槽",
        },
        "restore-whistle": {
          name: "复原哨",
          icon: "哨",
          description: "复原最近一次安全乱序",
        },
      },
      specialMechanisms: {
        title: "本关特殊机制",
        hint: "无需使用道具也可应对本关机制。",
        empty: "本关暂无特殊机制。",
        closeLabel: "关闭特殊机制说明",
        fallbackDescription: "本关包含特殊规则，请结合棋盘上的视觉提示操作。",
        presentations: {
          freeze: {
            name: "冻结方块",
            description: "冻结方块进入暂存槽后暂不参与三消；其后的成功三消累计 2 次后自动融化。火把可将其解冻为普通方块，万能方块可直接消除。",
          },
          illusion: {
            name: "幻化方块",
            description: "幻化方块点击后先飞入暂存槽，入槽完成后显现真实图案并按真实图案参与三消。",
          },
          magnetic: {
            name: "磁吸方块",
            description: "磁吸方块进入暂存槽后随机吸取一个不同真实图案的方块；优先可点击目标，不产生连锁磁吸。",
          },
          twin: {
            name: "双生方块",
            description: "双生方块点击后分裂为两个相邻的普通方块，各占一个暂存槽单位并按普通顺序参与三消。",
          },
          shuffle: {
            name: "乱序方块",
            description: "乱序方块入槽并完成首次结算后进入待乱序；暂存槽达到当前阈值时交给安全乱序流程。",
            stateLabels: {
              dormant: "未激活",
              armed: "待乱序",
              triggerable: "可触发乱序",
              consumed: "已消耗",
            },
          },
        },
      },
      result: {
        won: {
          eyebrow: "狗了个狗 · 关卡结果",
          title: "通关！",
          description: "完成。",
        },
        final: {
          eyebrow: "狗了个狗 · 最终通关",
          title: "你就是最狗的玩家",
          description: "全部 99 关完成。",
        },
        lost: {
          eyebrow: "狗了个狗 · 关卡结果",
          title: "失败",
          description: "暂存槽已满，进度未改变。",
        },
      },
    },
    particles: {
      match: {
        durationMs: 420,
        count: 20,
        colors: ["#ffffff", "#ffd166", "#ff6f91", "#52d6c6", "#7bc7f5"],
      },
      won: {
        durationMs: 560,
        count: 28,
        colors: ["#ffd166", "#63b88a", "#7bc7f5", "#ffffff"],
      },
      lost: {
        durationMs: 380,
        count: 16,
        colors: ["#ff8c7a", "#d86556", "#16445d"],
      },
    },
  },
  testProfiles: DOG_V13_TEST_PROFILES_SOURCE,
};

function createDifficultyTarget(
  minLevel: number,
  maxLevel: number,
  safeChoiceRate: readonly [number, number],
  durationMinutes: readonly [number, number],
  trayPeakPressure: readonly [number, number],
): DogV13DifficultyTarget {
  return {
    minLevel,
    maxLevel,
    safeChoiceCount: { min: 1, max: Number.MAX_SAFE_INTEGER },
    safeChoiceRate: { min: safeChoiceRate[0], max: safeChoiceRate[1] },
    durationMinutes: { min: durationMinutes[0], max: durationMinutes[1] },
    trayPeakPressure: { min: trayPeakPressure[0], max: trayPeakPressure[1] },
    mechanismDensity: { min: 0.29, max: 0.3 },
    operationCost: { min: 0.3, max: 1 },
    mistakeRisk: { min: 0.1, max: 0.99 },
  };
}
