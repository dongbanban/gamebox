# 07 — 检测仪揭示幻化方块

**What to build:** 落地检测仪道具；玩家选择棋盘中的幻化方块后，在原位揭示真实图案并转为普通方块。

**Blocked by:** 04 — 需要统一目标道具运行时；05 — 需要幻化方块状态与揭示规则。

**Status:** done

- [x] 检测仪只能选择当前可点击的棋盘幻化方块；普通方块、冻结方块、不可点击方块、暂存槽方块不可作为目标。
- [x] 确认目标后锁定棋盘，播放原位检测/揭示动画；不把方块移入暂存槽，不占用槽位，不触发三消。
- [x] 揭示完成后方块保留在棋盘原位置，真实图案可见，幻化状态移除并转为普通方块；动画结束恢复点击。
- [x] 目标确认前可以取消；取消、无效目标、次数为 0 不扣次数；成功揭示扣 1 次。
- [x] 直接点击幻化方块仍按幻化方块规则飞入暂存槽并在飞行中揭示，不要求先使用检测仪。
- [x] 检测仪不会造成失败；执行期间禁止重复目标选择、普通点击与其他道具动作。
- [x] 增加目标过滤、原位揭示、槽位不变、无三消、取消、扣次及输入锁测试。

## Comments

- 实现检测仪 runtime 目标校验、session 原位揭示、360ms 原位视觉效果、动画输入锁；揭示后继续点击按普通方块流程处理。
- 聚焦验证：`pnpm test:focused` 通过，8 files / 110 tests；检测仪专项与特殊机制测试 26 tests 通过。
- `pnpm typecheck`、`pnpm build` 通过。
- 既往批量记录：`pnpm test:e2e` 曾为 17 passed，1 个移动端 freeze shadow 断言失败（`tests/e2e/register-catalog.spec.ts:166`）；`pnpm test:qa` 的 `test:core` 曾命中仓库已知 E2E 误收集问题。
- AC 行为均由 `tests/item-runtime.test.ts`、`tests/special-mechanism.test.ts` 覆盖；既往状态曾因批量 QA blocker 暂留 `in-progress`。
- 修复检测仪揭示层被特殊方块 glyph 样式覆盖导致的偏移/溢出：揭示图层固定在目标方块内部并裁剪边界；火把与检测仪运行时、棋盘渲染统一拒绝不可点击棋盘目标。`CONTEXT.md` 与 spec 补充火把/检测仪/消磁仪/三消移除目标限制。
- 回归验证：`tests/item-runtime.test.ts`、`tests/special-mechanism.test.ts` 共 27 tests 通过。
- 本次聚焦验证：`pnpm test:focused` 通过，8 files / 111 tests；`pnpm typecheck`、`pnpm build`、`git diff --check` 通过。`pnpm test:qa` 仍被已知 `test:core` 误收集 `tests/e2e/**` 且断言后不退出的问题阻塞；排除 E2E 的核心测试断言通过但同样未退出，已停止进程。
- freeze shadow 修复：移动端 E2E 视觉比较只匹配普通棋盘方块，避免把普通暂存槽与冻结棋盘方块比较。`pnpm exec playwright test tests/e2e/register-catalog.spec.ts --grep '移动端竖屏活动游戏' --repeat-each=20` 通过 20/20；`pnpm test:e2e` 通过 18/18。阻塞解除，ticket 标记 `done`。
