# 測試指南

本文件提供 Rin 專案中測試的完整指南。

## 概述

Rin 為用戶端與服務端使用不同的測試框架：

- **用戶端**：[Vitest](https://vitest.dev/) 搭配 jsdom 環境進行 React 元件測試
- **服務端**：[Bun 原生測試執行器](https://bun.sh/docs/cli/test) 搭配記憶體 SQLite 資料庫

## 執行測試

### 所有測試

```bash
# 執行用戶端與服務端測試
bun run test
```

### 用戶端測試

```bash
cd client

# 執行一次測試
bun run test

# 以監視模式執行測試
bun run test:watch

# 執行測試並產生覆蓋率報告
bun run test:coverage
```

### 服務端測試

```bash
cd server

# 執行一次測試
bun run test

# 執行測試並產生覆蓋率報告
bun run test:coverage
```

## 測試結構

### 用戶端測試

位置：`client/src/**/__tests__/*.test.ts`

```typescript
// 用戶端測試範例
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MyComponent } from '../components/MyComponent';

describe('MyComponent', () => {
  it('應該正確算繪', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
```

### 服務端測試

位置：
- 單元測試：`server/src/**/__tests__/*.test.ts`
- 整合測試：`server/tests/integration/*.test.ts`
- 安全測試：`server/tests/security/*.test.ts`

```typescript
// 服務端測試範例
import { describe, it, expect } from 'bun:test';
import { myFunction } from '../utils/myFunction';

describe('myFunction', () => {
  it('應該回傳正確結果', () => {
    const result = myFunction('input');
    expect(result).toBe('expected output');
  });
});
```

## 撰寫測試

### 用戶端測試

1. **元件測試**：單獨測試 React 元件
2. **API 用戶端測試**：測試 HTTP 用戶端與 API 呼叫
3. **工具函式測試**：測試輔助函式

範例：
```typescript
import { describe, it, expect } from 'vitest';
import { apiClient } from '../api/client';

describe('API Client', () => {
  it('應該處理 API 錯誤', async () => {
    const result = await apiClient.get('/nonexistent');
    expect(result.error).toBeDefined();
    expect(result.error?.status).toBe(404);
  });
});
```

### 服務端測試

1. **服務測試**：測試服務中的業務邏輯
2. **路由測試**：測試 API 端點
3. **工具函式測試**：測試輔助函式

使用資料庫的範例：
```typescript
import { describe, it, expect, beforeEach } from 'bun:test';
import { createMockDB } from '../../tests/fixtures';

describe('FeedService', () => {
  let db: any;

  beforeEach(() => {
    const mockDB = createMockDB();
    db = mockDB.db;
  });

  it('應該建立 feed', async () => {
    // 使用模擬資料庫進行測試
  });
});
```

## 測試夾具

服務端測試使用夾具來設定模擬資料：

- `server/tests/fixtures/index.ts` - 模擬資料庫與環境設定
- `server/tests/test-api-client.ts` - 用於測試的型別安全 API 用戶端

## 覆蓋率

用戶端與服務端都支援程式碼覆蓋率報告：

```bash
# 用戶端覆蓋率
bun run test:coverage

# 服務端覆蓋率  
bun run test:coverage
```

覆蓋率報告產生於：
- 用戶端：`client/coverage/`
- 服務端：`server/coverage/`

## CI/CD 整合

測試在以下情況自動執行：
- 每次推送到 `main` 或 `develop` 分支
- 每個 Pull Request
- 部署前（具阻塞性）

詳細資訊請參閱 [GitHub Actions 工作流程](./deploy.mdx#github-actions-工作流程)。

## 最佳實務

1. **為新功能撰寫測試**：每個新功能都應該包含測試
2. **測試邊界情況**：包含錯誤條件與邊界情況的測試
3. **使用描述性名稱**：測試描述應清楚說明正在測試什麼
4. **保持測試獨立**：每個測試都應該能夠獨立執行
5. **模擬外部相依**：為外部 API 與服務使用模擬

## 疑難排解

### 用戶端測試失敗

```bash
# 清除快取並重新安裝相依套件
rm -rf client/node_modules
bun install
```

### 服務端測試失敗

```bash
# 確認你在 server 目錄中
cd server
bun test
```

### 覆蓋率未產生

確認你在測試設定中設定了覆蓋率報告器。

## 其他資源

- [Vitest 文件](https://vitest.dev/guide/)
- [Bun 測試執行器](https://bun.sh/docs/cli/test)
- [Testing Library](https://testing-library.com/docs/)
