import { execFile } from "child_process";
import { promisify } from "util";

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
async function findVpnCli(): Promise<string | null> {
  const { access } = await import("fs/promises");
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
 * Parse the output of `vpn status` command
 */
function parseStatus(output: string): VpnState {
  const lower = output.toLowerCase();

  if (lower.includes("connected") && !lower.includes("disconnected")) {
    const profileMatch = output.match(/Profile\s*:\s*(.+)/i);
    const serverMatch = output.match(/Server\s*:\s*(.+)/i);
    const durationMatch = output.match(/Duration\s*:\s*(.+)/i);
    return {
      status: "connected",
      profile: profileMatch?.[1]?.trim(),
      serverAddress: serverMatch?.[1]?.trim(),
      duration: durationMatch?.[1]?.trim(),
    };
  } else if (lower.includes("connecting")) {
    return { status: "connecting" };
  } else if (lower.includes("disconnected") || lower.includes("not connected")) {
    return { status: "disconnected" };
  }

  return { status: "unknown" };
}

/**
 * Get current VPN connection status
 */
export async function getVpnStatus(): Promise<VpnState> {
  const cli = await findVpnCli();
  if (!cli) {
    return { status: "unknown" };
  }

  try {
    const { stdout } = await execFileAsync(cli, ["status"]);
    return parseStatus(stdout);
  } catch (err: unknown) {
    // vpn status can exit with non-zero when disconnected
    const error = err as { stdout?: string };
    if (error.stdout) {
      return parseStatus(error.stdout);
    }
    return { status: "unknown" };
  }
}

/**
 * Connect to VPN using specified profile
 */
export async function connectVpn(profile: string): Promise<boolean> {
  const cli = await findVpnCli();
  if (!cli) return false;

  try {
    await execFileAsync(cli, ["-s", "connect", profile]);
    return true;
  } catch {
    return false;
  }
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
