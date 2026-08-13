# Task List: ai-enhanced-search

## 1. 配置层
- [ ] 1.1 packages/config 新增 `AI_SEARCH_ENABLED_KEY` 与 `DEFAULT_AI_SEARCH_ENABLED`
- [ ] 1.2 server/src/utils/db-config.ts 新增 `getAISearchEnabled`

## 2. 后端 LLM 执行器重构
- [ ] 2.1 server/src/utils/ai.ts 抽取通用 `executeAIWithFailover`（主用 + failover 链）
- [ ] 2.2 `generateAISummaryResult` 改为复用执行器，保持行为不变

## 3. AI 检索模块
- [ ] 3.1 server/src/utils/ai-search.ts：候选粗筛、prompt 构造、LLM 输出解析、主流程 `runAISearch`
- [ ] 3.2 packages/api/src/types.ts 新增 `mode`/`fallbackReason` 响应字段类型

## 4. 服务端接口
- [ ] 4.1 server/src/services/feed.ts SearchService 支持 `mode=ai` 与回退逻辑

## 5. 服务端测试
- [ ] 5.1 新增 server/src/utils/__tests__/ai-search.test.ts
- [ ] 5.2 更新 server/src/services/__tests__/feed.test.ts（mode=ai 集成用例）
- [ ] 5.3 更新 server/src/services/__tests__/config.test.ts（ai_search.enabled 读写）

## 6. 前端
- [ ] 6.1 client/src/api/client.ts SearchAPI 支持 `mode` 参数
- [ ] 6.2 client/src/page/search.tsx 模式切换 UI 与回退提示
- [ ] 6.3 client/src/page/settings-ai.tsx AI 搜索开关
- [ ] 6.4 i18n 文案（四种语言）

## 7. 前端测试
- [ ] 7.1 search.tsx 模式切换与回退提示测试
- [ ] 7.2 settings-ai.tsx AI 搜索开关测试
