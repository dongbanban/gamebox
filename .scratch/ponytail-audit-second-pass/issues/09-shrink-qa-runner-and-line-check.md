# 09 — 精简 QA runner 与文件行数检查

**What to build:** 将测试基础设施收口为按 profile 名称直接选择步骤的短小 runner，并使用 Git 与标准 shell 工具执行改动文件行数规则，使现有 QA 命令保持可用而不再维护布尔真值表和自定义解析器。

**Blocked by:** 08 — 改用 Playwright 原生测试发现

**Status:** ready-for-agent

- [ ] 固定 profile 不再携带一组互相依赖的 `run*` 布尔字段，runner 直接拥有三个 profile 的执行步骤。
- [ ] 保留各 profile 的关卡检查点、固定 seed、随机前缀、压力范围和可重放报告。
- [ ] 删除只验证已移除布尔字段、代理入口或路径映射的测试。
- [ ] 改动文件行数规则使用 Git 与标准 shell 行数工具，不再维护独立 Node 解析器。
- [ ] 当前 500 行阈值语义保持不变；若平台检查失败，继续返回非零状态并指出超限文件。
- [ ] 核心、随机回归、浏览器、跨浏览器、Pages 构建与 diff 检查不会因 runner 精简而被遗漏或重复定义。
- [ ] `focused`、`smoke`、`full` 与 UI-only 命令保持当前用户入口和失败即停止语义。
- [ ] 运行 profile runner 单元检查并记录结果；最终批量 QA 关联 ticket 10。
