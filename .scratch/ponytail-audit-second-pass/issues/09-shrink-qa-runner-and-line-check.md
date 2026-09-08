# 09 — 精简 QA runner 与文件行数检查

**What to build:** 将测试基础设施收口为按 profile 名称直接选择步骤的短小 runner，并使用 Git 与标准 shell 工具执行改动文件行数规则，使现有 QA 命令保持可用而不再维护布尔真值表和自定义解析器。

**Blocked by:** 08 — 改用 Playwright 原生测试发现

**Status:** done

- [x] 固定 profile 不再携带一组互相依赖的 `run*` 布尔字段，runner 直接拥有三个 profile 的执行步骤。
- [x] 保留各 profile 的关卡检查点、固定 seed、随机前缀、压力范围和可重放报告。
- [x] 删除只验证已移除布尔字段、代理入口或路径映射的测试。
- [x] 改动文件行数规则使用 Git 与标准 shell 行数工具，不再维护独立 Node 解析器。
- [x] 当前 500 行阈值语义保持不变；若平台检查失败，继续返回非零状态并指出超限文件。
- [x] 核心、随机回归、浏览器、跨浏览器、Pages 构建与 diff 检查不会因 runner 精简而被遗漏或重复定义。
- [x] `focused`、`smoke`、`full` 与 UI-only 命令保持当前用户入口和失败即停止语义。
- [x] 运行 profile runner 单元检查并记录结果；最终批量 QA 关联 ticket 10。

## Comments

- runner 按 `focused`、`smoke`、`full` 直接定义步骤；profile JSON 仅保留关卡、seed、随机前缀和压力范围。删除 65 行 Node 行数解析器，改用 Git、`mktemp`、`wc -l` 和 POSIX shell，并显式传播 Git 失败。
- 验证通过：`pnpm test:profile:unit`（8/8）、`pnpm typecheck`、`git diff --check`；阈值为 1 的边界检查返回 exit 1 并列出超限文件，500 行检查通过。
- 批量 QA 关联 ticket 10：完整 profile 已验证 core 42 files/259 tests、Worker 4/4、随机回归 3/3、Chromium 24/24、跨浏览器 18/18、Pages build、diff 与文件行数检查；review 修复后再次通过 core、Worker、随机回归、跨浏览器、Pages build、diff 与文件行数步骤。Chromium 并行运行偶发既有乱序/复原 case 时序失败（23/24），该 case 单独运行通过，未改动 E2E 或游戏代码。
- 相对起始提交 `92f1ae179c0d68fe66fd6610a13d2f2b61c29c8d`：总 diff 新增 129 行、删除 164 行，净减少 35 行；代码文件净减少 42 行，依赖变化 0。
