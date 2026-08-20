# 19 — [历史] 原 hardening 随机回归与最终 QA 契约

**What to build:** 原 hardening 轮次的最终 QA 任务。该任务不再独立执行；随机回归、QA 命令边界、共享测试辅助逻辑与跨浏览器最终验证已迁移到「狗了个狗」道具与随机特殊机制方案的 ticket 11。

**Blocked by:** 无（已被新方案替代）

**Status:** wontfix

**Replaced by:** `.scratch/dog-lege-dog-items-and-special-mechanics/issues/11-loading-pregen-and-final-qa.md`

## 保留原因

保留本文件，记录上一轮 hardening 的测试契约、迁移边界与历史验证事实。后续实现只修改新方案 ticket 11；不要在本文件继续追加验收项或新的实现任务。

## 原始契约摘要

- 常规随机回归使用版本化固定 `testSeed`，生成 1–100 个从第 1 关开始的连续前缀，并固定覆盖第 1、5、10、15、30、100 关；压力档覆盖连续 1–1000 关。
- 实际关卡尝试由显式 `runSeed` 驱动；相同 `runSeed` 与生成器版本必须完整复现棋盘、解法与回放元数据，不同 `runSeed` 允许产生不同尝试。
- 失败报告需包含 `testSeed`、`runSeed`、关卡号、生成器版本与单关重放入口；公共进度不保存棋盘、暂存槽、次数、半局状态或 `runSeed`。
- 最终浏览器验证包含注册、目录、游戏结果、离开保护、音效、移动布局、Safari（Playwright WebKit）与移动 Chromium smoke。

## 迁移范围

| 原 ticket 19 责任 | 当前归属 |
| --- | --- |
| `test:core` 排除 `tests/e2e/**` 与随机回归；`pnpm test:qa` 失败立即退出 | ticket 11「Shared QA Contract」 |
| `test:affected` 适配 `src/games/dog-lege-dog/levels/` 与 `@/*` import graph | ticket 11「Shared QA Contract」 |
| 内存 storage、不可用 storage、几何 oracle、首关/随机尝试驱动、浏览器流程助手去重 | ticket 11「Shared QA Contract」 |
| `runSeed`、道具组生命周期、特殊机制、加载/预生成、UI/E2E/跨浏览器最终验证 | ticket 11 及其前置 ticket 01–10、12 |

## 原始验证入口

```bash
pnpm test:qa
pnpm test:e2e:cross-browser
pnpm build:pages
git diff --check
```

失败单关重放继续使用报告中的稳定测试输入：

```bash
DOG_RANDOM_TEST_SEED=<testSeed> \
DOG_RANDOM_LEVEL_NUMBER=<levelNumber> \
pnpm test:random
```

## Comments

- 本 ticket 来源于旧 hardening 轮次；原 ticket 14 的随机回归/最终 QA 目标曾在该轮重编号为 19。
- 最新方案已将 `runSeed`、道具组变更、特殊机制、加载/预生成与最终 QA 合并到新 feature effort；ticket 11 成为唯一最终 QA owner。
- 旧 hardening spec、README、AGENTS 与 issue tracker 中的活动引用已迁移到新 ticket 11；本文件只作为历史迁移索引保留。
