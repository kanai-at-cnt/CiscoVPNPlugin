import streamDeck, { LogLevel } from "@elgato/streamdeck";
import { VpnToggleAction } from "./actions/vpn-toggle";
import { VpnStatusAction } from "./actions/vpn-status";

// Enable trace logging during development
streamDeck.logger.setLevel(LogLevel.TRACE);

// Register actions
streamDeck.actions.registerAction(new VpnToggleAction());
streamDeck.actions.registerAction(new VpnStatusAction());

// Connect to Stream Deck
streamDeck.connect();
