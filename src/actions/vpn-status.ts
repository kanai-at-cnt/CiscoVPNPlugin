import {
  action,
  SingletonAction,
  WillAppearEvent,
  WillDisappearEvent,
  DialUpEvent,
  TouchTapEvent,
} from "@elgato/streamdeck";
import { getVpnStatus, connectVpn, disconnectVpn } from "./cisco-client";

type StatusSettings = {
  profile?: string;
  username?: string;
  password?: string;
  secondPassword?: string;
  pollInterval?: number;
};

/**
 * VPN Status action: shows live VPN state on Stream Deck+ encoder/touch display.
 * - Dial release: refresh status
 * - Touch tap: toggle VPN
 */
@action({ UUID: "com.kanai.ciscovpn.status" })
export class VpnStatusAction extends SingletonAction<StatusSettings> {
  private pollingInterval?: ReturnType<typeof setInterval>;

  override async onWillAppear(ev: WillAppearEvent<StatusSettings>): Promise<void> {
    const intervalMs = (ev.payload.settings.pollInterval ?? 5) * 1000;
    await this.refresh(ev.action);
    this.pollingInterval = setInterval(async () => {
      await this.refresh(ev.action);
    }, intervalMs);
  }

  override async onWillDisappear(_ev: WillDisappearEvent<StatusSettings>): Promise<void> {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = undefined;
    }
  }

  // Dial release: refresh status
  override async onDialUp(ev: DialUpEvent<StatusSettings>): Promise<void> {
    await this.refresh(ev.action);
  }

  // Touch tap: toggle VPN
  override async onTouchTap(ev: TouchTapEvent<StatusSettings>): Promise<void> {
    const { profile = "", username, password, secondPassword } = ev.payload.settings;
    const state = await getVpnStatus();

    if (state.status === "connected") {
      await disconnectVpn();
    } else {
      if (!profile) {
        if ("setFeedback" in ev.action) {
          await ev.action.setFeedback({ title: "Set Profile" });
        }
        return;
      }
      await connectVpn({ profile, username, password, secondPassword });
    }

    await new Promise((r) => setTimeout(r, 2000));
    await this.refresh(ev.action);
  }

  private async refresh(
    actionRef: WillAppearEvent<StatusSettings>["action"]
  ): Promise<void> {
    const state = await getVpnStatus();

    const statusLine =
      state.status === "connected"
        ? `Connected\n${state.profile ?? ""}`
        : state.status === "connecting"
        ? "Connecting..."
        : state.status === "disconnected"
        ? "Disconnected"
        : "Unknown";

    // setFeedback (touch display) is only available on DialAction
    if ("setFeedback" in actionRef) {
      await actionRef.setFeedback({
        title: "Cisco VPN",
        value: statusLine,
      });
    }

    await actionRef.setTitle(state.status === "connected" ? "VPN ON" : "VPN OFF");
  }
}
