# 發布流程

本文件說明 Rin 專案的發布流程。

## 概述

Rin 使用[語意化版本控制](https://semver.org/lang/zh-CN/)，並遵循結構化的發布工作流程以確保穩定性與一致性。

**主要特性：**
- 🤖 **自動產生發布說明**：從一般提交資訊產生
- 📝 **詳盡的變更日誌**：在 `CHANGELOG.md` 中維護，內容包含遷移指南
- ✅ **自動驗證**：CI 檢查版本一致性並執行測試
- 🚀 **自動部署**：在版本標籤上部署到 Cloudflare

## 版本格式

版本遵循 `MAJOR.MINOR.PATCH` 格式：

- **MAJOR**：不相容的 API 變更
- **MINOR**：新功能（向後相容）
- **PATCH**：缺陷修正（向後相容）

預發布版本可以使用連字號標記，例如 `v1.0.0-beta.1`。

### 本專案版本線

本專案使用標準語意化版本，獨立版本線從 `v1.0.0` 開始，發布標籤為 `vX.Y.Z`：

- **MAJOR**：不相容的變更，`X` 加 1，低位歸零
- **MINOR**：向後相容的新功能，`Y` 加 1，`Z` 歸零
- **PATCH**：缺陷修正與小幅改動，`Z` 加 1
- **預發布**：使用 `-beta`、`-rc.1` 等後綴，例如 `v1.2.0-beta.1`

每次發布都要更新 `CHANGELOG.md` 與 `docs/docs/{zh,zh-TW,en,ja}/guide/changelog.md`；發布公告頁依改動規模與說明需求維護：改動較大或需要重點說明時會新建或更新公告頁，同一版本線的多次發布可合併到同一頁，頁面在 `_nav.json` 的部落格導覽中登記。

同一條目同時涉及官方原版（上游）的版本與本專案版本時，本專案版本寫作 `yjvX.Y.Z` 以示區別。

## 提交資訊規範

我們遵循 [Conventional Commits](https://www.conventionalcommits.org/zh-hans/v1.0.0/) 規範。這讓我們能自動產生發布說明。

### 快速參考

| 類型 | 描述 | 範例 |
|------|------|------|
| `feat` | 新功能 | `feat(auth): 新增 GitHub OAuth` |
| `fix` | 缺陷修正 | `fix(api): 解決 CORS 問題` |
| `docs` | 文件 | `docs(readme): 更新指南` |
| `refactor` | 程式碼重構 | `refactor(db): 最佳化查詢` |
| `perf` | 效能最佳化 | `perf(cache): 新增 Redis` |
| `chore` | 維護 | `chore(deps): 更新套件` |

更多細節，請參考[提交規範](./commit-convention.md)。

## 發布工作流程

### 1. 確認所有變更都已就緒

- [ ] 所有功能／修正都已合併到 `main`
- [ ] 所有提交都遵循[一般提交格式](./commit-convention.md)
- [ ] 測試通過（`bun run check`、`bun run build`）

### 2. 執行發布指令碼

```bash
# 升級修補版本（1.1.2 -> 1.1.3）
bun cli/bin/rin.ts release patch

# 升級次要版本（1.1.2 -> 1.2.0）
bun cli/bin/rin.ts release minor

# 升級主要版本（1.1.2 -> 2.0.0）
bun cli/bin/rin.ts release major

# 或設定特定版本
bun cli/bin/rin.ts release 1.2.3

# 預發布版本
bun cli/bin/rin.ts release 1.2.0-rc.1
```

指令碼將會：
1. ✅ 執行發布前檢查（型別檢查、建置、版本一致性）
2. 📝 更新 workspace 內所有 `package.json` 檔案中的版本
3. 🔗 為 `CHANGELOG.md` 追加 release 連結
4. 🏷️ 建立 git 提交與標籤

**重要**：指令碼不會替你撰寫 changelog 內文；它會要求 `CHANGELOG.md` 中已經存在與目標版本相符的章節。

### 3. 審閱與編輯 CHANGELOG

執行發布指令碼後：

```bash
# 開啟 CHANGELOG.md 並補上新版本章節
# 新增詳細描述、遷移指南等
nano CHANGELOG.md  # 或使用您慣用的編輯器

# 如果您做了變更，修改提交
git add CHANGELOG.md
git commit --amend --no-edit
```

### 4. 試執行（選用）

要在不套用變更的情況下預覽：

```bash
bun cli/bin/rin.ts release minor --dry-run
```

### 5. 推送發布

```bash
# 推送提交
git push origin main

# 推送標籤（觸發發布工作流程）
git push origin v1.2.0-rc.1
```

### 6. 自動發布流程

一旦標籤被推送，GitHub Actions 會自動：

1. **🔍 驗證**（`release.yml`）
   - 驗證版本一致性
   - 執行 typecheck 與 build

2. **📝 發布說明產生**（`release.yml`）
   - 依類型分類提交（功能、修正等）
   - 從 CHANGELOG.md 擷取詳細說明
   - 建立格式化的 GitHub Release
   - 將 `build-v<version>-cloudflare.tar.gz` 附加為 release asset

3. **🚀 部署**（`deploy.yml`）
   - 驗證部署版本
   - 部署到 Cloudflare Workers
   - 執行資料庫遷移

## 發布說明結構

GitHub Releases 會包含：

```markdown
## 變更內容

**完整變更日誌**：v1.1.0...v1.1.2

### 🚀 功能
- feat(auth): 新增 GitHub OAuth 登入 (abc1234)
- feat(ui): 實作深色模式 (def5678)

### 🐛 缺陷修正
- fix(api): 解決 CORS 問題 (ghi9012)

### 📋 詳細變更日誌
[此版本的 CHANGELOG.md 內容]

---

## 🆙 升級指南
...
```

## 給 Fork 使用者

### 使用 release 產物進行手動部署

如果您不想重新在自己的倉庫中建置，可以直接使用 GitHub Release 附帶的建置產物：

1. 開啟對應版本的 GitHub Release 頁面
2. 在 Assets 中找到 `build-v<version>-cloudflare.tar.gz`
3. 複製該檔案的下載連結
4. 手動觸發 `deploy.yml`，將這個連結作為 `artifact_url` 傳入

這個連結正是 `deploy.yml` 的 `artifact_url` 輸入設計要消費的內容。

### 選項 1：同步 Fork（建議）

1. 前往您在 GitHub 上的 fork 倉庫
2. 點擊 **"Sync fork"** 按鈕
3. 查看 [CHANGELOG.md](./changelog.md) 了解遷移步驟
4. 如有需要，更新環境變數
5. 若已設定，部署會自動執行

### 選項 2：手動更新

```bash
# 新增上游遠端
git remote add upstream https://github.com/openRin/Rin.git

# 取得最新變更
git fetch upstream

# 合併到您的 main 分支
git checkout main
git merge upstream/main

# 推送到您的 fork
git push origin main
```

## 發布檢查清單

在建立發布之前：

- [ ] 所有測試通過（`bun run check`、`bun run build`）
- [ ] 所有提交都遵循一般格式
- [ ] CHANGELOG.md 已事先寫好對應版本的章節
- [ ] 包含遷移指南（用於破壞性變更）
- [ ] 文件已更新（如有需要）

推送標籤後：

- [ ] GitHub Release 成功建立
- [ ] 發布說明看起來正確
- [ ] 部署成功完成

## 緊急發布

對於需要立即發布的嚴重缺陷：

```bash
# 從最新標籤建立 hotfix 分支
git checkout -b fix/critical-bug v1.1.2

# 套用修正並使用一般格式提交
git commit -m "fix(api): 解決嚴重安全問題"

# 執行發布指令碼
bun cli/bin/rin.ts release patch

# 推送（hotfix 不需要合併到 main）
git push origin fix/critical-bug
git push origin v1.1.3
```

## 疑難排解

### 版本不符錯誤

**問題**：CI 顯示「版本不符」錯誤

**解決方式**：
1. 確保 git 標籤與 `package.json` 版本相符
2. 發布指令碼會自動處理
3. 對於手動發布，請確認：`git tag v1.0.0` 與 package.json 中的 `"version": "1.0.0"` 相符

### 空白發布說明

**問題**：GitHub Release 沒有列出變更

**解決方式**：
1. 確保提交遵循一般格式（`feat:`、`fix:` 等）
2. 檢查標籤之間是否存在提交：`git log v1.1.0..v1.1.2 --oneline`
3. 非一般格式的提交不會出現在分類列表中

### 部署失敗

**問題**：發布後部署失敗

**解決方式**：
1. 查看 GitHub Actions 日誌以取得具體錯誤
2. 驗證所有必要的 secrets 都已設定
3. 檢查 Cloudflare 儀表板以取得部署錯誤
4. 如有需要，從 Actions 分頁手動觸發部署

### CHANGELOG.md 衝突

**問題**：CHANGELOG.md 中的合併衝突

**解決方式**：
1. 保留兩個部分
2. 依時間順序重新排列（最新的在前）
3. 刪除重複項目

## 最佳實務

### 撰寫好的提交

✅ **好的**：
```
feat(auth): 實作 JWT 權杖更新

新增自動更新權杖以避免工作階段逾時。
權杖會在到期前 5 分鐘更新。

Closes #123
```

❌ **不好的**：
```
update auth stuff
fixed bug
```

### 維護 CHANGELOG

- 在開發期間保持 [Unreleased] 部分更新
- 為破壞性變更撰寫遷移指南
- 在遷移部分包含程式碼範例
- 適當感謝貢獻者

### 版本升級

- **Patch** (1.1.3)：僅缺陷修正
- **Minor** (1.2.0)：新功能，向後相容
- **Major** (2.0.0)：破壞性變更

不確定時，新功能使用 **minor**。

> **版本號**：本專案使用標準語意化版本，版本線從 `v1.0.0` 開始，發布標籤為 `vX.Y.Z`，預發布版本使用 `-beta`、`-rc.1` 等後綴；同一條目同時涉及官方原版版本與本專案版本時，本專案版本寫作 `yjvX.Y.Z` 以示區別。

## 有問題？

- 📖 閱讀[提交規範](./commit-convention.md)了解提交指南
- 🐛 回報問題：[羊角快車二創版 Issues](https://github.com/wool-hmq/Rin/issues)
- 📖 官方原版 Issues（上游）：[openRin/Rin Issues](https://github.com/openRin/Rin/issues)
- 💬 加入我們的社群討論（二創版優先）
