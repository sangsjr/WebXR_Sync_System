const express = require('express');
const http = require('http');
const Server = require('socket.io').Server;
const cors = require('cors');
const path = require('path');
const https = require("https");
const readFileSync = require("fs").readFileSync;
  
const HTTPS_PORT = process.env.HTTPS_PORT || 3001;

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));



const options = {
  key: readFileSync("key.pem"),
  cert: readFileSync("cert.pem"),
};

const httpsServer = https.createServer(options, (req, res) => {
  res.writeHead(200);
  res.end('HTTPS Server running');
});

const io = new Server({ 
  maxHttpBufferSize: 1e8,
  cors: {
      origin: "*",
  }
});

io.attach(httpsServer);

httpsServer.listen(HTTPS_PORT, () => {
  console.log(`HTTPS Server running on https://localhost:${HTTPS_PORT}`);
  console.log(`Socket.IO Main server running on https://localhost:${HTTPS_PORT}`);
  console.log(`Socket.IO WS Namespace available at https://localhost:${HTTPS_PORT}/ws`);
  console.log(`Socket.IO WebRTC Namespace available at https://localhost:${HTTPS_PORT}/webrtc`);
  console.log(`Access the application at: https://localhost:${HTTPS_PORT}`);
});

const wsNamespace = io.of('/ws');
const webrtcNamespace = io.of('/webrtc');

const rooms = {};
const transformMatrices = new Map();
const connectedClients = [];
let ID = 0;

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);
  
  let currentRoom = null;
  let deviceType = null;

  socket.on('join-room', (data) => {
    const { roomId, device } = data;
    
    if (!rooms[roomId]) {
      rooms[roomId] = {
        phoneClient: null,
        questClient: null,
        calibrated: false,
        transformMatrix: null
      };
    }
    
    deviceType = device;
    currentRoom = roomId;
    
    if (device === 'phone') {
      rooms[roomId].phoneClient = socket.id;
    } else if (device === 'quest') {
      rooms[roomId].questClient = socket.id;
    }
    
    socket.join(roomId);
    
    socket.emit('room-joined', {
      roomId,
      deviceType: device,
      otherDeviceConnected: device === 'phone' ? 
                            !!rooms[roomId].questClient : 
                            !!rooms[roomId].phoneClient
    });
    
    socket.to(roomId).emit('device-connected', { deviceType: device });
    
    console.log(`Client ${socket.id} joined room ${roomId} as ${device}`);
  });

  socket.on('phone-position', (data) => {
    if (!currentRoom) return;
    
    if (rooms[currentRoom] && rooms[currentRoom].questClient) {
      io.to(rooms[currentRoom].questClient).emit('phone-position', data);
    }
  });

  socket.on('request-calibration', () => {
    if (!currentRoom || deviceType !== 'quest') return;
    
    if (rooms[currentRoom] && rooms[currentRoom].phoneClient) {
      io.to(rooms[currentRoom].phoneClient).emit('send-calibration-data');
      console.log(`Calibration requested in room ${currentRoom}`);
    }
  });

  socket.on('calibration-data', (data) => {
    if (!currentRoom || deviceType !== 'phone') return;
    
    if (rooms[currentRoom] && rooms[currentRoom].questClient) {
      io.to(rooms[currentRoom].questClient).emit('calibration-data', data);
      console.log(`Calibration data sent in room ${currentRoom}`);
    }
  });

  socket.on('store-transform-matrix', (data) => {
    if (!currentRoom || deviceType !== 'quest') return;
    
    if (rooms[currentRoom]) {
      rooms[currentRoom].transformMatrix = data.matrix;
      rooms[currentRoom].calibrated = true;
      console.log(`Transform matrix stored for room ${currentRoom}`);
      
      io.to(currentRoom).emit('calibration-complete', { success: true });
    }
  });

  socket.on('get-transform-matrix', () => {
    if (!currentRoom) return;
    
    if (rooms[currentRoom] && rooms[currentRoom].calibrated) {
      socket.emit('transform-matrix', {
        matrix: rooms[currentRoom].transformMatrix
      });
    }
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
    
    if (currentRoom && rooms[currentRoom]) {
      if (deviceType === 'phone' && rooms[currentRoom].phoneClient === socket.id) {
        rooms[currentRoom].phoneClient = null;
        
        if (rooms[currentRoom].questClient) {
          io.to(rooms[currentRoom].questClient).emit('device-disconnected', { deviceType: 'phone' });
        }
      } else if (deviceType === 'quest' && rooms[currentRoom].questClient === socket.id) {
        rooms[currentRoom].questClient = null;
        
        if (rooms[currentRoom].phoneClient) {
          io.to(rooms[currentRoom].phoneClient).emit('device-disconnected', { deviceType: 'quest' });
        }
      }
      
      if (!rooms[currentRoom].phoneClient && !rooms[currentRoom].questClient) {
        delete rooms[currentRoom];
        console.log(`Room ${currentRoom} cleaned up`);
      }
    }
  });
});

// Socket.IO
wsNamespace.on('connection', (socket) => {
  const userID = ID++;
  connectedClients[userID] = socket;
  console.log('WS Namespace connected: ' + userID + ' in ' + Object.getOwnPropertyNames(connectedClients));
  
  socket.on('message', (message) => {
    const msg = typeof message === 'string' ? JSON.parse(message) : message;
    msg.userID = userID;
    
    connectedClients.forEach((client, id) => {
      if (id !== userID && client && client.connected) {
        client.emit('message', msg);
      }
    });
  });
  
  socket.on('disconnect', () => {
    delete connectedClients[userID];
    console.log('WS Namespace deleted: ' + userID);
  });
  
  socket.on('error', (error) => {
    console.error('Socket.IO WS Namespace error:', error);
    delete connectedClients[userID];
  });
});

// Socket.IO WebRTC
webrtcNamespace.on('connection', (socket) => {
  const userID = ID++;
  connectedClients[userID] = socket;
  console.log('WebRTC Namespace connected: ' + userID + ' in ' + Object.getOwnPropertyNames(connectedClients));
  
  connectedClients.forEach((client, id) => {
    if (id !== userID && client && client.connected) {
      client.emit('newConnection', { userID: userID });
    }
  });
  
  socket.on('signal', (message) => {
    const msg = typeof message === 'string' ? JSON.parse(message) : message;
    msg.from = userID;
    
    if (msg.to && connectedClients[msg.to] && connectedClients[msg.to].connected) {
      connectedClients[msg.to].emit('signal', msg);
    }
  });
  
  socket.on('disconnect', () => {
    delete connectedClients[userID];
    console.log('WebRTC Namespace deleted: ' + userID);
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      express: 'running',
      socketio: 'running',
      https: 'running'
    },
    stats: {
      socketioRooms: Object.keys(rooms).length,
      mainSocketClients: io.engine.clientsCount,
      wsNamespaceClients: wsNamespace.sockets.size,
      webrtcNamespaceClients: webrtcNamespace.sockets.size,
      connectedClients: Object.keys(connectedClients).filter(id => connectedClients[id] && connectedClients[id].connected).length
    }
  });
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  
  io.close(() => {
    console.log('Socket.IO server closed');
    
    httpsServer.close(() => {
      console.log('HTTPS server closed');
      process.exit(0);
    });
  });
});

process.on('SIGINT', () => {
  console.log('\nSIGINT received, shutting down gracefully');
  
  io.close(() => {
    console.log('Socket.IO server closed');
    
    httpsServer.close(() => {
      console.log('HTTPS server closed');
      process.exit(0);
    });
  });
});