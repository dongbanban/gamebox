# 09 — 通关后直接进入下一关

**What to build:** 让用户通关后可以直接开始刚解锁的下一关，同时保留返回游戏目录操作。

**Blocked by:** 04 — 建立通用游戏定义与结果展示契约

**Status:** done

- [x] 通关结果页同时提供下一关与返回游戏目录两个操作。
- [x] 下一关操作只启动刚完成关卡的 `N+1` 关。
- [x] 启动下一关前使用最新游戏进度验证该关已解锁。
- [x] 下一关生成或启动失败时安全返回游戏目录或显示可恢复错误，不白屏。
- [x] 重玩旧关通关后，下一关操作仍只能进入当前合法已解锁关卡。
- [x] 进入下一关会创建全新局内状态，不继承上一关棋盘或暂存槽。
- [x] 浏览器 E2E 覆盖通关、直接进入下一关、关卡标题与新棋盘出现。

## Comments

- `GameboxApp` 绑定结果页的 `gameId + N+1` 目标，并在启动前重新读取最新进度；篡改或过期目标回到目录。
- 捕获关卡生成/启动异常，清理活动句柄并恢复目录 history，避免空白游戏页。
- 增加 app 回归：启动失败、stale next target、旧关重玩；E2E 验证第 2 关标题、全新 block IDs 与空暂存槽。
- 验证通过：`pnpm typecheck`、`pnpm build`、`pnpm test:qa`（core 66 tests、random 3 tests、Chromium E2E 13 tests）。
- Review 通过：Standards 无硬违规，Spec 无 finding。
