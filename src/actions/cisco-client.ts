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

/**
 * Connect to VPN.
 * If username/password are provided, they are piped via stdin (-s mode).
 * For certificate-based or saved-credential profiles, leave them empty.
 */
export async function connectVpn(opts: ConnectOptions): Promise<boolean> {
  const cli = await findVpnCli();
  if (!cli) return false;

  return new Promise((resolve) => {
    const proc = spawn(cli, ["-s", "connect", opts.profile]);

    // Build stdin input: username\npassword\n[secondPassword\n]y\n
    if (opts.username && opts.password) {
      const lines = [opts.username, opts.password];
      if (opts.secondPassword) lines.push(opts.secondPassword);
      lines.push("y"); // accept banner
      proc.stdin.write(lines.join("\n") + "\n");
    }
    proc.stdin.end();

    proc.on("close", (code) => resolve(code === 0));
    proc.on("error", () => resolve(false));
  });
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
