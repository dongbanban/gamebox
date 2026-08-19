# 19 — 收敛可重放随机回归与最终 QA 契约

**What to build:** 在 ticket 01–18 已完成的结构、生成器、游戏闭环、视觉、音频与部署改动之上，完成最后一轮测试契约收敛：让常规随机回归每次使用可记录的新 `testSeed` 并跨阶段采样，保留失败单关重放；修复全量 QA 命令边界；统一重复测试辅助逻辑；用核心测试、随机回归、Chromium 完整流程、移动视口与 Safari（Playwright WebKit）smoke 验证当前实现。

**Blocked by:** 01–18

**Status:** ready-for-agent

## Current Baseline

- 关卡生成器版本为 `6`。第 1 关与后续关卡统一使用确定性生成管线；关卡号、base seed、`testSeed`、生成器版本可重放棋盘、图案、区域分布与层叠关系。
- 随机回归已有失败报告、单关重放、1–100 连续前缀、固定第 1/5/10/15/30/100 关检查点、默认 100 关与可配置 100–1000 关压力档。
- 未提供 `DOG_RANDOM_TEST_SEED` 时仍使用固定 `random-regression-default-v1`；常规随机集仍是从第 1 关开始的连续前缀，不是跨阶段采样。
- `pnpm test:core` 当前只排除 `tests/random-regression.test.ts`，会误收集 `tests/e2e/*.spec.ts`；因此 `pnpm test:qa` 尚不能作为单条权威全量命令。
- Chromium 完整流程、Safari（Playwright WebKit）与移动 Chromium smoke 已存在。当前活动棋盘按 `4×4` 逻辑方块映射为 `48px × 48px` 显示盒，棋盘像素尺寸由逻辑宽高换算；该视觉契约及窄屏可操作性需要在最终 QA 中共同验证。
- Vite 与 TypeScript 使用 `@/* → src/*` alias；源码与测试内部 import 已统一，不再依赖目录深度计算相对路径。

## Acceptance Criteria

- [ ] 未显式提供 `DOG_RANDOM_TEST_SEED` 时，每次常规随机回归创建并在 suite 名、失败报告与重放命令中输出新的 `testSeed`；显式 seed 继续完全可复现。
- [ ] 同一次运行的抽样数量、关卡选择、关卡生成、失败报告与重放入口全部由记录的 `testSeed` 驱动。
- [ ] 常规随机回归生成 1–100 个去重的跨阶段样本，不只覆盖从第 1 关开始的连续前缀；阶段边界与高关卡能够被长期覆盖。
- [x] 固定覆盖第 1、5、10、15、30、100 关，并保留可配置的 100–1000 关连续压力档。
- [x] 失败报告包含 `testSeed`、关卡号、关卡 seed、生成器版本与单关重放命令。
- [x] 属性测试覆盖不规则逻辑轮廓、`1/4`/`1/2` 重叠、完全对齐上限、图案阶段、区域分布、可解性、安全选择三态与难度筛选。
- [ ] `test:core` 明确排除 `tests/e2e/**` 与随机回归；`pnpm test:qa` 依次完成核心 Vitest、随机回归、Chromium E2E，任一步失败立即退出。
- [ ] `test:affected` 的生成器路径匹配适配当前 `src/games/dog-lege-dog/levels/` 目录与 `@/*` import graph，生成器改动不会漏跑随机回归。
- [ ] 浏览器流程覆盖注册、目录、重置、游戏、通关奖励、下一关、失败、重试、返回、后退、刷新/关闭保护、音效、临时运行与移动布局。
- [ ] 活动棋盘验证 `48px` 方块与逻辑坐标映射一致，同时在 390×844、390×667、320×568 等窄屏中不横向裁切，棋盘与完整 7 格暂存槽无需滚动即可操作。
- [ ] Safari（Playwright WebKit）与移动 Chromium smoke 可通过 `pnpm test:e2e:cross-browser` 列出并运行；测试只依赖用户可观察行为与明确布局契约。
- [ ] 测试共用内存 storage、不可用 storage、几何 oracle、首关通关驱动、浏览器对话框与关卡流程助手，不保留行为相同的重复实现。
- [ ] `pnpm test:qa`、`pnpm test:e2e:cross-browser`、`pnpm build:pages`、`git diff --check` 全部通过，ticket 记录实际命令、测试数与失败修复。
- [ ] README、AGENTS、spec、CONTEXT、docs 与 ticket 01–18 只描述当前实现或明确标为历史记录/后续目标；编号和关联引用保持一致。

## Implementation Notes

- 新 `testSeed` 只在测试入口生成。生产关卡生成器继续要求显式、稳定输入，不读取当前时间或全局随机源。
- 跨阶段样本由 `testSeed` 稳定洗牌或分层选择；显式重放关卡号时只运行目标关卡，不额外跑常规样本。
- 压力档保持连续 1…N，负责发现高关卡生成/加载异常；常规随机档负责更快的跨阶段覆盖，两者职责分开。
- 修复 QA 命令时同步检查 `scripts/test-affected.mjs`。目录重组后，生成器影响范围应匹配 `levels/`、游戏配置、生成器/可解/难度测试。
- `48px` 是显示基准，不得改变 `4×4` 逻辑盒、正面积遮挡、点击判定或重放数据。若窄屏需要缩放，整块棋盘与方块使用同一比例，不能裁切可点击区域。
- 历史 ticket 的完成时测试数保留为历史事实；最终权威结果只写在本 ticket。

## Verification

```bash
pnpm test:qa
pnpm test:e2e:cross-browser
pnpm build:pages
git diff --check
```

需要验证失败重放时：

```bash
DOG_RANDOM_TEST_SEED=<testSeed> \
DOG_RANDOM_LEVEL_NUMBER=<levelNumber> \
pnpm test:random
```

## Comments

- 本 ticket 由原 ticket 14 的随机回归/最终 QA 目标结合 ticket 14–18 后续视觉、音频、SVG、空间几何与部署实现重写；原 ticket 14 已删除，原 ticket 15–19 顺延为 14–18。
- 当前已知阻断：`pnpm test:qa` 会因 Vitest 误收集 Playwright spec 失败；这是本 ticket 的明确修复范围，不应记录成核心业务测试失败。
