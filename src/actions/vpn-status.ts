import {
  action,
  SingletonAction,
  WillAppearEvent,
  DialPressEvent,
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
 * VPN Status action: shows live VPN state on Stream Deck+ encoder/touch display
 * - Dial press: refresh status
 * - Touch tap: toggle VPN
 * - Long touch: disconnect
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

  override async onWillDisappear(): Promise<void> {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = undefined;
    }
  }

  override async onDialPress(ev: DialPressEvent<StatusSettings>): Promise<void> {
    if (ev.payload.pressed) return; // only act on release
    await this.refresh(ev.action);
  }

  override async onTouchTap(ev: TouchTapEvent<StatusSettings>): Promise<void> {
    const { profile = "", username, password, secondPassword } = ev.payload.settings;
    const state = await getVpnStatus();

    if (state.status === "connected") {
      await disconnectVpn();
    } else {
      if (!profile) {
        await ev.action.setFeedback({ title: "Set Profile" });
        return;
      }
      await connectVpn({ profile, username, password, secondPassword });
    }

    await new Promise((r) => setTimeout(r, 2000));
    await this.refresh(ev.action);
  }

  private async refresh(actionRef: WillAppearEvent<StatusSettings>["action"]): Promise<void> {
    const state = await getVpnStatus();

    const label = state.status === "connected"
      ? `Connected\n${state.profile ?? ""}`
      : state.status === "connecting"
      ? "Connecting..."
      : state.status === "disconnected"
      ? "Disconnected"
      : "Unknown";

    await actionRef.setFeedback({
      title: "Cisco VPN",
      value: label,
    });

    await actionRef.setTitle(state.status === "connected" ? "VPN ON" : "VPN OFF");
  }
}
