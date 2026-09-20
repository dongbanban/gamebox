# 09 — 清理历史 effort 与一次性工具

**What to build:** 让本地 issue tracker 和脚本目录只保留当前真实工作入口与可重复维护能力，删除已经完成、被覆盖、未获批或只为一次验收存在的历史材料，同时保留当前有效领域决策。

**Blocked by:** 04 — 用原生命令编排 QA profiles；05 — 收口「狗了个狗」与游戏目录公共出口；07 — 让道具运行时只支持内置八种道具；08 — 让乱序运行时直接消费局内状态

**Status:** done

- [x] 删除已经完成或已被后续决策覆盖的旧 feature effort 规格、tickets 与评论记录。
- [x] 删除未获批准且没有实现入口的 Vue 迁移规格，不新增替代框架计划。
- [x] 保留当前第三轮精简规格和全部未完成 tickets。
- [x] 删除没有包管理命令、文档入口或持续消费者的一次性移动端性能采样程序。
- [x] Git 历史继续保存已完成实现和采样工具的详细记录。
- [x] 当前有效领域语言与产品规则继续保留在根领域文档中。
- [x] 当前有效架构决策继续保留在 ADR 中；历史清理不得删除仍具约束力的决策。
- [x] README、代理说明、issue tracker 指南与领域文档不再指向已删除 ticket、旧 profile 实现或已归档入口。
- [x] 仓内引用搜索确认没有活动代码、命令或文档依赖被删除历史材料和一次性工具。
- [x] 运行 `git diff --check`；本 ticket 若只删除文档和零消费者工具，可记录“未运行运行时测试”。

## Comments

- 删除 8 个已完成/归档旧 effort、未获批 Vue 迁移规格和无消费者的一次性性能采样脚本；保留第三轮 effort、`CONTEXT.md`、8 个 ADR 与依赖清单。净删除 4,093 行，未改依赖。
- 通过剩余目录清单、全仓引用搜索、`git log --all -- scripts/dog-performance-sample.mjs`（保留 `b5a97f3`）和 `git diff --check` 验证。代理说明与 issue tracker 指南已移除已归档 hardening 入口表述。
- 运行时测试按本 ticket 的文档/零消费者工具例外未作为完成门槛。`CI=true pnpm test:qa` 在 pnpm 安装阶段因 `esbuild` build scripts 被忽略而停止；直接 core Vitest 已通过已输出用例，但一个生成器 worker 超过 4 分钟无新输出后中止，未计为完整 QA 通过。完整 QA 由 ticket 10 负责。
