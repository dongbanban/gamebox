# 07 — 改用 Vitest 原生测试发现

**What to build:** 让 Vitest 直接发现并运行每个核心与 UI 测试 case，删除只负责 import 的代理入口和手写 case 映射，同时保持原有测试语义与 ticket 验收档位。

**Blocked by:** 06 — 将 QA profile 移出生产配置

**Status:** ready-for-agent

- [ ] 所有 Vitest case 使用框架原生测试命名并可被直接收集。
- [ ] 需要 DOM 的测试通过测试级标注或统一 runner 配置继续使用 jsdom。
- [ ] 删除只负责 import case 的根代理入口，不保留空壳兼容文件。
- [ ] 删除 Vitest case 到代理入口的手写路径映射，受影响测试改用现有 import graph/related 能力。
- [ ] `test:ui`、`test:core`、`test:focused`、`test:smoke` 和 `test:full` 继续覆盖各自原有语义范围。
- [ ] 对比改动前后被收集的语义测试 case，除明确删除的内部基础设施断言外不得降低覆盖。
- [ ] 更新 agent 验收说明和 README，使其描述原生测试发现。
- [ ] 运行 runner 单元检查与相关 Vitest 档位并记录结果；最终批量 QA 关联 ticket 10。
