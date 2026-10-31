# RSS のサポートと設定

Rin は RSS、Atom、Json の購読フォーマットをサポートしています。

## 設定

### 環境変数

RSS 自体は多くの設定を必要とせず、デフォルトで使用できます。ただし、以下の環境変数でデフォルト設定を変更できます：

```ini
RSS_TITLE=<RSS タイトル、デフォルトはユーザー名>
RSS_DESCRIPTION=<RSS の説明、デフォルトは Feed from Rin>
```

これらの環境変数は、GitHub の `Settings` > `Secrets and Variables` > `Actions` > `Variables` > `New repository variable` から追加できます。

## 使用方法

RSS は追加の Workers ルート設定を必要としなくなりました。デプロイ後、フィードエンドポイントに直接アクセスできます。

:::note
注：RSS 購読パスは `/sub/` からルートパスに移動しました。古い `/sub/` パスは後方互換性のために引き続き利用できます。
:::

RSS の購読アドレスは次のとおりです：

```
<frontend domain>/rss.xml
```

Atom の購読アドレスは次のとおりです：

```
<frontend domain>/atom.xml
```

Json の購読アドレスは次のとおりです：

```
<frontend domain>/rss.json
```