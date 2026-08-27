## Agent skills

### Issue tracker

Issues and specs live as Markdown files under `.scratch/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five canonical triage labels; each label string matches role name. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout: root `CONTEXT.md` plus `docs/adr/`. See `docs/agents/domain.md`.

### Ticket verification

默认采用分批验证：普通 ticket 完成时运行 `pnpm test:focused`，只跑受影响核心单测，不触发随机回归、E2E 或构建；文档-only 改动可标记“未运行测试”。根 `tests/*.test.ts`/`tests/e2e/*.spec.ts` 是入口，`*-cases/**` 是入口 import 的 case，`support/**` 是 fixture/helper；affected runner 按入口映射处理 nested 文件。每 3–5 个 ticket、一个功能阶段结束、进入高风险 ticket 前、合并前或发布前运行 `pnpm test:qa`，不要与 `pnpm test:affected` 叠加。生成器、可解性/难度、特殊机制运行时、公共契约、进度、导航、游戏启动、测试基础设施、跨模块或无法确认影响范围的改动，完成当前 ticket 前直接运行全量 QA；随机回归改动运行 `pnpm test:smoke` 或 `pnpm test:qa`；响应式或浏览器兼容改动追加 `pnpm test:e2e:cross-browser`。UI-only 改动可优先运行 `pnpm test:ui`；高风险改动使用 `test:focused` 会被拒绝并提示目标 profile；ticket 专属 spec 更严格时，以 spec 为准。ticket 记录聚焦检查与批量 QA 的实际命令、结果及关联 ticket。`pnpm test:affected` 末尾只运行 `build`，因 `build` 已包含 `tsc --noEmit`。`test:core` 已排除 E2E 与随机回归；旧 hardening ticket 19 已归档。
