## Agent skills

### Issue tracker

Issues and specs live as Markdown files under `.scratch/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five canonical triage labels; each label string matches role name. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout: root `CONTEXT.md` plus `docs/adr/`. See `docs/agents/domain.md`.

### Ticket verification

普通实现 ticket 完成前运行 `pnpm test:affected`。跨模块、生成器、合并前或发布前追加 `pnpm test:qa`；响应式或浏览器兼容改动追加 `pnpm test:e2e:cross-browser`。ticket 记录实际命令与结果。
