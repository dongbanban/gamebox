# 10 — 完成全量 QA 与文档收口

**What to build:** 对第二轮精简后的完整仓库执行一次权威验收，确认用户行为、领域规则、测试发现、构建产物和文档全部一致，并记录实际删除规模与依赖变化。

**Blocked by:** 01 — 删除不可复现的狗图导出工具；02 — 使用浏览器原生身份与历史能力；05 — 收口特殊机制直接分派；09 — 精简 QA runner 与文件行数检查

**Status:** done

- [x] 规格、ADR、领域文档、agent 验收说明与 README 只描述最终实现，不再引用已删除 profile、registry、代理入口、路径映射或生成工具。
- [x] 用户已有幻化/双生视觉改动及其他并发工作得到保留，没有被回滚或混入无关重写。
- [x] 严格 TypeScript 未使用诊断通过，没有遗留无消费者 import、参数或声明。
- [x] 运行一次 `pnpm test:qa`，核心测试、随机回归、Worker fallback、Chromium、跨浏览器、Pages 构建、diff 与文件行数检查全部通过。
- [x] 不与最终 `pnpm test:qa` 叠加运行 `pnpm test:affected`。
- [x] 构建产物中的主 bundle 与关卡生成 Worker 不包含测试 profile seed、`run*` 开关或文件阈值。
- [x] 核对测试收集结果，除明确删除的内部基础设施断言外，所有原有用户行为 case 继续存在。
- [x] 记录相对实现起点的新增、删除与净减少行数；约 900 行仅作为估算，不为达标删除必要代码。
- [x] 确认 `package.json` 与 lockfile 没有非预期依赖变化，并记录依赖减少数量。
- [x] 所有前置 ticket 的验证记录均关联本 ticket 的批量 QA 结果。

## Comments

- 文档与保留工作：README、`CONTEXT.md`、ADR-0007、`AGENTS.md` 与 agent 验收说明均描述最终测试发现、profile 归属和运行时结构，未引用已删除产物路径；本票仅调整跨浏览器等待与验收记录，未改动生产代码或用户已有幻化/双生视觉工作。ticket 01–09 的验证记录均关联 ticket 10。
- 严格未使用诊断：`pnpm exec tsc --noEmit --noUnusedLocals --noUnusedParameters --pretty false` 通过，0 个诊断。
- 测试收集：相对实现起点 `6500bd4b3af6fd5e6ad0e3e34357f6a48f7967d1`，Vitest 260→259；差异仅为两个 QA/profile 配置断言被当前配置边界断言替换，以及 ticket 02 明确删除的不可达 legacy history case。Playwright 24→24，测试标题完全一致；所有受支持用户行为 case 保留。
- 首次 `pnpm test:qa` 的 core 42/259、Worker 4/4、随机回归 3/3 与 Chromium 24/24 通过，cross-browser 的 Safari 重玩等待因默认 5 秒超时为 17/18。Safari 并行复现为 2/4；将该断言与同测试现有生成等待统一为 120 秒后复现为 4/4，不修改生产行为。
- 最终 `pnpm test:qa` 通过：core 42 文件/259 测试、Worker fallback 4/4、随机回归 3/3（完整 1–99 前缀与 99 关压力）、Chromium 24/24、跨浏览器 18/18、Pages build、`git diff --check` 与 500 行检查全部通过；未运行 `pnpm test:affected`。
- Pages 主 bundle 与关卡生成 Worker 均未包含 `v13-focused`/`v13-smoke-*`/`v13-full-*`、已删除 `run*` QA 开关或文件阈值标识。
- 相对实现起点，`src`、`tests`、`scripts` 与 `public` 共新增 662 行、删除 2042 行，净减少 1380 行；约 900 行仅作估算。依赖声明为 0 新增、0 删除、0 升级，`pnpm-lock.yaml` 无变化；`package.json` 仅有预期的原生测试发现命令调整。
- 代码审查固定点 `6f89ac945af31a4aabfbc8154d564303068532f0`：Standards 与 Spec 两个维度在补齐本记录后均无发现。
