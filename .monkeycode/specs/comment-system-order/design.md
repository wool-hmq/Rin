# Design Document

## 1. 现状与根因分析

### 1.1 已实现部分

- **`client/src/page/feed.tsx`（`Comments` 组件）**：
  - `enabledSystems` 数组已按 `comment.systemOrder` 排序（feed.tsx:550-575）。
  - 排序逻辑：读取 `config.get("comment.systemOrder")`，若为有效数组且长度等于启用系统数，则按其 indexOf 排序；否则回退默认顺序。

- **`client/src/page/settings.tsx`**：
  - 排序 UI 已加入（settings.tsx:529-602），位于「默认评论系统」设置下方。
  - 每个启用的评论系统一行，含向上/向下按钮；调用 `setConfigValue("client", "comment.systemOrder", newOrder)` 更新 draft，随整个设置表单一起保存。

### 1.2 未生效的根因（关键）

`feed.tsx` 中评论系统**切换按钮**与**评论区内容**的渲染均为硬编码逐块实现，而非基于排序后的 `enabledSystems` 数组动态渲染：

- 切换按钮块（feed.tsx:611-703）：按 `config.getBoolean('comment.enabled') → native`、`twikooEnabled → twikoo`、`giscusEnabled → giscus`、`walineEnabled → waline`、`cwdEnabled → cwd`、`gitalkEnabled → gitalk`、`utterancesEnabled → utterances` 的固定顺序硬编码渲染。
- 评论区内容块（feed.tsx:735-752）：按 `showNativeComments → showTwikooComments → ...` 固定顺序硬编码渲染。

因此，`enabledSystems` 的排序只影响了默认激活系统的选择（`enabledSystems[0]`），**切换按钮的展示顺序始终是硬编码顺序**。用户期望的「显示顺序」即切换按钮的从左到右顺序，此需求未满足。

### 1.3 存储链路（需实测验证）

`comment.systemOrder` 为 JSON 数组，链路如下：

```
settings.tsx setConfigValue → draft.clientConfig["comment.systemOrder"]
  → saveSettingsConfigState → POST /config
    → config.ts persistRegularConfig → CacheImpl.set(key, array, false)
      → cache.ts save(): valueStr = JSON.stringify(array) → 写入 D1
    → 读取时 cache.ts load(): JSON.parse(row.value) → 恢复为数组
```

理论可行，但需验证：

1. 设置页 `loadSettingsConfigState` 返回的 `clientConfig["comment.systemOrder"]` 是否为数组类型（而非字符串）。
2. `buildClientConfigResponse` / `buildCombinedConfigResponse`（`server/src/services/config-helpers.ts`）透传时是否保持数组。

### 1.4 设置页回显

设置页加载时通过 `createSettingsConfigWrappers(draft)` 包装，`clientConfig.get("comment.systemOrder")` 直接读取 draft 中的值。若服务端返回数组，则回显正常；若返回字符串（如 `'["twikoo","native"]'`），则 `currentOrder` 长度判断会失败并回退默认顺序，导致排序 UI 与文章页均显示默认顺序。

## 2. 修复方案

### 2.1 核心修复：feed.tsx 动态渲染

将硬编码的切换按钮与评论区渲染改为基于排序后的 `enabledSystems` 数组动态渲染（已实施）：

```tsx
// 切换按钮：按排序后的 enabledSystems 渲染
{enabledSystems.map((system) => (
  <button
    key={system}
    onClick={() => setActiveSystem(system)}
    className={activeSystem === system ? "bg-theme text-white" : "bg-secondary ..."}
  >
    <i className={SYSTEM_ICONS[system]}></i>
    {t(`comment.system.${system}`)}
  </button>
))}

// 评论区内容：activeSystem 精确判断
{activeSystem === "native" && <CommentInput ... />}
{activeSystem === "twikoo" && <TwikooComment key={`twikoo-${id}`} feedId={id} />}
// ... 其余系统
```

- 已定义 `SYSTEM_ICONS` 映射：native=ri-message-3-line、twikoo=ri-chat-smile-2-line、giscus=ri-github-line、waline=ri-chat-3-line、cwd=ri-chat-2-line、gitalk=ri-github-line、utterances=ri-github-fill、discuss=ri-discuss-line。
- 评论区内容块只渲染 `activeSystem` 对应的组件，`showXxxComments` 布尔量已全部删除。

### 2.2 存储类型校验

在 `settings.tsx` 排序 UI 中增加类型兜底（已实施）：

```tsx
const rawOrder = clientConfig.get("comment.systemOrder");
const orderConfig = Array.isArray(rawOrder) ? (rawOrder as string[]) : [];
```

同时在 `normalizeSettingsState`（settings-helpers.ts）增加字符串化数组归一化：非数组时尝试 `JSON.parse`，成功且为数组则归一化，否则置为 `[]`。

### 2.3 验证清单

1. client + server tsc 通过（api 包 TS5096 为既有 tsconfig 配置问题，与本次无关）。
2. `cd client && bunx vitest run` 全绿（37/37）。
3. 手动验证：设置页启用 ≥2 个评论系统 → 调整顺序 → 保存 → 刷新文章页 → 切换按钮顺序与设置一致。
4. 验证 `comment.systemOrder` 在 D1 中的存取往返（GET /config 返回数组）——待线上环境实测。

## 3. 风险与注意事项

- `comment.systemOrder` 数组长度与启用系统数不一致时，feed.tsx 与 settings.tsx 均回退默认顺序，行为一致。
- 若服务端将数组序列化为字符串返回，需在 `buildClientConfigResponse` 或前端 `normalizeSettingsState` 统一归一化。
- 排序 UI 仅对「已启用」的系统生效；禁用某系统后，`comment.systemOrder` 中残留的旧值会导致长度不一致，自动回退默认顺序（可接受，或考虑过滤残留项）。
