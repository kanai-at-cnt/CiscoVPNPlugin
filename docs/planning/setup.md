# セットアップガイド

## 前提条件

| 要件 | バージョン |
|------|-----------|
| macOS | 10.15 (Catalina) 以上 |
| Cisco Secure Client | 5.x |
| Node.js | 20 以上 |
| Stream Deck Software | 6.4 以上 |
| Stream Deck+ デバイス | — |

---

## インストール手順

### 1. 依存パッケージのインストール

```bash
cd ~/projects/CiscoVPNPlugin
npm install
```

### 2. ビルド

```bash
npm run build
```

### 3. Stream Deck へリンク

```bash
npm run link-plugin
```

Stream Deck Software を**再起動**するとアクション一覧に「Cisco VPN」カテゴリが表示される。

---

## アクセシビリティ権限の付与 (必須)

AppleScript による GUI 操作に必要。

1. **システム設定** を開く
2. **プライバシーとセキュリティ** → **アクセシビリティ**
3. **Stream Deck** を追加してオンにする

> Stream Deck Software を再起動後に有効になる。

---

## 使い方

### VPN Toggle (キーパッドボタン)

1. Stream Deck アプリでボタンに **VPN Toggle** を配置
2. 右パネル (Property Inspector) で **VPN Profile / Server** を入力
   - 例: `vpn.example.com/profile_name`
3. ボタンを押すと接続/切断をトグル

**ボタン表示:**

| 表示 | 意味 |
|------|------|
| `OFF` (赤シールド) | 切断済み |
| `接続中...` | 処理中 |
| `ON` または経過時間 (緑シールド) | 接続済み |
| エラーメッセージ | 失敗 (4秒後にリセット) |

### VPN Status (エンコーダー)

1. Stream Deck+ のエンコーダーに **VPN Status** を配置
2. Property Inspector で **VPN Profile / Server** と **Poll Interval** を設定
3. タッチ画面にリアルタイムでステータスが表示される

**操作:**

| 操作 | 動作 |
|------|------|
| タッチタップ | VPN トグル (接続/切断) |
| ダイヤル押し (離した時) | ステータス即時更新 |

---

## 開発

```bash
# ウォッチモード (ファイル変更で自動ビルド)
npm run watch

# ログ確認
tail -f ~/projects/CiscoVPNPlugin/com.kanai.ciscovpn.sdPlugin/logs/com.kanai.ciscovpn.0.log
```

---

## トラブルシューティング

### アクションが表示されない

→ Stream Deck Software を完全に再起動する

### 「osascriptには補助アクセスは許可されません」エラー

→ アクセシビリティ権限を付与する ([上記手順](#アクセシビリティ権限の付与-必須))

### 接続後もボタンが OFF のまま

→ `vpn status` の出力を確認。日本語ロケール以外の場合は `cisco-client.ts` の `parseStatus` を要修正。

### SAML 認証画面が開かない

→ Cisco Secure Client GUI が起動しているか確認。GUI がないと AppleScript の操作対象がない。
