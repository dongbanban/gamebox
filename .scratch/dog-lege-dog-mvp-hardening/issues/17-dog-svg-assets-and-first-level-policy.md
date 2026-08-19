# 17 — 使用狗主题 SVG 资源并明确首关配置边界

**What to build:** 将图片 2 的十种狗主题图案按行优先顺序转换为项目内 SVG 资源，替换方块与暂存槽原始图案；目录缩略图与 GAMEBOX logo 使用图片 2 最后一项“傻狗”；同时明确首关只保留难度起点配置，不维护第二套生成器。

**Related to:** 16 — 收敛游戏目录卡片与愉快音频反馈

**Status:** done

## Acceptance Criteria

- [x] 十种 SVG 图案按图片 2 行优先顺序映射：打工狗、单身狗、舔狗、看门狗、疯狗、拆家狗、龇牙狗、社恐狗、吃货狗、傻狗。
- [x] 棋盘方块与暂存槽复用同一图案渲染函数；不保留旧的通用狗脸 SVG 作为展示资源。
- [x] 游戏目录缩略图使用第 10 项傻狗形象，缩略图宽度相对上一版增加。
- [x] GAMEBOX logo 使用第 10 项傻狗形象；现有 logo 容器尺寸不变。
- [x] 最高解锁关卡与“开始游戏”动作在目录卡片同一行展示；累计积分只在通关结果页展示。
- [x] `first-level.ts` 继续作为稳定首关公开 seam；首关专属规则只表达 90 方块、3 层、6 图案、首关模板与稳定 seed。
- [x] 首关不维护独立生成器或独立 pipeline；首关 template/placement strategy 作为统一 generator 内的难度起点配置。
- [x] 首关 profile 作为难度起点配置保留；后续关卡继续按阶段增长方块、层数与图案数量。
- [x] UI 单测、类型检查、生产构建通过；ticket 记录实际命令与结果。

## Verification

- `pnpm test:ui`
- `pnpm build:pages`
- `git diff --check`

## Comments

- 需求来源：2026-08-19 目录缩略图、品牌 logo、十种图案与首关架构确认；附件只作为视觉参考。
- 结论：首关需要“profile”，不需要“第二套生成 pipeline”。`first-level.ts` 当前已通过 `GeneratedLevelGenerator` 生成，只保留稳定公开导出；生成器中首关 template/placement 分支负责难度起点与稳定回放约束。
- 实现：十种图案 SVG 按图片 2 行优先顺序写入 `public/assets/dog-icons-square/`，映射维护在 `game-assets.ts`；棋盘、暂存槽、logo 复用同一资产 fn；目录封面改为第 10 项傻狗；最高解锁关卡与开始动作保持同排，缩略图列宽提升。
- 验证：`pnpm test:ui` 通过（3 files、28 tests）；`pnpm build:pages` 通过；`pnpm test:e2e:cross-browser` 通过（Chromium、mobile Chromium、Safari 3/3）；`git diff --check` 通过。
