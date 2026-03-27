import {
  action,
  KeyDownEvent,
  SingletonAction,
  WillAppearEvent,
  WillDisappearEvent,
} from "@elgato/streamdeck";
import streamDeck from "@elgato/streamdeck";
import { getVpnStatus, connectVpn, disconnectVpn } from "./cisco-client";

type ToggleSettings = {
  profile?: string;
};

const logger = streamDeck.logger.createScope("VpnToggle");

@action({ UUID: "com.kanai.ciscovpn.toggle" })
export class VpnToggleAction extends SingletonAction<ToggleSettings> {
  private pollingInterval?: ReturnType<typeof setInterval>;

  override async onWillAppear(ev: WillAppearEvent<ToggleSettings>): Promise<void> {
    await this.updateState(ev.action);
    this.pollingInterval = setInterval(async () => {
      await this.updateState(ev.action);
    }, 5000);
  }

  override async onWillDisappear(_ev: WillDisappearEvent<ToggleSettings>): Promise<void> {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = undefined;
    }
  }

  override async onKeyDown(ev: KeyDownEvent<ToggleSettings>): Promise<void> {
    const { profile = "" } = ev.payload.settings;
    if (!("setState" in ev.action)) return;

    const state = await getVpnStatus();
    logger.info(`Current state: ${state.status}`);

    if (state.status === "connected") {
      await ev.action.setTitle("切断中...");
      const result = await disconnectVpn();
      logger.info(`Disconnect: ${result.output}`);
      if (!result.success) {
        await ev.action.setTitle("Error");
        await new Promise((r) => setTimeout(r, 3000));
      }
    } else {
      if (!profile) {
        await ev.action.setTitle("No Profile");
        return;
      }
      await ev.action.setTitle("接続中...");
      logger.info(`Connecting to: ${profile}`);
      const result = await connectVpn(profile);
      logger.info(`Connect: ${result.output}`);
      if (!result.success) {
        const msg = result.output.replace(/^Error:\s*/i, "").slice(0, 25);
        await ev.action.setTitle(msg || "Error");
        logger.error(`Connect failed: ${result.output}`);
        await new Promise((r) => setTimeout(r, 4000));
      }
    }

    // 状態が変わるまで最大15秒ポーリング
    for (let i = 0; i < 5; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      const newState = await getVpnStatus();
      logger.info(`Poll ${i + 1}: ${newState.status}`);
      await this.updateState(ev.action);
      if (newState.status === "connected" || newState.status === "disconnected") break;
    }
  }

  private async updateState(
    actionRef: WillAppearEvent<ToggleSettings>["action"]
  ): Promise<void> {
    if (!("setState" in actionRef)) return;
    const state = await getVpnStatus();
    switch (state.status) {
      case "connected":
        await actionRef.setState(1);
        await actionRef.setTitle(state.duration ?? "ON");
        break;
      case "connecting":
        await actionRef.setTitle("接続中...");
        break;
      default:
        await actionRef.setState(0);
        await actionRef.setTitle("OFF");
    }
  }
}
