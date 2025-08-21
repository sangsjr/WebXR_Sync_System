document.addEventListener('DOMContentLoaded', function() {
    const roomInput = document.getElementById('room-id');
    const generateBtn = document.getElementById('generate-room');
    const startBtn = document.getElementById('start-btn');
    const stopBtn = document.getElementById('stop-btn');
    const statusDiv = document.getElementById('status');
    
    let isConnected = false;
    
    function generateRoomId() {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    }
    
    function updateStatus(message, type = 'normal') {
        statusDiv.textContent = message;
        statusDiv.className = 'status';
        if (type === 'connected') {
            statusDiv.classList.add('connected');
        } else if (type === 'error') {
            statusDiv.classList.add('error');
        }
    }
    
    function updateUI(connected) {
        isConnected = connected;
        startBtn.disabled = connected;
        stopBtn.disabled = !connected;
        roomInput.disabled = connected;
        generateBtn.disabled = connected;
    }
    
    generateBtn.addEventListener('click', function() {
        roomInput.value = generateRoomId();
    });
    
    startBtn.addEventListener('click', function() {
        const roomId = roomInput.value.trim();
        
        if (!roomId) {
            updateStatus('Please enter a room ID', 'error');
            return;
        }
        
        updateStatus('Starting connection...');
        
        if (typeof io === 'undefined') {
            updateStatus('Socket.IO library not loaded. Please refresh the page.', 'error');
            return;
        }
        
        chrome.runtime.sendMessage({
            action: 'start',
            roomId: roomId
        }, function(response) {
            if (chrome.runtime.lastError) {
                updateStatus('Connection failed: ' + chrome.runtime.lastError.message, 'error');
                return;
            }
            
            updateStatus('Connected to room: ' + roomId, 'connected');
            updateUI(true);
        });
    });
    
    stopBtn.addEventListener('click', function() {
        updateStatus('Stopping connection...');
        
        chrome.runtime.sendMessage({
            action: 'stop'
        }, function(response) {
            if (chrome.runtime.lastError) {
                updateStatus('Disconnect failed: ' + chrome.runtime.lastError.message, 'error');
                return;
            }
            
            updateStatus('Disconnected', 'normal');
            updateUI(false);
        });
    });
    
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        if (request.type === 'status-update') {
            updateStatus(request.message, request.statusType || 'normal');
            if (request.connected !== undefined) {
                updateUI(request.connected);
            }
        }
        sendResponse({received: true});
    });
    
    
    chrome.runtime.sendMessage({
        type: 'get-status'
    }, function(response) {
        if (chrome.runtime.lastError) {
            updateStatus('Ready to connect');
            return;
        }
        
        if (response) {
            if (response.connected) {
                updateStatus('Connected to room: ' + (response.roomId || 'Unknown'), 'connected');
                updateUI(true);
                if (response.roomId) {
                    roomInput.value = response.roomId;
                }
            } else {
                updateStatus('Ready to connect');
                updateUI(false);
            }
        }
    });
    
    roomInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !isConnected) {
            startBtn.click();
        }
    });
    
    if (!roomInput.value) {
        roomInput.value = generateRoomId();
    }
});