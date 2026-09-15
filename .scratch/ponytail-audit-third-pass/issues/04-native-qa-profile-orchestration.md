# 04 — 用原生命令编排 QA profiles

**What to build:** 保持 focused、smoke 与 full 的验证强度和失败即停止行为，但用包管理脚本、shell、Vitest、Playwright 与 Git 的原生能力表达固定流程，不再维护静态计划模型及其镜像测试。

**Blocked by:** 03 — 以静态类型契约替代 v13 运行时 schema

**Status:** done

- [x] `focused`、`smoke`、`full` 仍是唯一测试 profile 名称，现有命令入口保持可用。
- [x] smoke 继续使用既定关卡、固定 seed 与小规模压力范围，并运行一个 Chromium 核心流程。
- [x] full 继续覆盖核心测试、Worker fallback、随机回归、Chromium、跨浏览器、Pages 构建、diff 和文件行数守卫。
- [x] 任一步骤失败后立即停止后续步骤，并返回原始非零退出状态。
- [x] 受影响验证继续通过 Git 获取改动，通过 Vitest `related` import graph 选择核心测试，并按 UI-only、随机回归和高风险范围升级。
- [x] 删除静态步骤计划、命令对象、报告对象、重复 profile 名称和永远不会产生的分类值。
- [x] 删除只断言固定步骤数组、命令字符串和报告格式的测试；保留真正验证分类决策的最小测试。
- [x] 文件行数守卫继续使用系统工具，不重新实现文件读取或行数解析器。
- [x] README、代理验收说明与 issue tracker 指南只描述最终存在的命令与选择规则。
- [x] 实际执行 focused、smoke 和 full 入口，确认成功与失败路径；最终记录 `pnpm test:qa` 结果。

## Comments

- 起始提交：`f5c3c7e`。
- `pnpm typecheck`：通过。
- `pnpm test:profile:unit`：3/3 通过；保留分类决策与 shell 行数守卫行为，删除固定步骤/报告镜像测试。
- `pnpm test:focused`：按高风险改动拒绝，exit 2，提示运行 `pnpm test:qa`。
- `pnpm test:smoke`：通过；core 47 files/282 tests、Worker fallback 4/4、随机回归 3/3（`v13-smoke-a`，前缀/压力 5）、Chromium smoke 1/1。
- 初次 `pnpm test:full`：核心 47 files/282 tests、Worker fallback 4/4、随机回归 3/3（`v13-full-a`，99 关）和 Chromium 28/28 通过；跨浏览器 WebKit Safari 失败（并发运行 24/30 通过，串行 Safari 6/10 通过），`&&` 正确停止后续 Pages build、diff 与行数守卫。
- 首次 full 暴露旧 E2E `run-*` seed 断言；已同步为原生 UUID 格式，专项 Chromium case 1/1 通过。跨浏览器 E2E 增加可复现递增 UUID seed，仍无法消除 Safari 交互时序失败。
- 最终修复：deterministic E2E seed 使用合法 v4 UUID，乱序 case 等待注册目录状态后再写入合法持久化进度；修复 Safari/Chromium/mobile Chromium 的注册 reload 竞态。
- 最终 `pnpm test:qa`：通过；core 47 files/282 tests、Worker fallback 4/4、随机回归 3/3（`v13-full-a`，99 关）、Chromium 28/28、跨浏览器 30/30、Pages build、diff check、文件行数检查 10 files。
- 依赖未变。
- 最终 Status：`done`；全部验收项已验证。
