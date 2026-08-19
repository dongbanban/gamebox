# 09 — 随机关卡回归与跨浏览器质量门

**What to build:** 用可复现的随机测试与真实浏览器流程验证 Gamebox 从注册到关卡结果的完整闭环，并覆盖生成器异常与存储异常。

**Blocked by:** 05 — 关卡选择与离开保护；07 — 无道具可解生成与难度筛选；08 — 动画、音效与响应式体验

**Status:** done

- [x] 每次随机测试运行生成 1–100 个关卡，并记录 `testSeed`、关卡号、关卡 seed 与生成器版本。
- [x] 固定覆盖第 1、5、10、15、30、100 关；另设 100–1000 个关卡压力测试。
- [x] 任意随机测试失败可使用记录的 seed 单独重放。
- [x] 属性测试覆盖方块数量、图案总数、形状、层叠、遮挡上限、可解性、安全选择与难度区间。
- [x] Playwright 覆盖首次注册、回访、进入目录、进入游戏、通关、失败、重试、返回、刷新、重置与音效设置。
- [x] Playwright 默认覆盖 Chromium；跨浏览器 smoke 覆盖 Safari（Playwright WebKit）与移动 Chromium。
- [x] 覆盖存储不可用、损坏数据、写入失败与生成器候选筛选失败。
- [x] 测试报告包含失败 seed、关卡号、生成器版本与可复现说明。
- [x] `pnpm` 测试命令可运行核心测试、随机回归测试与浏览器端到端测试。

## Comments

- 新增 `tests/random-regression.test.ts`：seed 驱动 1–100 随机关卡、固定检查点、100–1000 压力档；失败报告包含 `testSeed`、关卡号、关卡 seed、生成器版本与单关重放命令。
- 新增 `LevelCandidateFilter` 测试 seam，覆盖候选筛选全部失败、有限重试、降级与失败候选 replay；新增 ProgressStore 写入失败测试。
- 新增 Playwright 完整闭环、存储异常、跨浏览器 smoke；默认 Chromium，`PLAYWRIGHT_CROSS_BROWSER=1` 扩展 Safari（Playwright WebKit）与移动 Chromium。
- 验证通过：`pnpm typecheck`、`pnpm test`（46 tests）、`pnpm test:random`（默认 seed，3 tests）、`DOG_STRESS_LEVEL_COUNT=1000` 压力测试、`pnpm exec playwright test --project=chromium`（12 tests）、`pnpm build`、`git diff --check`。
- 跨浏览器配置当前运行 Chromium、Safari（Playwright WebKit）与移动 Chromium；运行 WebKit 前需先安装 Playwright WebKit。
