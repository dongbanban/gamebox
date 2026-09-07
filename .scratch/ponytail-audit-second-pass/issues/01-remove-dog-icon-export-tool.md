# 01 — 删除不可复现的狗图导出工具

**What to build:** 删除当前没有源图、调用说明或受管 Python 依赖的一次性狗图导出能力，同时保持十种已提交狗图资源、CDN 路径和用户可见渲染完全不变。

**Blocked by:** None — can start immediately

**Status:** done

- [x] 删除一次性狗图导出程序，不添加替代脚本、兼容入口或新依赖。
- [x] 十种已提交狗图 SVG 保持原文件名、内容和引用关系，不重新生成资源。
- [x] 游戏目录、棋盘与暂存槽继续通过现有资源配置渲染狗图。
- [x] 现有 CDN 前缀与本地资源回退行为保持不变。
- [x] 运行 `pnpm test:ui` 并记录结果；最终批量 QA 关联 ticket 10。
- [x] 记录本 ticket 的实际删除行数与依赖变化。

## Comments

- 删除 `scripts/export-dog-icons-svg.py`，实际删除 247 行；未添加替代脚本、兼容入口或依赖，依赖变化为 0。
- `public/assets/dog-icons-square/` 十个 SVG、资源配置、CDN 前缀与本地回退引用均无 diff。
- `pnpm typecheck` 通过。
- `pnpm test:ui` 通过：7 个测试文件、90 个测试通过。
- `pnpm test:qa` 通过 full profile：core 18 个文件/260 个测试、随机回归 3 个测试、E2E 24 个测试、跨浏览器 18 个测试、Pages 构建、diff 与文件行数检查均通过。
- 代码审查（固定点 `6500bd4b3af6fd5e6ad0e3e34357f6a48f7967d1`）的 Standards 与 Spec 两个维度均无发现。
