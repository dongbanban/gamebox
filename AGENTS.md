## Agent skills

### Issue tracker

Issues and specs live as Markdown files under `.scratch/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five canonical triage labels; each label string matches role name. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout: root `CONTEXT.md` plus `docs/adr/`. See `docs/agents/domain.md`.

### Ticket verification

UI 文案、DOM、渲染器或样式改动优先运行 `pnpm test:ui`；普通实现 ticket 运行 `pnpm test:affected`。跨模块、生成器、合并前或发布前直接运行 `pnpm test:qa`，不要与 `pnpm test:affected` 叠加；响应式或浏览器兼容改动追加 `pnpm test:e2e:cross-browser`。`pnpm test:affected` 末尾只运行 `build`，因 `build` 已包含 `tsc --noEmit`。ticket 记录实际命令与结果。
