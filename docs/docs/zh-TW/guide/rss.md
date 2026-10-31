# RSS 設定

Rin 支援 RSS、Atom、Json 三種訂閱格式

## 環境變數

RSS 本身不需要太多設定，預設即可直接使用。不過你可以透過以下環境變數修改其預設設定：

```ini
RSS_TITLE=<RSS 標題，預設為你的使用者名稱>
RSS_DESCRIPTION=<RSS 描述，預設為 Feed from Rin>
```

以上環境變數只要在 Github 的 `Settings` > `Secrets and Variables` > `Actions` > `Variables` > `New repository variable` 中新增即可。

## 使用方式

RSS 現在不需要額外設定 Workers 路由，部署完成後即可直接存取訂閱網址。

:::note
注意：RSS 訂閱網址已經從 `/sub/` 路徑遷移至根路徑，舊的 `/sub/` 路徑仍然可用以維持向後相容。
:::

RSS 的訂閱網址為：

```
<前端網域>/rss.xml
```

Atom 的訂閱網址為：

```
<前端網域>/atom.xml
```

Json 的訂閱網址為：

```
<前端網域>/rss.json
```
