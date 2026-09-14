# 04 — 用原生命令编排 QA profiles

**What to build:** 保持 focused、smoke 与 full 的验证强度和失败即停止行为，但用包管理脚本、shell、Vitest、Playwright 与 Git 的原生能力表达固定流程，不再维护静态计划模型及其镜像测试。

**Blocked by:** 03 — 以静态类型契约替代 v13 运行时 schema

**Status:** ready-for-agent

- [ ] `focused`、`smoke`、`full` 仍是唯一测试 profile 名称，现有命令入口保持可用。
- [ ] smoke 继续使用既定关卡、固定 seed 与小规模压力范围，并运行一个 Chromium 核心流程。
- [ ] full 继续覆盖核心测试、Worker fallback、随机回归、Chromium、跨浏览器、Pages 构建、diff 和文件行数守卫。
- [ ] 任一步骤失败后立即停止后续步骤，并返回原始非零退出状态。
- [ ] 受影响验证继续通过 Git 获取改动，通过 Vitest `related` import graph 选择核心测试，并按 UI-only、随机回归和高风险范围升级。
- [ ] 删除静态步骤计划、命令对象、报告对象、重复 profile 名称和永远不会产生的分类值。
- [ ] 删除只断言固定步骤数组、命令字符串和报告格式的测试；保留真正验证分类决策的最小测试。
- [ ] 文件行数守卫继续使用系统工具，不重新实现文件读取或行数解析器。
- [ ] README、代理验收说明与 issue tracker 指南只描述最终存在的命令与选择规则。
- [ ] 实际执行 focused、smoke 和 full 入口，确认成功与失败路径；最终记录 `pnpm test:qa` 结果。

