import {
  DOG_PATTERN_TYPES,
  type DogPatternType,
} from "@/games/dog-lege-dog/levels/level-types";
import DOG_V13_TEST_PROFILES_JSON from "@/games/dog-lege-dog/game/v13-test-profiles.json";

export const DOG_V13_SCHEMA_VERSION = 13 as const;

export type DogV13MechanismType = "freeze" | "illusion" | "magnetic" | "twin";

export type DogV13ParticleEffectName = "match" | "won" | "lost";

export type DogV13ItemId =
  | "triple-removal"
  | "tray-capacity"
  | "wildcard"
  | "torch"
  | "detector"
  | "demagnetizer"
  | "key";

const DOG_V13_ITEM_COPY_KEYS: readonly DogV13ItemId[] = [
  "triple-removal",
  "tray-capacity",
  "wildcard",
  "torch",
  "detector",
  "demagnetizer",
  "key",
];

export type DogV13TestProfileName = "focused" | "smoke" | "full";

export type DogConfigChangeArea =
  | "docs"
  | "ui"
  | "runtime"
  | "generator"
  | "solvability"
  | "difficulty"
  | "public-contract"
  | "game-startup"
  | "worker"
  | "random-regression"
  | "cross-browser";

export interface DogV13Range {
  readonly min: number;
  readonly max: number;
}

export interface DogV13StructureStage {
  readonly minLevel: number;
  readonly maxLevel: number;
  readonly maxLayers: number;
  readonly patternTypeCount: number;
}

export interface DogV13MechanismDefinition {
  readonly type: DogV13MechanismType;
  readonly logicalUnitWeight: 1 | 2;
}

export interface DogV13DifficultyTarget {
  readonly minLevel: number;
  readonly maxLevel: number;
  readonly safeChoiceCount: DogV13Range;
  readonly safeChoiceRate: DogV13Range;
  readonly durationMinutes: DogV13Range;
  readonly trayPeakPressure: DogV13Range;
  readonly mechanismDensity: DogV13Range;
  readonly operationCost: DogV13Range;
  readonly mistakeRisk: DogV13Range;
}

export type DogV13SoundWaveform = "sine" | "square" | "sawtooth" | "triangle";

export interface DogV13SoundEffectProfile {
  readonly frequencies: readonly number[];
  readonly durationSeconds: number;
  readonly waveform: DogV13SoundWaveform;
  readonly volume: number;
  readonly noteSpacingSeconds: number;
}

export interface DogV13MechanismPresentation {
  readonly name: string;
  readonly description: string;
}

export interface DogV13ResultDisplay {
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
}

export interface DogV13ParticleEffectProfile {
  readonly durationMs: number;
  readonly count: number;
  readonly colors: readonly string[];
}

export interface DogV13ItemCopy {
  readonly name: string;
  readonly icon: string;
  readonly description: string;
}

export interface DogV13AppCopy {
  readonly brandName: string;
  readonly registrationTitle: string;
  readonly registrationIntro: string;
  readonly register: string;
  readonly registrationFinePrint: string;
  readonly catalogTitle: string;
  readonly reset: string;
  readonly catalogAriaLabel: string;
  readonly highestUnlockedLevel: string;
  readonly startGame: string;
  readonly activeGame: string;
  readonly returnCatalog: string;
  readonly soundEnabled: string;
  readonly soundDisabled: string;
  readonly persistenceSaved: string;
  readonly persistenceTemporary: string;
  readonly resetConfirmation: string;
  readonly leaveConfirmation: string;
  readonly result: {
    readonly completedLevel: string;
    readonly finalReward: string;
    readonly totalScore: string;
    readonly finalTitle: string;
    readonly finalTitleValue: string;
    readonly currentLevel: string;
    readonly reward: string;
    readonly nextLevel: string;
  };
  readonly actions: {
    readonly loadout: string;
    readonly nextLevel: string;
    readonly retry: string;
  };
}

export interface DogV13LoadoutCopy {
  readonly initialTitle: string;
  readonly changeTitle: string;
  readonly initialIntro: string;
  readonly changeCurrentIntro: string;
  readonly changeNextIntro: string;
  readonly usesFallback: string;
  readonly usesPerLevel: string;
  readonly confirmationTitle: string;
  readonly confirmationNext: string;
  readonly confirmationCurrent: string;
  readonly cancel: string;
  readonly clear: string;
  readonly confirm: string;
  readonly summaryAriaLabel: string;
  readonly edit: string;
  readonly targetPrompt: string;
  readonly remainingUses: string;
}

export interface DogV13TestProfile {
  readonly name: DogV13TestProfileName;
  readonly levelNumbers: readonly number[];
  readonly fixedSeeds: readonly string[];
  readonly randomLevelPrefix: number;
  readonly stressLevelCount: number;
  readonly runUI: boolean;
  readonly runCore: boolean;
  readonly runRandomRegression: boolean;
  readonly runE2E: boolean;
  readonly runCrossBrowser: boolean;
  readonly runWorkerFallback: boolean;
  readonly runBuild: boolean;
  readonly runDiffCheck: boolean;
  readonly runFileLineCheck: boolean;
  readonly maxChangedFileLines: number;
}

const DOG_V13_TEST_PROFILES_SOURCE =
  DOG_V13_TEST_PROFILES_JSON as unknown as DogV13Config["testProfiles"];

