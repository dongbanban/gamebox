# 13 — 拒绝语义损坏的游戏进度

**What to build:** 在浏览器本地状态字段类型正确但领域关系不一致时安全降级，防止错误完成历史影响关卡解锁与通关奖励。

**Blocked by:** None — can start immediately.

**Status:** in-progress

- [x] 最高解锁关卡为正整数，累计积分为非负整数，完成关卡唯一且有序。
- [x] 完成关卡集合与最高解锁关卡满足线性解锁关系。
- [x] 不接受完成关卡高于或等于最高解锁关卡的语义损坏状态。
- [x] 无法安全规范化的状态进入临时运行模式并显示持久化警告，不白屏。
- [x] 不通过猜测完成历史补发或重算累计积分。
- [x] 合法现有状态、缺失旧版完成历史的兼容恢复与多游戏隔离继续工作。
- [x] 重置仍可清除损坏状态，并允许用户重新注册进入持久模式。
- [x] 测试只通过 `ProgressStore` 快照、注册、完成记录与重置观察行为。

## Comments

- `ProgressStore` 只接受完整线性完成前缀；重复、乱序、缺口、越界状态直接拒绝。旧版缺失完成历史仅在有界数量内兼容推导，超大历史进入临时模式，避免无界数组分配。
- 首次完成锁定关卡、累计积分或最高解锁关卡溢出均拒绝；不补发完成历史，不重算已有累计积分。损坏状态可 reset，随后重新注册恢复持久模式。
- 验证：`pnpm exec vitest run tests/progress-store.test.ts` — 26/26 通过；`pnpm typecheck` — 通过；`pnpm build` — 通过；`pnpm exec playwright test tests/e2e/register-catalog.spec.ts tests/e2e/full-flow.spec.ts --project=chromium --workers=1` — 12/12 通过。
- `pnpm test:affected` 已运行，但默认 5s 动画测试在 `tests/dog-lege-dog.test.ts`、`tests/app.test.ts` 出现时序超时；ProgressStore 测试无失败。提高 timeout 后相关核心测试 25/25 通过。ticket 保持 `in-progress`，待受影响全量命令无环境/既有时序超时后再关闭。
