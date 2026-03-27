import {
  action,
  KeyDownEvent,
  SingletonAction,
  WillAppearEvent,
} from "@elgato/streamdeck";
import { getVpnStatus, connectVpn, disconnectVpn } from "./cisco-client";

type ToggleSettings = {
  profile?: string;
};

/**
 * VPN Toggle action: single button to connect/disconnect Cisco Secure Client
 * State 0 = disconnected, State 1 = connected
 */
@action({ UUID: "com.kanai.ciscovpn.toggle" })
export class VpnToggleAction extends SingletonAction<ToggleSettings> {
  private pollingInterval?: ReturnType<typeof setInterval>;

  override async onWillAppear(ev: WillAppearEvent<ToggleSettings>): Promise<void> {
    await this.updateState(ev.action);

    // Poll every 5 seconds to reflect external state changes
    this.pollingInterval = setInterval(async () => {
      await this.updateState(ev.action);
    }, 5000);
  }

  override async onWillDisappear(): Promise<void> {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = undefined;
    }
  }

  override async onKeyDown(ev: KeyDownEvent<ToggleSettings>): Promise<void> {
    const { profile = "" } = ev.payload.settings;
    const state = await getVpnStatus();

    if (state.status === "connected") {
      await disconnectVpn();
    } else {
      if (!profile) {
        await ev.action.setTitle("No Profile");
        return;
      }
      await connectVpn(profile);
    }

    // Wait briefly then update state
    await new Promise((r) => setTimeout(r, 2000));
    await this.updateState(ev.action);
  }

  private async updateState(actionRef: WillAppearEvent<ToggleSettings>["action"]): Promise<void> {
    const state = await getVpnStatus();
    switch (state.status) {
      case "connected":
        await actionRef.setState(1);
        await actionRef.setTitle(state.duration ? `${state.duration}` : "ON");
        break;
      case "connecting":
        await actionRef.setTitle("...");
        break;
      case "disconnected":
        await actionRef.setState(0);
        await actionRef.setTitle("OFF");
        break;
      default:
        await actionRef.setTitle("?");
    }
  }
}
