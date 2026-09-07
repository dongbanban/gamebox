# 02 — 使用浏览器原生身份与历史能力

**What to build:** 在不改变注册、游戏进度恢复、临时运行模式和导航体验的前提下，使用浏览器原生 UUID 与 History 行为替代手写回退和冗余 URL 拼装，并删除已被 99 关边界提前拒绝的旧历史分支。

**Blocked by:** None — can start immediately

**Status:** done

- [x] 新匿名用户直接使用 `crypto.randomUUID()`，删除手写随机 UUID 和字节格式化回退。
- [x] 持久化与注入用户 ID 的 UUID 校验继续保留，无效值仍按当前行为拒绝或替换。
- [x] 注册、回访、损坏存储、不可用存储与写入失败行为保持不变。
- [x] History 状态更新省略冗余当前 URL 参数，游戏目录、活动关卡、返回和浏览器后退行为保持不变。
- [x] 删除在最高关卡已限制为 99 后永远不可达的旧完成历史上限及对应误导性测试表述。
- [x] 使用现有游戏进度与应用导航行为测试验证结果，不新增生产测试 seam。
- [x] 运行本范围要求的验证并记录结果；最终批量 QA 关联 ticket 10。

## Comments

- `ProgressStore` 直接使用 `globalThis.crypto.randomUUID()`；保留持久化状态与注入用户 ID 的 UUID 校验、注册 fallback、临时模式与写入失败行为。
- History 更新改为省略冗余 URL 参数；删除不可达的 `MAX_LEGACY_COMPLETED_LEVELS`、对应 null 分支与误导性 recovery 测试。
- 聚焦检查：`pnpm test:focused` 按仓库规则拒绝执行并要求 full profile；进度/应用定向复验 `pnpm exec vitest run tests/progress-store.test.ts tests/app.test.ts` 通过（2 个文件、53 个测试）。
- 批量 QA：`pnpm test:qa` 的 core（18 个文件、259 个测试）、Worker fallback（4）、随机回归（3）、Chromium E2E（24）均通过；cross-browser 首次出现时序 flake（16/18 与 17/18），随后两次 `pnpm test:e2e:cross-browser` 分别 18/18 通过。`pnpm build:pages`、`git diff --check` 与 `node scripts/check-file-lines.mjs --changed --max-lines 500` 通过；最终批量 QA 关联 ticket 10。
- 代码审查（固定点 `613f96db3e1326046e99c03177bb99b0c9b1fbf0`）未发现 spec 缺口或 scope creep；审查提出的 UUID 单行 wrapper 仅为 judgement call，保留以维持现有默认/注入 factory seam。
- 最终 diff 共 4 个文件，22 行新增、88 行删除；生产代码与测试为 4 行新增、79 行删除，未修改依赖。
