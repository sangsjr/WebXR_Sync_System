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

httpsServer.listen(HTTPS_PORT, '0.0.0.0', () => {
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

// Socket.io
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);
  
  let currentRoom = null;
  let deviceType = null;

  socket.on('quest-start', (data) => {
    const { roomId } = data;
    
    if (!rooms[roomId]) {
      rooms[roomId] = {
        phoneClient: null,
        questClient: null,
        questConnected: false,
        phoneConnected: false,
        calibrated: false,
        transformMatrix: null
      };
    }
    
    deviceType = 'quest';
    currentRoom = roomId;
    rooms[roomId].questClient = socket.id;
    rooms[roomId].questConnected = true;
    
    socket.join(roomId);
    
    socket.emit('quest-connected', {
      roomId,
      phoneConnected: rooms[roomId].phoneConnected
    });
    
    if (rooms[roomId].phoneConnected && rooms[roomId].phoneClient) {
      io.to(rooms[roomId].phoneClient).emit('quest-connected', { roomId });
    }
    
    console.log(`Quest ${socket.id} started in room ${roomId}`);
  });

  socket.on('phone-connect', (data) => {
    const { roomId } = data;
    
    if (!rooms[roomId]) {
      rooms[roomId] = {
        phoneClient: null,
        questClient: null,
        questConnected: false,
        phoneConnected: false,
        calibrated: false,
        transformMatrix: null
      };
    }
    
    deviceType = 'phone';
    currentRoom = roomId;
    rooms[roomId].phoneClient = socket.id;
    rooms[roomId].phoneConnected = true;
    
    socket.join(roomId);
    
    socket.emit('phone-connected', {
      roomId,
      questConnected: rooms[roomId].questConnected
    });
    
    if (rooms[roomId].questConnected && rooms[roomId].questClient) {
      io.to(rooms[roomId].questClient).emit('phone-connected', { roomId });
    }
    
    console.log(`Phone plugin ${socket.id} connected to room ${roomId}`);
  });

  socket.on('join-room', (data) => {
    const { roomId, device } = data;
    
    if (device === 'quest') {
      socket.emit('quest-start', { roomId });
    } else if (device === 'phone') {
      socket.emit('phone-connect', { roomId });
    }
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
        rooms[currentRoom].phoneConnected = false;
        
        if (rooms[currentRoom].questConnected && rooms[currentRoom].questClient) {
          io.to(rooms[currentRoom].questClient).emit('phone-disconnected', { roomId: currentRoom });
        }
        
        console.log(`Phone plugin disconnected from room ${currentRoom}`);
      } else if (deviceType === 'quest' && rooms[currentRoom].questClient === socket.id) {
        rooms[currentRoom].questClient = null;
        rooms[currentRoom].questConnected = false;
        
        if (rooms[currentRoom].phoneConnected && rooms[currentRoom].phoneClient) {
          io.to(rooms[currentRoom].phoneClient).emit('quest-disconnected', { roomId: currentRoom });
        }
        
        console.log(`Quest disconnected from room ${currentRoom}`);
      }
      
      if (!rooms[currentRoom].phoneConnected && !rooms[currentRoom].questConnected) {
        delete rooms[currentRoom];
        console.log(`Room ${currentRoom} cleaned up`);
      }
    }
  });
});

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