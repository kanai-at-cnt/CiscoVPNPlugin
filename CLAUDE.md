# CiscoVPNPlugin

Elgato Stream Deck+ plugin for controlling Cisco Secure Client VPN.

## 技術スタック

- **SDK**: @elgato/streamdeck (v2)
- **言語**: TypeScript (ES2022)
- **ビルド**: Rollup + @elgato/rollup-plugin-streamdeck
- **対象OS**: macOS (Cisco Secure Client CLI依存)

## プラグイン構成

```
com.kanai.ciscovpn.sdPlugin/
├── manifest.json           # プラグイン定義
├── bin/plugin.js           # ビルド成果物
├── imgs/                   # アイコン画像 (SVG/PNG)
└── pi/                     # Property Inspector HTML
    ├── toggle.html
    └── status.html

src/
├── plugin.ts               # エントリポイント
└── actions/
    ├── cisco-client.ts     # Cisco CLI ラッパー
    ├── vpn-toggle.ts       # VPN Toggle アクション
    └── vpn-status.ts       # VPN Status アクション
```

## アクション

| アクション | UUID | 説明 |
|-----------|------|------|
| VPN Toggle | com.kanai.ciscovpn.toggle | ボタン1つで接続/切断トグル |
| VPN Status | com.kanai.ciscovpn.status | ステータス表示 (Encoder対応) |

## Cisco Secure Client CLI

macOSでのCLIパス:
- `/opt/cisco/secureclient/bin/vpn` (新バージョン)
- `/opt/cisco/anyconnect/bin/vpn` (旧バージョン)

主なコマンド:
```bash
vpn status              # 接続状態確認
vpn -s connect <profile> # プロファイル名で接続
vpn disconnect          # 切断
```

## 開発コマンド

```bash
npm install
npm run watch           # 開発時 (ホットリロード)
npm run build           # 本番ビルド
npm run link-plugin     # Stream Deckにリンク
```

## 注意事項

- macOS専用 (Cisco CLIがmacOSパスに依存)
- Stream Deck Software 6.4以上が必要
- アイコン画像 (imgs/) は別途作成が必要