export interface DogV13Config {
  readonly schemaVersion: typeof DOG_V13_SCHEMA_VERSION;
  readonly game: {
    readonly id: "dog-lege-dog";
    readonly firstLevelNumber: 1;
    readonly maxLevelNumber: 99;
    readonly generatorVersion: 13;
    readonly defaultSeed: string;
    readonly defaultReward: number;
  };
  readonly firstLevel: {
    readonly seed: string;
    readonly blockCount: 90;
    readonly maxLayers: 3;
    readonly patternTypes: readonly DogPatternType[];
    readonly templateId: string;
  };
  readonly board: {
    readonly shape: "irregular";
    readonly logicalCellSize: 4;
    readonly blockWidth: 4;
    readonly blockHeight: 4;
    readonly maxMechanismsPerBlock: 1;
  };
  readonly levels: {
    readonly firstLevelNumber: 1;
    readonly maxLevelNumber: 99;
    readonly logicalBlockCount: {
      readonly start: 90;
      readonly increment: 18;
      readonly incrementEveryLevels: 5;
      readonly cap: 180;
    };
    readonly structureStages: readonly DogV13StructureStage[];
  };
  readonly tray: {
    readonly baseCapacity: 7;
    readonly maxCapacity: 8;
    readonly maxLockedSlotCount: 2;
    readonly lockedSlotPlacement: "right";
  };
  readonly items: {
    readonly ids: readonly DogV13ItemId[];
    readonly loadoutSize: 3;
    readonly defaultUsesPerLevel: 1;
    readonly maxSuccessfulUsesPerLevel: 1;
    readonly key: {
      readonly id: "key";
      readonly initialUses: 0;
      readonly usesCappedByLockedSlots: true;
      readonly dropRate: number;
    };
  };
  readonly specialMechanisms: {
    readonly logicalBudgetRatio: 0.3;
    readonly budgetRounding: "floor";
    readonly remainderStrategy: "stable-round-robin";
    readonly requireAllTypes: true;
    readonly freezeMeltTripleCount: number;
    readonly mechanisms: readonly DogV13MechanismDefinition[];
  };
  readonly difficulty: {
    readonly targets: readonly DogV13DifficultyTarget[];
  };
  readonly animation: {
    readonly blockFlightMs: number;
    readonly illusionRevealMs: number;
    readonly itemFeedbackMs: number;
    readonly freezeMeltMs: number;
    readonly twinSplitMs: number;
    readonly magneticAttractionMs: number;
    readonly keyDropMs: number;
    readonly trayUnlockMs: number;
    readonly inputLockedDuringAnimation: true;
  };
  readonly assets: {
    readonly patterns: Readonly<Record<DogPatternType, string>>;
    readonly items: Readonly<Record<DogV13ItemId, string>>;
    readonly music: string;
  };
  readonly audio: {
    readonly music: {
      readonly path: string;
      readonly volume: number;
    };
    readonly effects: Readonly<Record<string, DogV13SoundEffectProfile>>;
  };
  readonly ui: {
    readonly visual: {
      readonly blockSizePx: number;
      readonly boardSafeMarginPx: number;
      readonly keyDropSizePx: number;
      readonly magneticEffectHeightPx: number;
      readonly flightTargetScale: number;
    };
    readonly copy: {
      readonly app: DogV13AppCopy;
      readonly labels: {
        readonly level: string;
        readonly activeLevel: string;
        readonly specialMechanism: string;
        readonly board: string;
        readonly blockSelectable: string;
        readonly itemTarget: string;
        readonly tray: string;
        readonly lockedTraySlot: string;
        readonly emptyTraySlot: string;
        readonly wildcard: string;
        readonly match: string;
        readonly status: {
          readonly won: string;
          readonly lost: string;
        };
      };
      readonly loadout: DogV13LoadoutCopy;
      readonly items: Readonly<Record<DogV13ItemId, DogV13ItemCopy>>;
      readonly specialMechanisms: {
        readonly title: string;
        readonly hint: string;
        readonly empty: string;
        readonly closeLabel: string;
        readonly fallbackDescription: string;
        readonly presentations: Readonly<Record<DogV13MechanismType, DogV13MechanismPresentation>>;
      };
      readonly result: Readonly<Record<"won" | "final" | "lost", DogV13ResultDisplay>>;
    };
    readonly particles: Readonly<Record<DogV13ParticleEffectName, DogV13ParticleEffectProfile>>;
  };
  readonly testProfiles: {
    readonly default: DogV13TestProfileName;
    readonly selection: {
      readonly fullAreas: readonly DogConfigChangeArea[];
      readonly smokeAreas: readonly DogConfigChangeArea[];
    };
    readonly profiles: Readonly<Record<DogV13TestProfileName, DogV13TestProfile>>;
  };
}

export interface DogV13ConfigIssue {
  readonly path: string;
  readonly code: "required" | "type" | "range" | "value" | "duplicate" | "relation";
  readonly message: string;
}

export class DogV13ConfigError extends Error {
  readonly issues: readonly DogV13ConfigIssue[];

