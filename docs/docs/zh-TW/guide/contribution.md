# 貢獻

我們非常樂意接受您對這個專案的修補與貢獻。您只需要遵循以下幾點小提醒即可。

## Commit-msg 掛鉤

我們在 `cli/templates/git-commit-msg.sh` 中提供了一個範例 commit-msg hook。請執行以下命令設定：

```sh
ln -s ../../cli/templates/git-commit-msg.sh ./.git/hooks/commit-msg
```

Windows 下請直接將 `commit-msg.sh` 檔案複製到 `.git/hooks/commit-msg`。

```powershell
cp .\scripts\commit-msg.sh .\.git\hooks\commit-msg
```

這會在每次提交之前執行以下檢查：

1. **型別檢查** - `bun run check` 驗證所有套件的 TypeScript 型別
2. **程式碼格式化** - 檢查程式碼格式與風格
3. **提交訊息格式** - 驗證提交訊息是否以下列其中一者開頭：`feat|chore|fix|docs|ci|style|test|pref`

:::warning 重要提示
掛鉤還會執行測試。提交前請確認所有測試皆通過：
```sh
bun run test
```
:::

如果您想略過掛鉤（不建議），請在執行 `git commit` 時使用 `--no-verify` 選項。

## 設定開發環境

1. Fork & Clone 倉庫

2. 安裝 [Node](https://nodejs.org/en/download/package-manager) 與 [Bun](https://bun.sh/)

3. 安裝相依項目
    ```sh
    bun i
    ```

4. 在 `.env.local` 檔案中填寫必要的設定

:::tip
一般情況下，您只需要填寫 `AVATAR`、`NAME` 與 `DESCRIPTION`。
如需設定 OAuth，請建立一個 OAuth App，回呼網址為 `http://localhost:11498/api/user/github/callback`（GitHub）、`http://localhost:11498/api/user/gitee/callback`（Gitee），或聯繫心月互聯取得 QQ 登入 Token。
:::

5. 執行設定腳本產生設定檔
```sh
bun run dev:setup
```

這會依照您的 `.env.local` 設定自動產生 `wrangler.toml` 與 `.dev.vars` 檔案。

6. 執行資料庫遷移
```sh
bun run db:migrate
```

7.（選用）設定 S3/R2 用於圖片上傳

若要使用圖片上傳功能，請在 `.env.local` 中填寫 S3 設定：
- `S3_ENDPOINT`
- `S3_BUCKET`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`

8. 啟動開發伺服器
    ```sh
    bun run dev
    ```

9. 為了更好地控制開發伺服器，您可以分別在兩個終端機中執行用戶端與服務端的 dev 命令：
    ```sh
    # tty1
    bun run dev:client
    
    # tty2
    bun run dev:server
    ```

## 測試要求

在提交 Pull Request 之前，請確認所有測試皆通過：

```sh
# 執行所有測試
bun run test

# 執行型別檢查
bun run check

# 執行格式化檢查
bun run format:check
```

### 為新功能新增測試

新增新的 API 端點時：
1. 在 `packages/api/src/types.ts` 中定義型別（用戶端與服務端共用）
2. 在 `server/src/**/__tests__/*.test.ts` 中新增服務端測試
3. 如有需要，在 `client/src/**/__tests__/*.test.ts` 中新增用戶端測試

## 提交變更

1. 對於單純的修補，在 UTC+8 時區的白天通常 10 分鐘內即可完成審查。

2. 當 PR 準備好接受審查後，請不要強制推送小幅度的變更。這會迫使維護者重新閱讀您的整個 PR，進而延誤審查流程。

3. 請隨時維持 CI 為綠燈。

4. 如果 CI 在您的 PR 上失敗，請不要推送。即使您認為這不是此修補的問題也一樣。如果是其他原因造成 CI 失敗，請在推送前協助修復根本原因。

*開始愉快地寫程式吧！*

## 程式碼審查
所有提交（包含專案成員的提交）都需要審查。我們使用 GitHub Pull Request 來達成此目的。有關使用 Pull Request 的更多資訊，請參閱 GitHub 說明文件。
