# 06 — 将 QA profile 移出生产配置

**What to build:** 让 `focused`、`smoke` 和 `full` 只由测试基础设施配置和执行，使主页面、关卡生成 Worker 与运行时配置不再携带测试 seed、QA 开关或文件阈值，同时保持现有验证范围可用。

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] QA profile 的名称、关卡检查点、固定 seed、压力范围和命令意图只有一份测试专用来源。
- [ ] 从 `DogV13Config`、运行时配置源、运行时校验、公共狗游戏导出和 Worker 载荷中删除测试 profile。
- [ ] 只被测试消费的 profile/report helper 移至测试基础设施或就地内联，不保留生产转发入口。
- [ ] 实际游戏行为字段继续执行现有必填、类型、范围与关系校验。
- [ ] 更新 ADR-0007，明确集中 v13 配置不再拥有 QA profile；相关领域与测试说明保持一致。
- [ ] `focused`、`smoke` 和 `full` 的用户可调用命令及语义保持不变。
- [ ] Pages 构建产物中的主 bundle 与 Worker 不再包含测试 seed、`run*` 开关或改动文件阈值。
- [ ] 运行配置、profile runner 与构建验证并记录结果；最终批量 QA 关联 ticket 10。
