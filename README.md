# WebXR Sync System (Web Version)

### Quick Start

##### 1. Configure IP Address

Edit `index.html` and replace the sync/server IP address with your local network IP.

##### 2. Start the Server

```
node Server/Server.js
```

The server will start on port 3001, open `https://your-ip:3001` in your browser to verify it's running.

##### 3. Start the Client

```
npx vite dev
```

Vite will provide a local development URL (typically `https://your-ip:5173`).

##### 4. Connect Devices

* Ensure both the server and client are running

* Open the provided URL in both the mobile and the Meta Quest browsers

* Join the same room on both devices with `https://your-ip:5173?room=roomid`

* Enter AR mode to begin the system

### Common Issues

1. **Connection Problems**
   
   - Ensure all devices are on the same network and have the same IP Address
   
   - Verify the IP address in the configuration matches your local IP
   
   - Check that no firewall is blocking the connection

2. **WebXR Not Working**
   
   * Ensure the Mobile browsers with WebXR support, use Chrome browser for best compatibility
   
   * Ensure your device supports WebXR, use Android for best compatibility
   
   * Enable WebXR flags in chrome://flags if needed

3. **Server Not Starting**
   
   * Install required dependencies with `npm install` if you haven't already
   
   * Check that no other application is using port 3001