# テストガイド

このドキュメントは、Rin プロジェクトにおけるテストの包括的なガイドです。

## 概要

Rin はクライアントとサーバーで異なるテストフレームワークを使用します：

- **クライアント**: React コンポーネントテスト用の jsdom 環境を備えた [Vitest](https://vitest.dev/)
- **サーバー**: インメモリ SQLite データベースを使用した [Bun のネイティブテストランナー](https://bun.sh/docs/cli/test)

## テストの実行

### すべてのテスト

```bash
# クライアントとサーバーの両方のテストを実行
bun run test
```

### クライアントテスト

```bash
cd client

# テストを一度実行
bun run test

# ウォッチモードでテストを実行
bun run test:watch

# カバレッジ付きでテストを実行
bun run test:coverage
```

### サーバーテスト

```bash
cd server

# テストを一度実行
bun run test

# カバレッジ付きでテストを実行
bun run test:coverage
```

## テスト構造

### クライアントテスト

場所: `client/src/**/__tests__/*.test.ts`

```typescript
// クライアントテストの例
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MyComponent } from '../components/MyComponent';

describe('MyComponent', () => {
  it('should render correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
```

### サーバーテスト

場所:
- ユニットテスト: `server/src/**/__tests__/*.test.ts`
- 統合テスト: `server/tests/integration/*.test.ts`
- セキュリティテスト: `server/tests/security/*.test.ts`

```typescript
// サーバーテストの例
import { describe, it, expect } from 'bun:test';
import { myFunction } from '../utils/myFunction';

describe('myFunction', () => {
  it('should return correct result', () => {
    const result = myFunction('input');
    expect(result).toBe('expected output');
  });
});
```

## テストの作成

### クライアントテスト

1. **コンポーネントテスト**: React コンポーネントを分離してテスト
2. **API クライアントテスト**: HTTP クライアントと API 呼び出しをテスト
3. **ユーティリティテスト**: ヘルパー関数をテスト

例:
```typescript
import { describe, it, expect } from 'vitest';
import { apiClient } from '../api/client';

describe('API Client', () => {
  it('should handle API errors', async () => {
    const result = await apiClient.get('/nonexistent');
    expect(result.error).toBeDefined();
    expect(result.error?.status).toBe(404);
  });
});
```

### サーバーテスト

1. **サービステスト**: サービス内のビジネスロジックをテスト
2. **ルーターテスト**: API エンドポイントをテスト
3. **ユーティリティテスト**: ヘルパー関数をテスト

データベースを使用した例:
```typescript
import { describe, it, expect, beforeEach } from 'bun:test';
import { createMockDB } from '../../tests/fixtures';

describe('FeedService', () => {
  let db: any;

  beforeEach(() => {
    const mockDB = createMockDB();
    db = mockDB.db;
  });

  it('should create a feed', async () => {
    // モックデータベースを使用したテスト
  });
});
```

## テストフィクスチャ

サーバーテストはモックデータ用のフィクスチャを使用します：

- `server/tests/fixtures/index.ts` - モックデータベースと環境のセットアップ
- `server/tests/test-api-client.ts` - テスト用の型安全な API クライアント

## カバレッジ

クライアントとサーバーの両方がコードカバレッジレポートをサポートします：

```bash
# クライアントカバレッジ
bun run test:coverage

# サーバーカバレッジ
bun run test:coverage
```

カバレッジレポートは以下に生成されます：
- クライアント: `client/coverage/`
- サーバー: `server/coverage/`

## CI/CD 統合

テストは以下で自動的に実行されます：
- `main` または `develop` ブランチへのプッシュごと
- すべてのプルリクエスト
- デプロイ前（ブロッキング）

詳細は [GitHub Actions ワークフロー](./deploy.mdx#github-actions-ワークフロー) を参照してください。

## ベストプラクティス

1. **新機能のテストを書く**: すべての新機能にはテストを含める必要があります
2. **エッジケースをテストする**: エラー条件と境界ケースのテストを含めます
3. **説明的な名前を使用する**: テストの説明は、何をテストしているかを明確に述べる必要があります
4. **テストを独立させる**: 各テストは独立して実行できる必要があります
5. **外部依存関係をモックする**: 外部 API とサービスにはモックを使用します

## トラブルシューティング

### クライアントテストが失敗する

```bash
# キャッシュをクリアして依存関係を再インストール
rm -rf client/node_modules
bun install
```

### サーバーテストが失敗する

```bash
# サーバーディレクトリにいることを確認
cd server
bun test
```

### カバレッジが生成されない

テスト設定でカバレッジレポーターが構成されていることを確認してください。

## 追加リソース

- [Vitest ドキュメント](https://vitest.dev/guide/)
- [Bun テストランナー](https://bun.sh/docs/cli/test)
- [Testing Library](https://testing-library.com/docs/)