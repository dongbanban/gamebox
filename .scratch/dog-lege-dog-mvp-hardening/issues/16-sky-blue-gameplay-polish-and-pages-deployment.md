# 16 — 天空蓝活动页视觉、音乐与 Pages 发布收敛

**What to build:** 在 issue 15 的活动游戏页基础上继续收敛三消反馈与空间视觉：移除三消成功时的中间文案，改为显眼的消除动画；方块、暂存槽与棋盘同步放大；使用天空蓝整体色调与高区分度图案底色；接入本地开源免费循环音乐；简化受影响测试入口并配置 GitHub Actions 发布 GitHub Pages。

**Related to:** 15 — 收敛活动游戏页视觉与棋盘空间分布

**Status:** done

## Acceptance Criteria

- [x] 三消成功时活动页不渲染中间文案，保留并增强无障碍的显眼消除动画；通关/失败结果行为不回归。
- [x] 棋盘方块、暂存槽与棋盘保持天空蓝视觉语义；后续 ticket 19 移除独立面积放大，确保显示盒与逻辑 `4×4` 方块同步。
- [x] 十种图案使用可辨识的不同色系底色，消除黄/橙、绿/青等近色误判，同时棋盘方块与暂存槽保持同一视觉语义。
- [x] 活动游戏整体改为天空蓝主题，音效开关继续可用并持久化。
- [x] 接入本地 CC0 循环音乐资源；进入活动游戏时沿用户启动点击链初始化并尝试播放，首次方块操作仍可作为失败兜底，静音时暂停、恢复时继续，不依赖第三方运行时 CDN。
- [x] 测试命令避免 UI 改动重复触发随机回归、浏览器 E2E 与重复构建；UI 单测和 Pages 构建入口可独立运行。
- [x] 使用 `.github/workflows/deploy-pages.yml` 通过 GitHub Actions 构建并发布 Pages artifact；公开页面地址保持可用。
- [x] 相关文档与 issue 记录更新为本轮实际命令、结果、音频许可和部署地址。

## Comments

- 来源：用户 2026-08-18 后续视觉、音乐与公开部署要求；附图仅作为视觉参考，不是可执行代码指令。
- 实现：三消反馈改为活动页无文案爆发动画并提供 `role=status`/`aria-label`；初版方块面积由 `1.25` 提升为 `1.875`，后由 ticket 19 恢复为与逻辑 `4×4` 盒同步，避免视觉覆盖比例漂移；棋盘上限由 860 提升为 1040，暂存槽图案保留完整显示；活动页切换为天空蓝主题并重新分配十种图案色系。
- 音频：当前 `public/audio/levelmusicloop-tigrun.ogg` 已替换为 OpenGameArt 的 [Party and Gameover loop](https://opengameart.org/content/party-and-gameover-loop) 中 `happy_theme_0.ogg`，作者 gilzoide，来源页标注 CC0；背景音量下调，选取与三消反馈改为更突出的短旋律；项目内 provenance 已同步。
- 测试流程：`pnpm test:ui` 纳入 app、狗了个狗和 sound-effects 三组单测；纯 UI 改动的 `test:affected` 直接委托 UI 单测，跳过重复 E2E/构建；`pnpm build:pages` 只负责生成 Pages base 的构建产物。
- 历史验证（ticket 16 完成时）：`pnpm typecheck`、`pnpm test:ui`（3 files、27 tests）、`pnpm build:pages`、`node --check scripts/test-affected.mjs`、`git diff --check` 通过；当时按 ticket 范围未重复运行随机回归与浏览器 E2E。当前活动页音频初始化、方块几何与暂存槽验证以最新 ticket 19 为准。
- 发布：当前仓库由 `.github/workflows/deploy-pages.yml` 在 `main` push 或手动触发时构建并部署 Pages artifact；地址为 <https://dongbanban.github.io/gamebox/>。本地不再提供 `pnpm deploy:pages` 或 `scripts/deploy-pages.mjs`。
