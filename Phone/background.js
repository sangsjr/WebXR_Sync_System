const SERVER_URL = 'https://192.168.2.47:3001';

let socket = null;
let sync = null;
let roomId = null;

let serverConnected = false;
let questConnected = false;
let bushiConnected = false;
let lastPoseTime = 0;

function start(room) {
  roomId = room;

  // Socket.IO → Server.js
  try {
    if (typeof io === 'undefined') {
      console.error('[Phone] Socket.IO not loaded');
      return false;
    }
    console.log('[Phone] Connecting to server:', SERVER_URL);
    socket = io(SERVER_URL, { 
      transports: ['websocket'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000
    });
  } catch (error) {
    console.error('[Phone] Error initializing Socket.IO:', error);
    return false;
  }

  socket.on('connect', () => {
    console.log('[Phone] Connected to server');
    serverConnected = true;
    socket.emit('phone-connect', { room: roomId });
  });

  socket.on('disconnect', () => {
    console.log('[Phone] Disconnected from server');
    serverConnected = false;
    questConnected = false;
  });

  socket.on('quest-start', () => {
    console.log('[Phone] Quest joined room');
    questConnected = true;
  });

  socket.on('quest-disconnect', () => {
    console.log('[Phone] Quest left room');
    questConnected = false;
  });

  socket.on('request-calibration', () => {
    console.log('[Phone] Calibration requested by Quest');
    sendToActiveTab({ type: 'request-calibration' });
  });

  // BushiSync (WebRTC DataChannel)
  sync = new BushiSync({ host: SERVER_URL, room: roomId, device: 'phone' });

  sync.on('open', () => {
    console.log('[Phone] DataChannel open');
    bushiConnected = true;
  });

  sync.on('close', () => {
    console.log('[Phone] DataChannel closed');
    bushiConnected = false;
  });

  sync.on('message', (type, data) => {
    console.log('[Phone] DataChannel message:', type, data);
    if (type === 'calibration-ack') {
      sendToActiveTab({ type: 'calibration-ack', data });
    }
  });
}

function stop() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  if (sync) {
    sync.close();
    sync = null;
  }
  roomId = null;
  serverConnected = false;
  questConnected = false;
  bushiConnected = false;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'pose-data' && sync) {
    // pose-data → DataChannel
    sync.send('phone-position', msg.data);
    lastPoseTime = Date.now();
  }

  if (msg.type === 'calibration-data' && socket) {
    // calibration-data → Server
    socket.emit('calibration-data', { room: roomId, ...msg.data });
  }

  if (msg.action === 'start') {
    start(msg.room || msg.roomId);
  }

  if (msg.action === 'stop') {
    stop();
  }

  if (msg.action === 'getStatus' || msg.type === 'get-status') {
    sendResponse({
      connected: serverConnected,
      roomId: roomId,
      serverConnected,
      questConnected,
      bushiConnected,
      poseStream: (Date.now() - lastPoseTime) < 2000
    });
    return true;
  }
});

function sendToActiveTab(payload) {
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    if (tabs[0]) chrome.tabs.sendMessage(tabs[0].id, payload);
  });
}