import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

const VPN_CLI = "/opt/cisco/secureclient/bin/vpn";
const GUI_APP = "Cisco Secure Client";
const WIN_NAME = "Ciscoセキュアクライアント";

export type VpnStatus = "connected" | "disconnected" | "connecting" | "unknown";

export interface VpnState {
  status: VpnStatus;
  serverAddress?: string;
  duration?: string;
}

export interface ConnectResult {
  success: boolean;
  output: string;
}

// ---------------------------------------------------------------------------
// AppleScript helpers
// ---------------------------------------------------------------------------

async function runScript(script: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync("osascript", ["-e", script]);
    return stdout.trim();
  } catch (err: unknown) {
    const e = err as { stderr?: string; stdout?: string };
    throw new Error(e.stderr ?? e.stdout ?? String(err));
  }
}

// ---------------------------------------------------------------------------
// Status (CLIで取得 — statusはSAML不要なので動く)
// ---------------------------------------------------------------------------

function parseStatus(output: string): VpnState {
  const isConnected =
    output.toLowerCase().includes("connected") ||
    output.includes("接続済み") ||
    output.includes("接続されました") ||
    output.includes("接続中"); // Cisco日本語CLIでは接続済み状態を「接続中」と表示する

  const isDisconnected =
    output.toLowerCase().includes("disconnected") ||
    output.includes("切断されました") ||
    output.includes("切断済み") ||
    output.includes("接続する準備ができました");

  const isConnecting =
    output.toLowerCase().includes("connecting");

  if (isConnected && !isDisconnected) {
    const serverMatch = output.match(/Server\s*:\s*(.+)/i);
    const durationMatch = output.match(/Duration\s*:\s*(.+)/i);
    return {
      status: "connected",
      serverAddress: serverMatch?.[1]?.trim(),
      duration: durationMatch?.[1]?.trim(),
    };
  }
  if (isConnecting) return { status: "connecting" };
  if (isDisconnected) return { status: "disconnected" };
  return { status: "unknown" };
}

export async function getVpnStatus(): Promise<VpnState> {
  try {
    const { stdout } = await execFileAsync(VPN_CLI, ["status"]);
    return parseStatus(stdout);
  } catch (err: unknown) {
    const e = err as { stdout?: string };
    if (e.stdout) return parseStatus(e.stdout);
    return { status: "unknown" };
  }
}

// ---------------------------------------------------------------------------
// Connect / Disconnect via AppleScript GUI automation
// ---------------------------------------------------------------------------

/**
 * Connect: Cisco Secure Client GUI の接続ボタンをクリックする。
 * サーバー欄に profile を設定してから「接続」ボタンを押す。
 *
 * ※ 事前に アクセシビリティ権限 が必要:
 *    システム設定 → プライバシーとセキュリティ → アクセシビリティ
 *    → "Stream Deck" または "node" を追加
 */
export async function connectVpn(profile: string): Promise<ConnectResult> {
  const script = `
    tell application "${GUI_APP}" to activate
    delay 0.8
    tell application "System Events"
      tell process "${GUI_APP}"
        tell window "${WIN_NAME}"
          set value of combo box 1 to "${profile}"
          click button "接続"
        end tell
      end tell
    end tell
    return "ok"
  `;
  try {
    await runScript(script);
    return { success: true, output: "接続ボタンをクリックしました" };
  } catch (err: unknown) {
    return { success: false, output: String(err) };
  }
}

/**
 * Disconnect: 「切断」ボタンをクリックする。
 */
export async function disconnectVpn(): Promise<ConnectResult> {
  const script = `
    tell application "${GUI_APP}" to activate
    delay 0.8
    tell application "System Events"
      tell process "${GUI_APP}"
        tell window "${WIN_NAME}"
          click button "切断"
        end tell
      end tell
    end tell
    return "ok"
  `;
  try {
    await runScript(script);
    return { success: true, output: "切断ボタンをクリックしました" };
  } catch (err: unknown) {
    return { success: false, output: String(err) };
  }
}
