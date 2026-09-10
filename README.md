# Restaurant POS Operations Analytics

這是一個可直接部署到 GitHub Pages 的互動式 POS 營運分析 Demo。

## 專案內容
- Overview：營業額、來客數、客單價、翻桌率、平均用餐時間
- Store：門市績效比較
- Customer：會員 / 非會員、高價值會員
- Product：熱門商品、品類、購物籃搭配、商品折扣
- Operations：自動找出營運異常並提出可能原因與改善方向

## 技術
- HTML
- CSS
- Vanilla JavaScript
- Chart.js
- 內嵌 Synthetic POS Dataset（不需資料庫）

## 如何在本機開啟
直接雙擊 `index.html` 即可。
圖表使用 Chart.js CDN，因此需連網。

## GitHub Pages 部署
1. 在 GitHub 建立新的 repository，例如 `pos-analytics-demo`
2. 把本資料夾內所有檔案上傳到 repository 根目錄
3. 進入 GitHub Repository → Settings → Pages
4. Source 選擇 `Deploy from a branch`
5. Branch 選 `main` / `(root)`
6. 儲存後即可取得公開網站網址

例如：
`https://<你的GitHub帳號>.github.io/pos-analytics-demo/`

## 資料說明
所有顧客、會員、交易與門市資料均為模擬資料，只用於作品集展示，不含真實個資。
