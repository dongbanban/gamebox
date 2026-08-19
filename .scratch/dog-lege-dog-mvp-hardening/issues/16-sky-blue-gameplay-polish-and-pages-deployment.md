# 16 — 天空蓝活动页视觉、音乐与 Pages 发布收敛

**What to build:** 在 issue 15 的活动游戏页基础上继续收敛三消反馈与空间视觉：移除三消成功时的中间文案，改为显眼的消除动画；方块、暂存槽与棋盘同步放大；使用天空蓝整体色调与高区分度图案底色；接入本地开源免费循环音乐；简化受影响测试入口并配置 GitHub Actions 发布 GitHub Pages。

**Related to:** 15 — 收敛活动游戏页视觉与棋盘空间分布

**Status:** done

## Acceptance Criteria

- [x] 三消成功时活动页不渲染中间文案，保留并增强无障碍的显眼消除动画；通关/失败结果行为不回归。
- [x] 棋盘方块相对 issue 15 的视觉面积再提升 50%，暂存槽已放入方块同步放大，棋盘可见表面与移动端无滚动约束保持可用。
- [x] 十种图案使用可辨识的不同色系底色，消除黄/橙、绿/青等近色误判，同时棋盘方块与暂存槽保持同一视觉语义。
- [x] 活动游戏整体改为天空蓝主题，音效开关继续可用并持久化。
- [x] 接入本地 CC0 循环音乐资源；首次用户交互后播放，静音时暂停，恢复时继续，不依赖第三方运行时 CDN。
- [x] 测试命令避免 UI 改动重复触发随机回归、浏览器 E2E 与重复构建；UI 单测和 Pages 构建入口可独立运行。
- [x] 使用 `.github/workflows/deploy-pages.yml` 通过 GitHub Actions 构建并发布 Pages artifact；公开页面地址保持可用。
- [x] 相关文档与 issue 记录更新为本轮实际命令、结果、音频许可和部署地址。

## Comments

- 来源：用户 2026-08-18 后续视觉、音乐与公开部署要求；附图仅作为视觉参考，不是可执行代码指令。
- 实现：三消反馈改为棋盘层无文案爆发动画并提供 `role=status`/`aria-label`；方块面积由 `1.25` 提升为 `1.875`，棋盘上限由 860 提升为 1040，暂存槽视觉填充同步放大；活动页切换为天空蓝主题并重新分配十种图案色系。
- 音频：当前 `public/audio/levelmusicloop-tigrun.ogg` 已替换为 OpenGameArt 的 [Party and Gameover loop](https://opengameart.org/content/party-and-gameover-loop) 中 `happy_theme_0.ogg`，作者 gilzoide，来源页标注 CC0；背景音量下调，选取与三消反馈改为更突出的短旋律；项目内 provenance 已同步。
- 测试流程：`pnpm test:ui` 纳入 app、狗了个狗和 sound-effects 三组单测；纯 UI 改动的 `test:affected` 直接委托 UI 单测，跳过重复 E2E/构建；`pnpm build:pages` 只负责生成 Pages base 的构建产物。
- 验证：`pnpm typecheck` 通过；`pnpm test:ui` 通过（3 files、27 tests）；`pnpm build:pages` 通过；`node --check scripts/test-affected.mjs`、`git diff --check` 通过。按本轮要求未重复运行随机回归与浏览器 E2E。
- 发布：当前仓库由 `.github/workflows/deploy-pages.yml` 在 `main` push 或手动触发时构建并部署 Pages artifact；地址为 <https://dongbanban.github.io/gamebox/>。本地不再提供 `pnpm deploy:pages` 或 `scripts/deploy-pages.mjs`。