  constructor(issues: readonly DogV13ConfigIssue[]) {
    super(
      `狗了个狗 v13 配置无效：${issues
        .map((issue) => `${issue.path}（${issue.message}）`)
        .join("；")}`,
    );
    this.name = "DogV13ConfigError";
    this.issues = Object.freeze([...issues]);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

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
};

const SUPPORTED_ITEM_IDS: readonly DogV13ItemId[] = [
  "triple-removal",
  "tray-capacity",
  "wildcard",
  "torch",
  "detector",
  "demagnetizer",
  "key",
];

const DIFFICULTY_TARGETS: readonly DogV13DifficultyTarget[] = [
  createDifficultyTarget(1, 4, [0.18, 0.28], [9, 10], [0.78, 0.98]),
  createDifficultyTarget(5, 5, [0.16, 0.24], [9.8, 10.8], [0.8, 0.99]),
  createDifficultyTarget(6, 6, [0.15, 0.23], [10, 11.2], [0.82, 0.99]),
  createDifficultyTarget(7, 14, [0.14, 0.22], [10.3, 11.6], [0.83, 0.99]),
  createDifficultyTarget(15, 15, [0.14, 0.22], [10.5, 11.8], [0.84, 0.99]),
  createDifficultyTarget(16, 16, [0.13, 0.21], [11, 12.5], [0.85, 0.99]),
  createDifficultyTarget(17, 29, [0.12, 0.2], [11.5, 13.5], [0.86, 0.99]),
  createDifficultyTarget(30, 30, [0.11, 0.19], [12, 14], [0.87, 0.99]),
  createDifficultyTarget(31, 99, [0.09, 0.18], [13, 16], [0.88, 0.99]),
];

const DOG_V13_CONFIG_SOURCE: DogV13Config = {
  schemaVersion: DOG_V13_SCHEMA_VERSION,
  game: {
    id: "dog-lege-dog",
    firstLevelNumber: 1,
    maxLevelNumber: 99,
    generatorVersion: 13,
    defaultSeed: "dog-lege-dog",
    defaultReward: 100,
  },
  firstLevel: {
    seed: "dog-lege-dog:first-level:v9",
    blockCount: 90,
    maxLayers: 3,
    patternTypes: ["打工狗", "单身狗", "舔狗", "看门狗", "疯狗", "拆家狗"],
    templateId: "irregular-first-level-v2",
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
    mechanisms: [
      { type: "freeze", logicalUnitWeight: 1 },
      { type: "illusion", logicalUnitWeight: 1 },
      { type: "magnetic", logicalUnitWeight: 1 },
      { type: "twin", logicalUnitWeight: 2 },
    ],
  },
  difficulty: {
    targets: DIFFICULTY_TARGETS,
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
            description: "幻化方块点击后飞入暂存槽，飞行过程中显现真实图案并按真实图案参与三消。",
          },
          magnetic: {
            name: "磁吸方块",
            description: "磁吸方块进入暂存槽后随机吸取一个不同真实图案的方块；优先可点击目标，不产生连锁磁吸。",
          },
          twin: {
            name: "双生方块",
            description: "双生方块点击后分裂为两个相邻的普通方块，各占一个暂存槽单位并按普通顺序参与三消。",
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

export function assertDogV13Config(input: unknown): asserts input is DogV13Config {
  const issues = collectConfigIssues(input);
  if (issues.length > 0) {
    throw new DogV13ConfigError(issues);
  }
}

export function validateDogV13Config(input: unknown): DogV13Config {
  assertDogV13Config(input);
  return input;
}

export function getDogV13ConfigIssues(input: unknown): readonly DogV13ConfigIssue[] {
  return Object.freeze(collectConfigIssues(input));
}

export function loadDogV13Config(input: unknown = DOG_V13_CONFIG_SOURCE): DogV13Config {
  validateDogV13Config(input);
  return cloneAndFreeze(input) as DogV13Config;
}

export const DOG_V13_CONFIG = loadDogV13Config();

export function getDogV13LevelStage(
  levelNumber: number,
  config: DogV13Config = DOG_V13_CONFIG,
): DogV13StructureStage {
  validateLevelNumber(levelNumber, config);
  const stage = config.levels.structureStages.find(
    (candidate) => levelNumber >= candidate.minLevel && levelNumber <= candidate.maxLevel,
  );
  if (stage === undefined) {
    throw new Error(`狗了个狗 v13 level stage is unavailable for level ${levelNumber}`);
  }
  return { ...stage };
}

export function getDogV13LevelStageIndex(
  levelNumber: number,
  config: DogV13Config = DOG_V13_CONFIG,
): number {
  validateLevelNumber(levelNumber, config);
  const stageIndex = config.levels.structureStages.findIndex(
    (candidate) => levelNumber >= candidate.minLevel && levelNumber <= candidate.maxLevel,
  );
  if (stageIndex < 0) {
    throw new Error(`狗了个狗 v13 level stage is unavailable for level ${levelNumber}`);
  }
  return stageIndex;
}

export function getDogV13LogicalBlockCount(
  levelNumber: number,
  configOrMapIndex: DogV13Config | number = DOG_V13_CONFIG,
): number {
  const config = typeof configOrMapIndex === "number"
    ? DOG_V13_CONFIG
    : configOrMapIndex;
  validateLevelNumber(levelNumber, config);
  const progression = config.levels.logicalBlockCount;
  return Math.min(
    progression.cap,
    progression.start +
      Math.floor((levelNumber - 1) / progression.incrementEveryLevels) * progression.increment,
  );
}

export function getDogV13SpecialMechanismBudget(
  logicalBlockCount: number,
  configOrMapIndex: DogV13Config | number = DOG_V13_CONFIG,
): number {
  const config = typeof configOrMapIndex === "number"
    ? DOG_V13_CONFIG
    : configOrMapIndex;
  if (!Number.isSafeInteger(logicalBlockCount) || logicalBlockCount < 0) {
    throw new Error("狗了个狗 v13 logical block count must be a non-negative integer");
  }
  const { logicalBudgetRatio, budgetRounding } = config.specialMechanisms;
  const budget = logicalBlockCount * logicalBudgetRatio;
  return budgetRounding === "floor" ? Math.floor(budget + Number.EPSILON) : budget;
}

export interface DogV13MechanismPlan {
  readonly budget: number;
  readonly counts: Readonly<Record<DogV13MechanismType, number>>;
  readonly logicalUnitCount: number;
  readonly physicalBlockCount: number;
  readonly unallocatedLogicalUnitCount: number;
}

export function getDogV13MechanismPlan(
  logicalBlockCount: number,
  configOrMapIndex: DogV13Config | number = DOG_V13_CONFIG,
): DogV13MechanismPlan {
  const config = typeof configOrMapIndex === "number"
    ? DOG_V13_CONFIG
    : configOrMapIndex;
  const budget = getDogV13SpecialMechanismBudget(logicalBlockCount, config);
  const definitions = config.specialMechanisms.mechanisms;
  const counts = Object.fromEntries(
    definitions.map((definition) => [definition.type, 0]),
  ) as Record<DogV13MechanismType, number>;
  const requiredLogicalUnits = definitions.reduce(
    (total, definition) => total + definition.logicalUnitWeight,
    0,
  );
  if (config.specialMechanisms.requireAllTypes && budget < requiredLogicalUnits) {
    throw new Error(
      `狗了个狗 v13 special mechanism budget ${budget} cannot include all mechanism types`,
    );
  }

  let remaining = budget;
  let cursor = 0;
  let skippedThisRound = 0;
  while (remaining > 0 && skippedThisRound < definitions.length) {
    const definition = definitions[cursor % definitions.length];
    cursor += 1;
    if (definition.logicalUnitWeight > remaining) {
      skippedThisRound += 1;
      continue;
    }

    counts[definition.type] += 1;
    remaining -= definition.logicalUnitWeight;
    skippedThisRound = 0;
  }

  const logicalUnitCount = budget - remaining;
  const physicalBlockCount = Object.values(counts).reduce(
    (total, count) => total + count,
    0,
  );
  return Object.freeze({
    budget,
    counts: Object.freeze(counts),
    logicalUnitCount,
    physicalBlockCount,
    unallocatedLogicalUnitCount: remaining,
  });
}

export function getDogV13DifficultyTarget(
  levelNumber: number,
  config: DogV13Config = DOG_V13_CONFIG,
): DogV13DifficultyTarget {
  const stage = config.difficulty.targets.find(
    (candidate) => levelNumber >= candidate.minLevel && levelNumber <= candidate.maxLevel,
  );
  if (stage === undefined) {
    validateLevelNumber(levelNumber, config);
    throw new Error(`狗了个狗 v13 difficulty target is unavailable for level ${levelNumber}`);
  }
  return cloneAndFreeze(stage) as DogV13DifficultyTarget;
}

export function getDogV13ItemUses(
  itemId: DogV13ItemId,
  config: DogV13Config = DOG_V13_CONFIG,
): number {
  if (!config.items.ids.includes(itemId)) {
    throw new Error(`狗了个狗 v13 item is not configured: ${itemId}`);
  }
  return itemId === config.items.key.id
    ? config.items.key.initialUses
    : config.items.maxSuccessfulUsesPerLevel;
}

export function getDogTestProfile(
  profileName?: DogV13TestProfileName,
  config: DogV13Config = DOG_V13_CONFIG,
): DogV13TestProfile {
  const resolvedProfileName = profileName ?? config.testProfiles.default;
  const profile = config.testProfiles.profiles[resolvedProfileName];
  if (profile === undefined) {
    throw new Error(`狗了个狗 v13 test profile is unavailable: ${resolvedProfileName}`);
  }
  return cloneAndFreeze(profile) as DogV13TestProfile;
}

export function selectDogTestProfile(
  areas: DogConfigChangeArea | readonly DogConfigChangeArea[],
): DogV13TestProfileName {
  const changedAreas = typeof areas === "string" ? [areas] : areas;
  const selection = DOG_V13_CONFIG.testProfiles.selection;
  if (changedAreas.some((area) => selection.fullAreas.includes(area))) {
    return "full";
  }
  if (changedAreas.some((area) => selection.smokeAreas.includes(area))) {
    return "smoke";
  }
  return "focused";
}

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

function collectConfigIssues(input: unknown): DogV13ConfigIssue[] {
  const issues: DogV13ConfigIssue[] = [];
  if (!isRecord(input)) {
    return [{ path: "config", code: "type", message: "必须是对象" }];
  }

  requiredObject(input, "game", issues);
  requiredObject(input, "firstLevel", issues);
  requiredObject(input, "board", issues);
  requiredObject(input, "levels", issues);
  requiredObject(input, "tray", issues);
  requiredObject(input, "items", issues);
  requiredObject(input, "specialMechanisms", issues);
  requiredObject(input, "difficulty", issues);
  requiredObject(input, "animation", issues);
  requiredObject(input, "assets", issues);
  requiredObject(input, "audio", issues);
  requiredObject(input, "ui", issues);
  requiredObject(input, "testProfiles", issues);

  if (!("schemaVersion" in input)) {
    issues.push({ path: "schemaVersion", code: "required", message: "必填" });
  } else if (input.schemaVersion !== DOG_V13_SCHEMA_VERSION) {
    issues.push({
      path: "schemaVersion",
      code: "value",
      message: `必须是 ${DOG_V13_SCHEMA_VERSION}`,
    });
  }
  const game = asRecord(input.game);
  if (game !== undefined) {
    if (game.id !== "dog-lege-dog") {
      issues.push({ path: "game.id", code: "value", message: "必须是 dog-lege-dog" });
    }
    validateInteger(game.firstLevelNumber, "game.firstLevelNumber", 1, issues);
    validateInteger(game.maxLevelNumber, "game.maxLevelNumber", 1, issues);
    validateInteger(game.generatorVersion, "game.generatorVersion", 13, issues, 13);
    if (game.firstLevelNumber !== 1) {
      issues.push({ path: "game.firstLevelNumber", code: "value", message: "v13 必须是 1" });
    }
    if (game.maxLevelNumber !== 99) {
      issues.push({ path: "game.maxLevelNumber", code: "value", message: "v13 必须是 99" });
    }
    if (game.generatorVersion !== 13) {
      issues.push({ path: "game.generatorVersion", code: "value", message: "v13 必须是 13" });
    }
    validateNonEmptyString(game.defaultSeed, "game.defaultSeed", issues);
    validateFiniteNumber(game.defaultReward, "game.defaultReward", 0, issues);
  }

  const firstLevel = asRecord(input.firstLevel);
  if (firstLevel !== undefined) {
    validateNonEmptyString(firstLevel.seed, "firstLevel.seed", issues);
    validateInteger(firstLevel.blockCount, "firstLevel.blockCount", 1, issues);
    validateInteger(firstLevel.maxLayers, "firstLevel.maxLayers", 1, issues);
    validatePatternArray(firstLevel.patternTypes, "firstLevel.patternTypes", issues);
    validateNonEmptyString(firstLevel.templateId, "firstLevel.templateId", issues);
  }

  const board = asRecord(input.board);
  if (board !== undefined) {
    if (board.shape !== "irregular") {
      issues.push({ path: "board.shape", code: "value", message: "必须是 irregular" });
    }
    validateInteger(board.logicalCellSize, "board.logicalCellSize", 1, issues);
    validateInteger(board.blockWidth, "board.blockWidth", 1, issues);
    validateInteger(board.blockHeight, "board.blockHeight", 1, issues);
    validateInteger(board.maxMechanismsPerBlock, "board.maxMechanismsPerBlock", 1, issues, 1);
  }

  const levels = asRecord(input.levels);
  if (levels !== undefined) {
    validateInteger(levels.firstLevelNumber, "levels.firstLevelNumber", 1, issues);
    validateInteger(levels.maxLevelNumber, "levels.maxLevelNumber", 1, issues);
    if (levels.firstLevelNumber !== 1) {
      issues.push({ path: "levels.firstLevelNumber", code: "value", message: "v13 必须是 1" });
    }
    if (levels.maxLevelNumber !== 99) {
      issues.push({ path: "levels.maxLevelNumber", code: "value", message: "v13 必须是 99" });
    }
    const logicalBlockCount = asRecord(levels.logicalBlockCount);
    if (logicalBlockCount === undefined) {
      requiredObject(levels, "logicalBlockCount", issues, "levels");
    } else {
      validateInteger(logicalBlockCount.start, "levels.logicalBlockCount.start", 1, issues);
      validateInteger(logicalBlockCount.increment, "levels.logicalBlockCount.increment", 0, issues);
      validateInteger(
        logicalBlockCount.incrementEveryLevels,
        "levels.logicalBlockCount.incrementEveryLevels",
        1,
        issues,
      );
      validateInteger(logicalBlockCount.cap, "levels.logicalBlockCount.cap", 1, issues);
      if (
        isFiniteNumber(logicalBlockCount.start) &&
        isFiniteNumber(logicalBlockCount.cap) &&
        logicalBlockCount.cap < logicalBlockCount.start
      ) {
        issues.push({
          path: "levels.logicalBlockCount.cap",
          code: "relation",
          message: "不能小于 start",
        });
      }
    }
    validateStructureStages(
      levels.structureStages,
      "levels.structureStages",
      levels.maxLevelNumber,
      issues,
    );
  }

  const tray = asRecord(input.tray);
  if (tray !== undefined) {
    validateInteger(tray.baseCapacity, "tray.baseCapacity", 1, issues);
    validateInteger(tray.maxCapacity, "tray.maxCapacity", 1, issues);
    validateInteger(tray.maxLockedSlotCount, "tray.maxLockedSlotCount", 0, issues);
    if (tray.lockedSlotPlacement !== "right") {
      issues.push({ path: "tray.lockedSlotPlacement", code: "value", message: "必须是 right" });
    }
    if (
      isFiniteNumber(tray.baseCapacity) &&
      isFiniteNumber(tray.maxCapacity) &&
      tray.maxCapacity < tray.baseCapacity
    ) {
      issues.push({ path: "tray.maxCapacity", code: "relation", message: "不能小于 baseCapacity" });
    }
    if (
      isFiniteNumber(tray.maxLockedSlotCount) &&
      isFiniteNumber(tray.baseCapacity) &&
      tray.maxLockedSlotCount > tray.baseCapacity
    ) {
      issues.push({
        path: "tray.maxLockedSlotCount",
        code: "relation",
        message: "不能大于 baseCapacity",
      });
    }
  }

  const items = asRecord(input.items);
  if (items !== undefined) {
    validateStringArray(items.ids, "items.ids", issues);
    if (Array.isArray(items.ids)) {
      const configuredItemIds = items.ids as readonly unknown[];
      validateUnique(configuredItemIds, "items.ids", issues);
      for (const [index, itemId] of configuredItemIds.entries()) {
        if (!SUPPORTED_ITEM_IDS.includes(itemId as DogV13ItemId)) {
          issues.push({
            path: `items.ids[${index}]`,
            code: "value",
            message: "道具 ID 不受支持",
          });
        }
      }
      if (
        configuredItemIds.length !== SUPPORTED_ITEM_IDS.length ||
        SUPPORTED_ITEM_IDS.some((itemId) => !configuredItemIds.includes(itemId))
      ) {
        issues.push({
          path: "items.ids",
          code: "relation",
          message: "必须完整包含 v13 道具集合",
        });
      }
    }
    validateInteger(items.loadoutSize, "items.loadoutSize", 1, issues);
    if (
      isFiniteNumber(items.loadoutSize) &&
      Array.isArray(items.ids) &&
      items.loadoutSize > items.ids.length
    ) {
      issues.push({
        path: "items.loadoutSize",
        code: "relation",
        message: "不能大于道具数量",
      });
    }
    validateInteger(items.defaultUsesPerLevel, "items.defaultUsesPerLevel", 1, issues, 1);
    validateInteger(items.maxSuccessfulUsesPerLevel, "items.maxSuccessfulUsesPerLevel", 1, issues, 1);
    const key = asRecord(items.key);
    if (key === undefined) {
      requiredObject(items, "key", issues, "items");
    } else {
      if (key.id !== "key") {
        issues.push({ path: "items.key.id", code: "value", message: "必须是 key" });
      }
      validateInteger(key.initialUses, "items.key.initialUses", 0, issues, 0);
      if (key.usesCappedByLockedSlots !== true) {
        issues.push({
          path: "items.key.usesCappedByLockedSlots",
          code: "value",
          message: "必须为 true",
        });
      }
      validateRange(key.dropRate, "items.key.dropRate", 0, 1, issues);
      if (Array.isArray(items.ids) && !items.ids.includes("key")) {
        issues.push({ path: "items.ids", code: "relation", message: "必须包含 key" });
      }
    }
  }

  const specialMechanisms = asRecord(input.specialMechanisms);
  if (specialMechanisms !== undefined) {
    validateRange(
      specialMechanisms.logicalBudgetRatio,
      "specialMechanisms.logicalBudgetRatio",
      0,
      1,
      issues,
      false,
    );
    if (specialMechanisms.logicalBudgetRatio !== 0.3) {
      issues.push({
        path: "specialMechanisms.logicalBudgetRatio",
        code: "value",
        message: "v13 必须是 0.3",
      });
    }
    if (specialMechanisms.budgetRounding !== "floor") {
      issues.push({
        path: "specialMechanisms.budgetRounding",
        code: "value",
        message: "必须是 floor",
      });
    }
    if (specialMechanisms.remainderStrategy !== "stable-round-robin") {
      issues.push({
        path: "specialMechanisms.remainderStrategy",
        code: "value",
        message: "必须是 stable-round-robin",
      });
    }
    if (specialMechanisms.requireAllTypes !== true) {
      issues.push({
        path: "specialMechanisms.requireAllTypes",
        code: "value",
        message: "必须为 true",
      });
    }
    validateInteger(
      specialMechanisms.freezeMeltTripleCount,
      "specialMechanisms.freezeMeltTripleCount",
      1,
      issues,
    );
    const mechanisms = specialMechanisms.mechanisms;
    if (!Array.isArray(mechanisms) || mechanisms.length === 0) {
      issues.push({
        path: "specialMechanisms.mechanisms",
        code: "required",
        message: "必须包含机制定义",
      });
    } else {
      const types = mechanisms.map((mechanism) =>
        isRecord(mechanism) ? mechanism.type : undefined,
      );
      validateUnique(types, "specialMechanisms.mechanisms.type", issues);
      const expectedTypes: readonly DogV13MechanismType[] = [
        "freeze",
        "illusion",
        "magnetic",
        "twin",
      ];
      for (const type of expectedTypes) {
        if (!types.includes(type)) {
          issues.push({
            path: "specialMechanisms.mechanisms",
            code: "relation",
            message: `必须包含 ${type}`,
          });
        }
      }
      for (const [index, mechanism] of mechanisms.entries()) {
        const record = asRecord(mechanism);
        if (record === undefined) {
          issues.push({
            path: `specialMechanisms.mechanisms[${index}]`,
            code: "type",
            message: "必须是对象",
          });
          continue;
        }
        if (!expectedTypes.includes(record.type as DogV13MechanismType)) {
          issues.push({
            path: `specialMechanisms.mechanisms[${index}].type`,
            code: "value",
            message: "机制类型不受支持",
          });
        }
        validateInteger(
          record.logicalUnitWeight,
          `specialMechanisms.mechanisms[${index}].logicalUnitWeight`,
          1,
          issues,
        );
        const expectedWeight = record.type === "twin" ? 2 : 1;
        if (record.logicalUnitWeight !== expectedWeight) {
          issues.push({
            path: `specialMechanisms.mechanisms[${index}].logicalUnitWeight`,
            code: "value",
            message: `${String(record.type)} 的 v13 权重必须是 ${expectedWeight}`,
          });
        }
      }
    }
  }

  const difficulty = asRecord(input.difficulty);
  if (difficulty !== undefined) {
    validateDifficultyTargets(
      difficulty.targets,
      "difficulty.targets",
      levels?.maxLevelNumber,
      issues,
    );
  }

  const animation = asRecord(input.animation);
  if (animation !== undefined) {
    for (const key of [
      "blockFlightMs",
      "illusionRevealMs",
      "itemFeedbackMs",
      "freezeMeltMs",
      "twinSplitMs",
      "magneticAttractionMs",
      "keyDropMs",
      "trayUnlockMs",
    ]) {
      validateInteger(animation[key], `animation.${key}`, 1, issues);
    }
    if (animation.inputLockedDuringAnimation !== true) {
      issues.push({
        path: "animation.inputLockedDuringAnimation",
        code: "value",
        message: "必须为 true",
      });
    }
  }

  const assets = asRecord(input.assets);
  if (assets !== undefined) {
    validateAssetMap(assets.patterns, "assets.patterns", DOG_PATTERN_TYPES, issues);
    const itemIds = isRecord(input.items) ? input.items.ids : undefined;
    validateAssetMap(assets.items, "assets.items", itemIds, issues);
    validateNonEmptyString(assets.music, "assets.music", issues);
  }

  const audio = asRecord(input.audio);
  if (audio !== undefined) {
    const music = asRecord(audio.music);
    if (music === undefined) {
      requiredObject(audio, "music", issues, "audio");
    } else {
      validateNonEmptyString(music.path, "audio.music.path", issues);
      validateRange(music.volume, "audio.music.volume", 0, 1, issues);
    }
    const effects = asRecord(audio.effects);
    if (effects === undefined || Object.keys(effects).length === 0) {
      requiredObject(audio, "effects", issues, "audio");
    } else {
      for (const effectName of ["select", "match", "won", "lost"]) {
        if (!isRecord(effects[effectName])) {
          issues.push({
            path: `audio.effects.${effectName}`,
            code: "required",
            message: "必须配置",
          });
        }
      }
      for (const [name, effect] of Object.entries(effects)) {
        const record = asRecord(effect);
        if (record === undefined) {
          issues.push({ path: `audio.effects.${name}`, code: "type", message: "必须是对象" });
          continue;
        }
        if (!Array.isArray(record.frequencies) || record.frequencies.length === 0) {
          issues.push({
            path: `audio.effects.${name}.frequencies`,
            code: "required",
            message: "必须包含频率",
          });
        } else {
          for (const [index, frequency] of record.frequencies.entries()) {
            if (!isFiniteNumber(frequency) || frequency <= 0) {
              issues.push({
                path: `audio.effects.${name}.frequencies[${index}]`,
                code: "range",
                message: "必须是正数",
              });
            }
          }
        }
        validateRange(record.durationSeconds, `audio.effects.${name}.durationSeconds`, 0, 10, issues, false);
        validateRange(record.volume, `audio.effects.${name}.volume`, 0, 1, issues);
        validateRange(
          record.noteSpacingSeconds,
          `audio.effects.${name}.noteSpacingSeconds`,
          0,
          10,
          issues,
        );
        if (!["sine", "square", "sawtooth", "triangle"].includes(String(record.waveform))) {
          issues.push({ path: `audio.effects.${name}.waveform`, code: "value", message: "波形不受支持" });
        }
      }
    }
  }

  validateUiConfig(input.ui, "ui", issues);

  const testProfiles = asRecord(input.testProfiles);
  if (testProfiles !== undefined) {
    if (!["focused", "smoke", "full"].includes(String(testProfiles.default))) {
      issues.push({ path: "testProfiles.default", code: "value", message: "profile 不受支持" });
    }
    const selection = asRecord(testProfiles.selection);
    if (selection === undefined) {
      requiredObject(testProfiles, "selection", issues, "testProfiles");
    } else {
      const allowedAreas: readonly DogConfigChangeArea[] = [
        "docs",
        "ui",
        "runtime",
        "generator",
        "solvability",
        "difficulty",
        "public-contract",
        "game-startup",
        "worker",
        "random-regression",
        "cross-browser",
      ];
      for (const key of ["fullAreas", "smokeAreas"] as const) {
        const path = `testProfiles.selection.${key}`;
        validateStringArray(selection[key], path, issues);
        if (Array.isArray(selection[key])) {
          validateUnique(selection[key], path, issues);
          for (const [index, area] of selection[key].entries()) {
            if (!allowedAreas.includes(area as DogConfigChangeArea)) {
              issues.push({
                path: `${path}[${index}]`,
                code: "value",
                message: "改动领域不受支持",
              });
            }
          }
        }
      }
    }
    const profiles = asRecord(testProfiles.profiles);
    if (profiles === undefined) {
      requiredObject(testProfiles, "profiles", issues, "testProfiles");
    } else {
      for (const name of ["focused", "smoke", "full"] as const) {
        const profile = asRecord(profiles[name]);
        if (profile === undefined) {
          requiredObject(profiles, name, issues, "testProfiles.profiles");
          continue;
        }
        if (profile.name !== name) {
          issues.push({
            path: `testProfiles.profiles.${name}.name`,
            code: "value",
            message: `必须是 ${name}`,
          });
        }
        validateLevelNumberArray(
          profile.levelNumbers,
          `testProfiles.profiles.${name}.levelNumbers`,
          asNumber(levels?.maxLevelNumber),
          issues,
        );
        validateStringArray(profile.fixedSeeds, `testProfiles.profiles.${name}.fixedSeeds`, issues);
        validateInteger(
          profile.randomLevelPrefix,
          `testProfiles.profiles.${name}.randomLevelPrefix`,
          0,
          issues,
          asNumber(levels?.maxLevelNumber),
        );
        validateInteger(
          profile.stressLevelCount,
          `testProfiles.profiles.${name}.stressLevelCount`,
          0,
          issues,
          asNumber(levels?.maxLevelNumber),
        );
        for (const key of [
          "runUI",
          "runCore",
          "runRandomRegression",
          "runE2E",
          "runCrossBrowser",
          "runWorkerFallback",
          "runBuild",
          "runDiffCheck",
          "runFileLineCheck",
        ]) {
          if (typeof profile[key] !== "boolean") {
            issues.push({
              path: `testProfiles.profiles.${name}.${key}`,
              code: "type",
              message: "必须是布尔值",
            });
          }
        }
        validateInteger(
          profile.maxChangedFileLines,
          `testProfiles.profiles.${name}.maxChangedFileLines`,
          1,
          issues,
        );
      }
    }
  }

  return issues;
}

function validateDifficultyTargets(
  value: unknown,
  path: string,
  maxLevelValue: unknown,
  issues: DogV13ConfigIssue[],
): void {
  if (!Array.isArray(value) || value.length === 0) {
    issues.push({ path, code: "required", message: "必须包含难度目标" });
    return;
  }
  const maxLevel = asNumber(maxLevelValue);
  let previousMaxLevel = 0;
  for (const [index, target] of value.entries()) {
    const record = asRecord(target);
    if (record === undefined) {
      issues.push({ path: `${path}[${index}]`, code: "type", message: "必须是对象" });
      continue;
    }
    validateInteger(record.minLevel, `${path}[${index}].minLevel`, 1, issues);
    validateInteger(record.maxLevel, `${path}[${index}].maxLevel`, 1, issues);
    if (
      isFiniteNumber(record.minLevel) &&
      isFiniteNumber(record.maxLevel) &&
      record.maxLevel < record.minLevel
    ) {
      issues.push({
        path: `${path}[${index}].maxLevel`,
        code: "relation",
        message: "不能小于 minLevel",
      });
    }
    if (asNumber(record.minLevel) !== undefined && asNumber(record.minLevel) !== previousMaxLevel + 1) {
      issues.push({ path: `${path}[${index}].minLevel`, code: "relation", message: "目标区间必须连续" });
    }
    previousMaxLevel = asNumber(record.maxLevel) ?? previousMaxLevel;
    for (const key of [
      "safeChoiceCount",
      "safeChoiceRate",
      "durationMinutes",
      "trayPeakPressure",
      "mechanismDensity",
      "operationCost",
      "mistakeRisk",
    ]) {
      const rangePath = `${path}[${index}].${key}`;
      if (key === "safeChoiceCount") {
        validateRangeObject(record[key], rangePath, issues, 1, Number.MAX_SAFE_INTEGER, true);
      } else if (key === "safeChoiceRate" || key === "trayPeakPressure" || key === "mechanismDensity" || key === "operationCost" || key === "mistakeRisk") {
        validateRangeObject(record[key], rangePath, issues, 0, 1);
      } else {
        validateRangeObject(record[key], rangePath, issues, 0, Number.MAX_SAFE_INTEGER);
      }
    }
  }
  if (maxLevel !== undefined && previousMaxLevel !== maxLevel) {
    issues.push({ path, code: "relation", message: "目标区间必须覆盖全部关卡" });
  }
}

function validateStructureStages(
  value: unknown,
  path: string,
  maxLevelValue: unknown,
  issues: DogV13ConfigIssue[],
): void {
  if (!Array.isArray(value) || value.length === 0) {
    issues.push({ path, code: "required", message: "必须包含关卡结构阶段" });
    return;
  }
  let previousMaxLevel = 0;
  for (const [index, stage] of value.entries()) {
    const record = asRecord(stage);
    if (record === undefined) {
      issues.push({ path: `${path}[${index}]`, code: "type", message: "必须是对象" });
      continue;
    }
    validateInteger(record.minLevel, `${path}[${index}].minLevel`, 1, issues);
    validateInteger(record.maxLevel, `${path}[${index}].maxLevel`, 1, issues);
    validateInteger(record.maxLayers, `${path}[${index}].maxLayers`, 1, issues);
    validateInteger(record.patternTypeCount, `${path}[${index}].patternTypeCount`, 1, issues);
    if (
      isFiniteNumber(record.minLevel) &&
      isFiniteNumber(record.maxLevel) &&
      record.maxLevel < record.minLevel
    ) {
      issues.push({
        path: `${path}[${index}].maxLevel`,
        code: "relation",
        message: "不能小于 minLevel",
      });
    }
    if (asNumber(record.minLevel) !== undefined && asNumber(record.minLevel) !== previousMaxLevel + 1) {
      issues.push({ path: `${path}[${index}].minLevel`, code: "relation", message: "阶段区间必须连续" });
    }
    previousMaxLevel = asNumber(record.maxLevel) ?? previousMaxLevel;
  }
  const maxLevel = asNumber(maxLevelValue);
  if (maxLevel !== undefined && previousMaxLevel !== maxLevel) {
    issues.push({ path, code: "relation", message: "阶段必须覆盖全部关卡" });
  }
}

function validateAssetMap(
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
  if (!Array.isArray(keys)) {
    return;
  }
  for (const key of keys) {
    validateNonEmptyString(record[key], `${path}.${key}`, issues);
  }
}

function validateUiConfig(value: unknown, path: string, issues: DogV13ConfigIssue[]): void {
  const ui = asRecord(value);
  if (ui === undefined) {
    return;
  }

  const visual = asRecord(ui.visual);
  if (visual === undefined) {
    requiredObject(ui, "visual", issues, path);
  } else {
    for (const key of [
      "blockSizePx",
      "boardSafeMarginPx",
      "keyDropSizePx",
      "magneticEffectHeightPx",
    ]) {
      validateInteger(visual[key], `${path}.visual.${key}`, 1, issues);
    }
    validateRange(visual.flightTargetScale, `${path}.visual.flightTargetScale`, 0, 1, issues, false);
  }

  const copy = asRecord(ui.copy);
  if (copy === undefined) {
    requiredObject(ui, "copy", issues, path);
  } else {
    const app = asRecord(copy.app);
    if (app === undefined) {
      requiredObject(copy, "app", issues, `${path}.copy`);
    } else {
      for (const key of [
        "brandName",
        "registrationTitle",
        "registrationIntro",
        "register",
        "registrationFinePrint",
        "catalogTitle",
        "reset",
        "catalogAriaLabel",
        "highestUnlockedLevel",
        "startGame",
        "activeGame",
        "returnCatalog",
        "soundEnabled",
        "soundDisabled",
        "persistenceSaved",
        "persistenceTemporary",
        "resetConfirmation",
        "leaveConfirmation",
      ]) {
        validateNonEmptyString(app[key], `${path}.copy.app.${key}`, issues);
      }
      const resultLabels = asRecord(app.result);
      if (resultLabels === undefined) {
        requiredObject(app, "result", issues, `${path}.copy.app`);
      } else {
        for (const key of [
          "completedLevel",
          "finalReward",
          "totalScore",
          "finalTitle",
          "finalTitleValue",
          "currentLevel",
          "reward",
          "nextLevel",
        ]) {
          validateNonEmptyString(resultLabels[key], `${path}.copy.app.result.${key}`, issues);
        }
      }
      const actions = asRecord(app.actions);
      if (actions === undefined) {
        requiredObject(app, "actions", issues, `${path}.copy.app`);
      } else {
        for (const key of ["loadout", "nextLevel", "retry"]) {
          validateNonEmptyString(actions[key], `${path}.copy.app.actions.${key}`, issues);
        }
      }
    }

    const labels = asRecord(copy.labels);
    if (labels === undefined) {
      requiredObject(copy, "labels", issues, `${path}.copy`);
    } else {
      for (const key of [
        "level",
        "activeLevel",
        "specialMechanism",
        "board",
        "blockSelectable",
        "itemTarget",
        "tray",
        "lockedTraySlot",
        "emptyTraySlot",
        "wildcard",
        "match",
      ]) {
        validateNonEmptyString(labels[key], `${path}.copy.labels.${key}`, issues);
      }
      const status = asRecord(labels.status);
      if (status === undefined) {
        requiredObject(labels, "status", issues, `${path}.copy.labels`);
      } else {
        validateNonEmptyString(status.won, `${path}.copy.labels.status.won`, issues);
        validateNonEmptyString(status.lost, `${path}.copy.labels.status.lost`, issues);
      }
    }
    const specialMechanisms = asRecord(copy.specialMechanisms);
    if (specialMechanisms === undefined) {
      requiredObject(copy, "specialMechanisms", issues, `${path}.copy`);
    } else {
      for (const key of ["title", "hint", "empty", "closeLabel", "fallbackDescription"]) {
        validateNonEmptyString(
          specialMechanisms[key],
          `${path}.copy.specialMechanisms.${key}`,
          issues,
        );
      }
      validatePresentationMap(
        specialMechanisms.presentations,
        `${path}.copy.specialMechanisms.presentations`,
        ["freeze", "illusion", "magnetic", "twin"],
        issues,
      );
    }

    const result = asRecord(copy.result);
    if (result === undefined) {
      requiredObject(copy, "result", issues, `${path}.copy`);
    } else {
      validateResultDisplayMap(result, `${path}.copy.result`, ["won", "final", "lost"], issues);
    }

    const loadout = asRecord(copy.loadout);
    if (loadout === undefined) {
      requiredObject(copy, "loadout", issues, `${path}.copy`);
    } else {
      for (const key of [
        "initialTitle",
        "changeTitle",
        "initialIntro",
        "changeCurrentIntro",
        "changeNextIntro",
        "usesFallback",
        "usesPerLevel",
        "confirmationTitle",
        "confirmationNext",
        "confirmationCurrent",
        "cancel",
        "clear",
        "confirm",
        "summaryAriaLabel",
        "edit",
        "targetPrompt",
        "remainingUses",
      ]) {
        validateNonEmptyString(loadout[key], `${path}.copy.loadout.${key}`, issues);
      }
    }

    validateItemCopyMap(copy.items, `${path}.copy.items`, DOG_V13_ITEM_COPY_KEYS, issues);
  }

  const particles = asRecord(ui.particles);
  if (particles === undefined) {
    requiredObject(ui, "particles", issues, path);
    return;
  }
  for (const effectName of ["match", "won", "lost"]) {
    const profile = asRecord(particles[effectName]);
    if (profile === undefined) {
      requiredObject(particles, effectName, issues, `${path}.particles`);
      continue;
    }
    validateInteger(profile.durationMs, `${path}.particles.${effectName}.durationMs`, 1, issues);
    validateInteger(profile.count, `${path}.particles.${effectName}.count`, 1, issues);
    if (!Array.isArray(profile.colors) || profile.colors.length === 0) {
      issues.push({
        path: `${path}.particles.${effectName}.colors`,
        code: "required",
        message: "必须包含颜色",
      });
    } else {
      validateStringArray(profile.colors, `${path}.particles.${effectName}.colors`, issues);
    }
  }
}

function validateItemCopyMap(
  value: unknown,
  path: string,
  keys: readonly string[],
  issues: DogV13ConfigIssue[],
): void {
  const record = asRecord(value);
  if (record === undefined) {
    issues.push({ path, code: "required", message: "必须包含道具文案映射" });
    return;
  }
  for (const key of keys) {
    const item = asRecord(record[key]);
    if (item === undefined) {
      requiredObject(record, key, issues, path);
      continue;
    }
    validateNonEmptyString(item.name, `${path}.${key}.name`, issues);
    validateNonEmptyString(item.icon, `${path}.${key}.icon`, issues);
    validateNonEmptyString(item.description, `${path}.${key}.description`, issues);
  }
}

function validatePresentationMap(
  value: unknown,
  path: string,
  keys: readonly string[],
  issues: DogV13ConfigIssue[],
): void {
  const record = asRecord(value);
  if (record === undefined) {
    issues.push({ path, code: "required", message: "必须包含文案映射" });
    return;
  }
  for (const key of keys) {
    const presentation = asRecord(record[key]);
    if (presentation === undefined) {
      requiredObject(record, key, issues, path);
      continue;
    }
    validateNonEmptyString(presentation.name, `${path}.${key}.name`, issues);
    validateNonEmptyString(presentation.description, `${path}.${key}.description`, issues);
  }
}

function validateResultDisplayMap(
  value: unknown,
  path: string,
  keys: readonly string[],
  issues: DogV13ConfigIssue[],
): void {
  const record = asRecord(value);
  if (record === undefined) {
    issues.push({ path, code: "required", message: "必须包含结果文案映射" });
    return;
  }
  for (const key of keys) {
    const display = asRecord(record[key]);
    if (display === undefined) {
      requiredObject(record, key, issues, path);
      continue;
    }
    validateNonEmptyString(display.eyebrow, `${path}.${key}.eyebrow`, issues);
    validateNonEmptyString(display.title, `${path}.${key}.title`, issues);
    validateNonEmptyString(display.description, `${path}.${key}.description`, issues);
  }
}

function validateLevelNumberArray(
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

function validatePatternArray(value: unknown, path: string, issues: DogV13ConfigIssue[]): void {
  if (!Array.isArray(value) || value.length === 0) {
    issues.push({ path, code: "required", message: "必须包含图案" });
    return;
  }
  validateStringArray(value, path, issues);
  validateUnique(value, path, issues);
  for (const [index, pattern] of value.entries()) {
    if (!DOG_PATTERN_TYPES.includes(pattern as DogPatternType)) {
      issues.push({ path: `${path}[${index}]`, code: "value", message: "图案不受支持" });
    }
  }
}

function validateRangeObject(
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
  if (
    isFiniteNumber(record.min) &&
    isFiniteNumber(record.max) &&
    record.max < record.min
  ) {
    issues.push({ path, code: "relation", message: "max 不能小于 min" });
  }
}

function validateRange(
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

function validateFiniteNumber(
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

function validateInteger(
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

function validateNonEmptyString(value: unknown, path: string, issues: DogV13ConfigIssue[]): void {
  if (typeof value !== "string" || value.trim().length === 0) {
    issues.push({ path, code: "required", message: "必须是非空字符串" });
  }
}

function validateStringArray(value: unknown, path: string, issues: DogV13ConfigIssue[]): void {
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

function validateUnique(values: readonly unknown[], path: string, issues: DogV13ConfigIssue[]): void {
  const seen = new Set<unknown>();
  values.forEach((value, index) => {
    if (seen.has(value)) {
      issues.push({ path: `${path}[${index}]`, code: "duplicate", message: "不能重复" });
    }
    seen.add(value);
  });
}

function requiredObject(
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

function validateLevelNumber(levelNumber: number, config: DogV13Config): void {
  if (
    !Number.isSafeInteger(levelNumber) ||
    levelNumber < config.game.firstLevelNumber ||
    levelNumber > config.game.maxLevelNumber
  ) {
    throw new Error(
      `狗了个狗 v13 level number must be an integer from ${config.game.firstLevelNumber} to ${config.game.maxLevelNumber}`,
    );
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return isFiniteNumber(value) ? value : undefined;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cloneAndFreeze<T>(value: T): T {
  if (Array.isArray(value)) {
    return Object.freeze(value.map((entry) => cloneAndFreeze(entry))) as T;
  }
  if (isRecord(value)) {
    const cloned = Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, cloneAndFreeze(entry)]),
    );
    return Object.freeze(cloned) as T;
  }
  return value;
}
