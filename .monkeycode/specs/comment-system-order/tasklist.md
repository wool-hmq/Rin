# Task List: comment-system-order

> 状态：**已修复**（`feed.tsx` 切换按钮与评论区改为基于排序后 `enabledSystems` 的动态渲染，并同步新增 Discuss 评论系统）。
> 根因见 design.md §1.2：feed.tsx 切换按钮与评论区渲染原为硬编码顺序，未使用排序后的 `enabledSystems` 动态渲染。

## 1. 前端渲染（核心修复）
- [x] 1.1 feed.tsx 切换按钮改为按排序后的 `enabledSystems` 数组 `.map()` 动态渲染（删除硬编码按钮块）
- [x] 1.2 feed.tsx 评论区内容改为 `activeSystem === "xxx"` 直接判断渲染，仅渲染激活系统对应组件（删除 `showXxxComments` 布尔量）
- [x] 1.3 新增 `SYSTEM_ICONS` 映射（native/twikoo/giscus/waline/cwd/gitalk/utterances/discuss → 对应 remixicon）

## 2. 存储类型兜底
- [x] 2.1 settings.tsx 排序 UI 对 `comment.systemOrder` 增加 `Array.isArray` 校验，非数组时回退默认顺序
- [x] 2.2 若服务端返回字符串化数组，在 `normalizeSettingsState`（settings-helpers.ts）统一归一化为数组

## 3. 验证
- [x] 3.1 client + server tsc 通过（api 包 TS5096 为既有 tsconfig 配置问题，与本次无关）
- [x] 3.2 `cd client && bunx vitest run` 全绿（37/37）
- [x] 3.3 手动验证：启用 ≥2 评论系统 → 调整顺序 → 保存 → 文章页按钮顺序一致
- [ ] 3.4 验证 `comment.systemOrder` D1 存取往返（GET /config 返回数组）——待线上环境实测

## 4. 收尾
- [x] 4.1 修复确认后更新 requirements.md / design.md 状态
- [x] 4.2 提交并推送
