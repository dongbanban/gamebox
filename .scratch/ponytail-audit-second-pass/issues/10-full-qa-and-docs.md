# 10 — 完成全量 QA 与文档收口

**What to build:** 对第二轮精简后的完整仓库执行一次权威验收，确认用户行为、领域规则、测试发现、构建产物和文档全部一致，并记录实际删除规模与依赖变化。

**Blocked by:** 01 — 删除不可复现的狗图导出工具；02 — 使用浏览器原生身份与历史能力；05 — 收口特殊机制直接分派；09 — 精简 QA runner 与文件行数检查

**Status:** ready-for-agent

- [ ] 规格、ADR、领域文档、agent 验收说明与 README 只描述最终实现，不再引用已删除 profile、registry、代理入口、路径映射或生成工具。
- [ ] 用户已有幻化/双生视觉改动及其他并发工作得到保留，没有被回滚或混入无关重写。
- [ ] 严格 TypeScript 未使用诊断通过，没有遗留无消费者 import、参数或声明。
- [ ] 运行一次 `pnpm test:qa`，核心测试、随机回归、Worker fallback、Chromium、跨浏览器、Pages 构建、diff 与文件行数检查全部通过。
- [ ] 不与最终 `pnpm test:qa` 叠加运行 `pnpm test:affected`。
- [ ] 构建产物中的主 bundle 与关卡生成 Worker 不包含测试 profile seed、`run*` 开关或文件阈值。
- [ ] 核对测试收集结果，除明确删除的内部基础设施断言外，所有原有用户行为 case 继续存在。
- [ ] 记录相对实现起点的新增、删除与净减少行数；约 900 行仅作为估算，不为达标删除必要代码。
- [ ] 确认 `package.json` 与 lockfile 没有非预期依赖变化，并记录依赖减少数量。
- [ ] 所有前置 ticket 的验证记录均关联本 ticket 的批量 QA 结果。
