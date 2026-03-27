# CiscoVPNPlugin

Stream Deck+ plugin for controlling **Cisco Secure Client** VPN.

## Features

- **VPN Toggle**: One-button connect/disconnect with visual state (off/on)
- **VPN Status**: Live status display on Stream Deck+ encoder touch screen, tap to toggle

## Requirements

- macOS with Cisco Secure Client installed
- Elgato Stream Deck Software 6.4+
- Node.js 20+

## Setup

```bash
npm install
npm run build
npm run link-plugin
```

## Development

```bash
npm run watch   # build with hot reload
```

## Actions

### VPN Toggle
A keypad button that toggles VPN connection. Configure the **VPN Profile Name** in the Property Inspector.

### VPN Status (Stream Deck+ Encoder)
Displays live VPN status on the touch display.
- **Dial press**: Refresh status
- **Touch tap**: Toggle VPN connection
- Configure poll interval (default: 5s) and profile name in Property Inspector.

## Cisco Secure Client CLI

The plugin uses the Cisco Secure Client CLI at:
- `/opt/cisco/secureclient/bin/vpn`
- `/opt/cisco/anyconnect/bin/vpn` (fallback)
