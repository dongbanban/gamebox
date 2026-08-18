# gamebox

## QA 命令

```bash
pnpm test:affected     # 按 Git 改动选受影响测试 + typecheck + build
pnpm test              # 核心 Vitest 测试
pnpm test:random       # 1–100 随机回归、固定检查点、100–1000 压力档
pnpm test:e2e          # Chromium 浏览器流程
pnpm test:qa           # 核心 + 随机回归 + Chromium E2E
```

## Ticket 验收规则

普通实现 ticket 默认运行 `pnpm test:affected`。命令依据当前工作区改动与 Vitest import graph 选择核心测试；关卡生成、可解性、难度与随机回归改动追加 `pnpm test:random`；应用层、游戏层、样式与浏览器流程改动选择对应 Chromium E2E。`typecheck` 与 `build` 始终运行。

以下情况改跑全量 `pnpm test:qa`：

- 跨模块公共契约、进度、导航或游戏启动流程改动
- 关卡生成器、可解性搜索、难度筛选或随机回归改动
- 合并前、发布前或无法确认影响范围

响应式或浏览器兼容改动追加：

```bash
pnpm test:e2e:cross-browser
```

随机失败报告包含 `testSeed`、关卡号、关卡 seed、生成器版本。按报告单关重放：

```bash
DOG_RANDOM_TEST_SEED=<testSeed> \
DOG_RANDOM_LEVEL_NUMBER=<levelNumber> \
pnpm test:random
```

压力档默认运行 100 关；需要完整上限时设置 `DOG_STRESS_LEVEL_COUNT=1000`。

跨浏览器 smoke 需要先安装 Playwright WebKit（Safari 引擎）：

```bash
pnpm exec playwright install webkit
pnpm test:e2e:cross-browser
```

该模式覆盖 Chromium、Safari（Playwright WebKit）与移动 Chromium 视口。
