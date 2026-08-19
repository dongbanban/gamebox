## Agent skills

### Issue tracker

Issues and specs live as Markdown files under `.scratch/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five canonical triage labels; each label string matches role name. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout: root `CONTEXT.md` plus `docs/adr/`. See `docs/agents/domain.md`.

### Ticket verification

UI 文案、DOM、渲染器或样式改动优先运行 `pnpm test:ui`；普通实现 ticket 运行 `pnpm test:affected`。跨模块、生成器、合并前或发布前目标命令为 `pnpm test:qa`，不要与 `pnpm test:affected` 叠加；响应式或浏览器兼容改动追加 `pnpm test:e2e:cross-browser`。`pnpm test:affected` 末尾只运行 `build`，因 `build` 已包含 `tsc --noEmit`。ticket 记录实际命令与结果。ticket 19 完成前，`test:core` 会误收集 `tests/e2e/**`，全量验证需分别运行排除 E2E 的 Vitest、`pnpm test:random` 与 `pnpm test:e2e`；生成器改动也不要依赖当前 `test:affected` 的旧路径匹配。
