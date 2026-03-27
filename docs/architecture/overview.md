# CiscoVPNPlugin — アーキテクチャ概要

## 概要

Elgato Stream Deck+ から Cisco Secure Client VPN を操作するプラグイン。

| 項目 | 内容 |
|------|------|
| SDK | @elgato/streamdeck v2 |
| 言語 | TypeScript (ES2022) |
| ビルド | Rollup |
| 対象 OS | macOS (Cisco Secure Client 依存) |
| 対象デバイス | Stream Deck+ (キーパッド + エンコーダー) |

---

## システム構成

```
┌─────────────────────────────────────────────────────┐
│                   Stream Deck+                      │
│  ┌─────────────┐         ┌──────────────────────┐  │
│  │ VPN Toggle  │         │     VPN Status        │  │
│  │  (Keypad)   │         │ (Encoder + Touch LCD) │  │
│  └──────┬──────┘         └──────────┬───────────┘  │
└─────────┼──────────────────────────┼───────────────┘
          │ Stream Deck SDK (WebSocket)
          ▼
┌─────────────────────────────────────────────────────┐
│              Plugin Process (Node.js)               │
│                                                     │
│  ┌──────────────┐    ┌──────────────────────────┐  │
│  │ VpnToggle    │    │ VpnStatus                │  │
│  │ Action       │    │ Action                   │  │
│  └──────┬───────┘    └──────────┬───────────────┘  │
│         └──────────┬────────────┘                  │
│                    ▼                                │
│           ┌────────────────┐                       │
│           │  cisco-client  │                       │
│           │  (ブリッジ層)   │                       │
│           └───┬────────┬───┘                       │
└───────────────┼────────┼───────────────────────────┘
                │        │
      ┌─────────┘        └──────────┐
      ▼                             ▼
┌───────────┐              ┌────────────────────┐
│ vpn CLI   │              │ osascript          │
│ (status)  │              │ (connect/disconnect)│
└─────┬─────┘              └────────┬───────────┘
      │                             │
      ▼                             ▼
┌───────────────────────────────────────────────┐
│         Cisco Secure Client (macOS)           │
│  ┌────────────┐      ┌──────────────────────┐ │
│  │ vpnagentd  │      │  GUI App             │ │
│  │ (daemon)   │      │  (SAML auth対応)     │ │
│  └────────────┘      └──────────────────────┘ │
└───────────────────────────────────────────────┘
```

---

## 重要設計判断

### CLI ではなく AppleScript GUI 操作を採用した理由

当初は Cisco Secure Client CLI (`/opt/cisco/secureclient/bin/vpn connect`) による接続を実装したが、以下のエラーが発生した:

```
>> error: 要求された認証タイプは、AnyConnectのCLIではサポートされていません。
>> The requested authentication type is not supported in AnyConnect CLI.
```

対象の VPN サーバー (`vpn.azg.jp`) が **SAML/SSO 認証**を使用しており、ブラウザを必要とするため CLI では認証不可。

**解決策**: `osascript` (AppleScript) で GUI の「接続」/「切断」ボタンを直接クリックする。

| 操作 | 実装方式 | 理由 |
|------|----------|------|
| 接続 | AppleScript (GUI操作) | SAML認証にブラウザが必要 |
| 切断 | AppleScript (GUI操作) | GUIと状態を同期するため |
| 状態取得 | CLI (`vpn status`) | 認証不要で動作する |

### 日本語ロケール対応

Cisco Secure Client の日本語 CLI 出力における注意点:

| CLI 出力 | 意味 | 英語版 |
|----------|------|--------|
| `接続中` | **接続済み** (connected) | `Connected` |
| `切断されました` | 切断済み | `Disconnected` |
| `接続する準備ができました` | 切断済み (待機中) | `Ready to connect` |

> **注意**: 「接続中」は英語の "connecting" (接続処理中) ではなく "connected" (接続済み) を意味する。
