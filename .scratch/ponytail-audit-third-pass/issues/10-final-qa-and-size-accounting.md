# 10 — 完成第三轮精简发布验收

**What to build:** 证明精简后的 Gamebox 仍能完整注册、进入游戏、生成可解关卡、使用道具、完成或失败关卡、保存进度并在受支持浏览器运行，同时记录仓库实际缩减结果。

**Blocked by:** 09 — 清理历史 effort 与一次性工具

**Status:** done

- [x] 核心测试继续覆盖游戏进度、关卡生成、可解性、难度、局内状态、特殊机制、道具与回放。
- [x] Worker 准备、同步 fallback、预生成、加载态和失败诊断全部通过。
- [x] Chromium 浏览器流程覆盖注册、目录、游戏、通关、失败、重试、下一关、返回和刷新。
- [x] WebKit 与移动 Chromium 覆盖核心流程、响应式布局、键盘操作和减少动态效果。
- [x] Pages 构建通过，生产入口、Worker、静态资源和 CDN 路径保持可用。
- [x] `pnpm test:qa` 作为唯一最终顶层验收命令通过，不与 `pnpm test:affected` 叠加。
- [x] 严格 TypeScript 未使用诊断通过，不存在无效 import、参数、声明或零消费者导出。
- [x] Git diff 检查和改动文件行数守卫通过。
- [x] 对比实现前后测试收集，确认 import 迁移和测试删除没有静默丢失外部行为覆盖。
- [x] 记录实际新增、删除与净删行数；约 5,800 行只是估算，不作为强制目标。
- [x] 记录依赖变化为 0；如实际出现依赖变化，本 ticket 不得通过，除非另有获批规格。
- [x] 将最终 QA 命令、结果、测试收集变化和缩减统计回写本 ticket，并关联 tickets 01–09。

## Comments

- 最终验收运行 `pnpm test:qa`，未叠加 `pnpm test:affected`，退出码为 0。核心、生成器/随机回归、Worker/fallback、Chromium、跨浏览器、Pages 构建、`git diff --check` 与文件行数守卫均通过；Chromium 28/28、跨浏览器 30/30，通过构建 `tsc --noEmit` 且产出 83 个模块，文件行数检查为 0 个超阈值文件。
- pnpm 首次预检因本机忽略 `esbuild` build scripts 停止；使用未跟踪的临时 `pnpm-workspace.yaml` 允许已锁定的 esbuild 并执行 `pnpm rebuild esbuild` 后重跑通过。临时文件已删除，`package.json` 依赖声明与 `pnpm-lock.yaml` 均未改动。
- 测试收集对比实现前基线 `1808e00^` 与第三轮完成提交 `70d04b2`：测试文件 55→57（新增 2 个、删除 0 个），静态 `it`/`test` 声明 318→313；完整浏览器与跨浏览器行为覆盖均通过，未发现 import 迁移或测试整理造成的外部行为覆盖静默丢失。
- 同一第三轮实现提交范围 `1808e00^..70d04b2` 共 204 个文件，新增 4,586 行、删除 7,982 行，净删 3,396 行；约 5,800 行仅为审计估算，不作为目标。依赖变化为 0。关联 tickets 01–09 的已完成实现与 ticket 09 的历史清理提交。
- `70d04b2` 起始点的 Standards/Spec review 无标准问题；Spec 轴指出的 QA、收集、缩减和依赖证据已由本次记录补齐。
