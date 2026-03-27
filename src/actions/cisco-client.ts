import { execFile, spawn } from "child_process";
import { promisify } from "util";
import { access } from "fs/promises";

const execFileAsync = promisify(execFile);

// Cisco Secure Client CLI paths (macOS)
const VPN_CLI_PATHS = [
  "/opt/cisco/secureclient/bin/vpn",
  "/opt/cisco/anyconnect/bin/vpn",
];

export type VpnStatus = "connected" | "disconnected" | "connecting" | "unknown";

export interface VpnState {
  status: VpnStatus;
  profile?: string;
  serverAddress?: string;
  duration?: string;
}

/**
 * Find the Cisco Secure Client CLI binary
 */
export async function findVpnCli(): Promise<string | null> {
  for (const path of VPN_CLI_PATHS) {
    try {
      await access(path);
      return path;
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * Parse the output of `vpn status` command (handles English and Japanese output)
 */
function parseStatus(output: string): VpnState {
  const lower = output.toLowerCase();

  const isConnected =
    lower.includes("connected") ||
    output.includes("接続済み") ||
    output.includes("接続されました");

  const isDisconnected =
    lower.includes("disconnected") ||
    lower.includes("not connected") ||
    output.includes("切断されました") ||
    output.includes("切断済み");

  const isConnecting =
    lower.includes("connecting") ||
    output.includes("接続中") ||
    output.includes("接続しています");

  if (isConnected && !isDisconnected) {
    const profileMatch = output.match(/Profile\s*:\s*(.+)/i);
    const serverMatch = output.match(/Server\s*:\s*(.+)/i);
    const durationMatch = output.match(/Duration\s*:\s*(.+)/i);
    return {
      status: "connected",
      profile: profileMatch?.[1]?.trim(),
      serverAddress: serverMatch?.[1]?.trim(),
      duration: durationMatch?.[1]?.trim(),
    };
  } else if (isConnecting) {
    return { status: "connecting" };
  } else if (isDisconnected) {
    return { status: "disconnected" };
  }

  return { status: "unknown" };
}

/**
 * Get current VPN connection status
 */
export async function getVpnStatus(): Promise<VpnState> {
  const cli = await findVpnCli();
  if (!cli) return { status: "unknown" };

  try {
    const { stdout } = await execFileAsync(cli, ["status"]);
    return parseStatus(stdout);
  } catch (err: unknown) {
    // vpn status can exit non-zero when disconnected
    const error = err as { stdout?: string };
    if (error.stdout) return parseStatus(error.stdout);
    return { status: "unknown" };
  }
}

/**
 * List available VPN profiles via `vpn hosts`
 */
export async function listProfiles(): Promise<string[]> {
  const cli = await findVpnCli();
  if (!cli) return [];

  try {
    const { stdout } = await execFileAsync(cli, ["hosts"]);
    return stdout
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith(">") && !line.toLowerCase().includes("host"));
  } catch {
    return [];
  }
}

export interface ConnectOptions {
  profile: string;
  username?: string;
  password?: string;
  /** Second password / MFA token (e.g. TOTP) */
  secondPassword?: string;
}

export interface ConnectResult {
  success: boolean;
  output: string;
}

/** Cisco Secure Client GUI app name */
const GUI_APP = "Cisco Secure Client";

/** GUI が起動しているか確認 */
async function isGuiRunning(): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync("pgrep", ["-x", "Cisco Secure Client"]);
    return stdout.trim().length > 0;
  } catch {
    return false;
  }
}

/** GUI を終了する */
async function quitGui(): Promise<void> {
  try {
    await execFileAsync("osascript", ["-e", `quit app "${GUI_APP}"`]);
    // プロセスが完全に終了するまで待つ
    await new Promise((r) => setTimeout(r, 1500));
  } catch {
    // 起動していなければ無視
  }
}

/** GUI を起動する */
async function launchGui(): Promise<void> {
  try {
    await execFileAsync("open", ["-a", GUI_APP]);
  } catch {
    // 無視
  }
}

/**
 * Connect to VPN.
 * Cisco Secure Client GUI が起動していると CLI が使えないため、
 * GUI を一時終了 → CLI 接続 → GUI を再起動する。
 */
export async function connectVpn(opts: ConnectOptions): Promise<ConnectResult> {
  const cli = await findVpnCli();
  if (!cli) return { success: false, output: "CLI not found" };

  if (!opts.username || !opts.password) {
    return { success: false, output: "No credentials: set Username and Password in settings" };
  }

  // GUI が動いていたら終了する
  const guiWasRunning = await isGuiRunning();
  if (guiWasRunning) {
    await quitGui();
    // vpnagentd が GUI なしで接続を受け付けるまで待つ
    await new Promise((r) => setTimeout(r, 3000));
  }

  const result = await new Promise<ConnectResult>((resolve) => {
    const proc = spawn(cli, ["-s", "connect", opts.profile]);
    const chunks: string[] = [];

    proc.stdout.on("data", (d: Buffer) => chunks.push(d.toString()));
    proc.stderr.on("data", (d: Buffer) => chunks.push(d.toString()));

    const lines = [opts.username!, opts.password!];
    if (opts.secondPassword) lines.push(opts.secondPassword);
    lines.push("y"); // accept banner
    proc.stdin.write(lines.join("\n") + "\n");
    proc.stdin.end();

    proc.on("close", (code) => {
      const output = chunks.join("").trim();
      resolve({ success: code === 0, output });
    });
    proc.on("error", (err) => resolve({ success: false, output: err.message }));
  });

  // GUI を再起動して接続状態を反映 (接続成功/失敗に関わらず)
  if (guiWasRunning) {
    await launchGui();
  }

  return result;
}

/**
 * Disconnect from VPN
 */
export async function disconnectVpn(): Promise<boolean> {
  const cli = await findVpnCli();
  if (!cli) return false;

  try {
    await execFileAsync(cli, ["disconnect"]);
    return true;
  } catch {
    return false;
  }
}
