# WebXR Sync System (Plugin Version)

## Overview

The Plugin Version of WebXR Sync System is designed to achieve positional synchronization between mobile devices and Meta Quest headsets, enabling real-time tracking of the mobile device's position by the headset to enable various cross-device interaction features.

###### ⚠️ **Current limitation:**

No mobile browser currently supports both WebXR AR and WebExtensions. As a result, the **extension version of the Phone client cannot run** in practice, since it cannot request AR sessions or camera access.

See **Browser Comparison.xlsx** for details.

## Server Setup

##### Starting the Server

```
cd Server
node Server.js
```

The server will start on port 3001, open `https://your-ip:3001` in your browser to verify it's running.

## Mobile (Phone) Setup

##### 1. Configure IP Address

Edit `Phone/background.js` and replace the `SERVER_URL` IP address with your local network IP.

##### 2. Running the Extension

```
cd Phone

# To find your Android device ID:
npx web-ext run --target=firefox-android

# Run with Firefox for Android
npx web-ext run --target=firefox-android --android-device=YOUR_DEVICE_ID

# Or specify a specific Firefox version
npx web-ext run --target=firefox-android --android-device=YOUR_DEVICE_ID --firefox-apk=org.mozilla.firefox
```

##### 3. Connect Devices

- Ensure the server is running

- Enable the extension on your mobile device

- Open the extension popup and join a room, then enter AR mode to begin the system

## Meta Quest Setup

##### 1. Configure IP Address

Edit `Quest/index.html` and replace the sync/server IP address with your local network IP.

##### 2. Running the Client

```
cd Quest
npx vite dev
```

Vite will provide a local development URL (typically `https://your-ip:5173`).

##### 3. Connect Devices

- Ensure both server and client are running

- Open the provided URL in the Meta Quest browser

- Join the same room as your mobile device

- Enter AR mode to begin the system

## Establishing Connection

1. Start the server on your local machine

2. Launch the mobile extension on your Android device

3. Run the Quest client and open it in the Quest browser

4. Join the same room on both devices

5. Enter AR mode to initiate the synchronized experience

## Common Issues

1. **Connection Problems**
   
   - Ensure all devices are on the same network and have the same IP Address
   
   - Verify the IP address in the configuration matches your local IP
   
   - Check that no firewall is blocking the connection
   
   - Check that ports 3001 (server) and 5173 (client) are accessible

2. **Extension Not Working**
   
   - Use supported browsers (Firefox for Android) and enable developer mode
   
   - Grant necessary permissions to the extension

3. **WebXR Not Available**
   
   - Use supported browsers (Chrome for Android, Quest Browser)
   
   - Enable WebXR flags in chrome://flags if needed
