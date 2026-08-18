# 12 — 完成移动端无滚动游戏布局

**What to build:** 让移动端竖屏用户无需滚动、拖拽或缩放即可同时操作棋盘与暂存槽，并保持桌面端棋盘居中可读。

**Blocked by:** 05 — 生成首个不规则部分重叠关卡；11 — 精简游戏目录与游戏页控制区

**Status:** done

- [x] 活动游戏根据可用 viewport 高度缩放和压缩外围信息。
- [x] 常见移动竖屏视口内，棋盘与完整 7 格暂存槽同时可见且可操作。
- [x] 活动游戏页面不需要纵向或横向滚动即可完成方块选择。
- [x] 棋盘不支持拖拽、平移或用户缩放，Pointer Events 继续覆盖触摸与鼠标。
- [x] 关卡选择与音效开关保持可访问，不遮挡棋盘或暂存槽。
- [x] 不规则棋盘的逻辑坐标、遮挡关系与点击区域不因视觉缩放改变。
- [x] 桌面端棋盘继续居中并限制最大宽度。
- [x] 移动 Chromium E2E 验证棋盘、暂存槽、音效开关与可点击方块同时可用。

## Comments

- 移动活动游戏改为 `dvh` 高度约束与 flex 剩余空间布局，压缩头部、关卡选择器、棋盘外围与暂存槽；短视口棋盘按逻辑宽高比等比缩放。
- 移动 Chromium E2E 覆盖 390×844、390×667、320×568：页面/`body` 无滚动，棋盘与 7 格暂存槽在视口内；真实点击可点击方块、关卡按钮与音效开关，并验证棋盘等比缩放与桌面居中最大宽度。
- 验证通过：`pnpm test:affected`（Chromium 6、typecheck、build）、`pnpm test:e2e:cross-browser`（Chromium/mobile Chromium/Firefox/WebKit 4）、`pnpm test:qa`（核心 68、随机 3、Chromium E2E 13）。
- 起始 commit：`f08b412`。code review Standards/Spec findings 已修复并重跑受影响验证。
- 当前浏览器支持矩阵：Chromium、Safari（Playwright WebKit）与移动 Chromium；Firefox 不再作为支持目标。
