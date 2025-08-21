/*
  Star configuration *-*, but there is only one connection between each peers because its bidirectionnal
  For each new peers that connect to the network, all existing peers connect to it
  This code works with only one only one data channel per peers
*/
class WebRTCNetwork {
	#id = null
	#sock = null
	#connections = {} // list of all RTCPeerConnection
	#channels = { // list of data [channel][userID] for a RTCPeerConnection
		default: {
			config: {
				onmessage: (...args) => this.onmessage(...args),
			}
		}
	}
	#listener = new Listener()
	#hosting = false

	constructor(host) {
		this.#init(host)
	}

	// default channel callback
	onmessage(data, userID) {
		console.log(`Received ${data} from ${userID}`)
		console.log('use sync.on... to receive it')
	}

	onconnectionstatechange(state, userID) { } // default empty callback

	#onconnectionstatechange(state, userID) {
		this.onconnectionstatechange(state, userID);
	}

	#init(host) {
		// Use native WebSocket for browser extension compatibility
		// Check if host is defined
		if (!host) {
			console.error('WebRTCNetwork initialization failed: host is undefined');
			return;
		}
		// Extract server address without room path
		const serverAddr = host.replace('https://', '').replace('http://', '').split('/')[0];
		// Use wss for https, ws for http
		const protocol = host.startsWith('https://') ? 'wss://' : 'ws://';
		const wsUrl = `${protocol}${serverAddr}/socket.io/?EIO=4&transport=websocket&t=${Date.now()}`;
		console.log('WebRTC connecting to:', wsUrl);
		
		try {
			this.#sock = new WebSocket(wsUrl);
			
			this.#sock.onopen = () => {
				console.log('WebRTC WebSocket connected');
				// Send Socket.IO handshake for webrtc namespace
				this.#sock.send('40/webrtc,');
				// Send additional connection message
				setTimeout(() => {
					if (this.#sock && this.#sock.readyState === WebSocket.OPEN) {
						this.#sock.send('42/webrtc,["connect",{}]');
					}
				}, 100);
			};
			
			this.#sock.onerror = (error) => {
				console.error('WebRTC WebSocket error:', error);
			};
			
			this.#sock.onmessage = (event) => {
				const data = event.data;
				console.log('WebRTC received:', data);
				
				// Parse Socket.IO message format
				if (data.startsWith('42/webrtc,')) {
					try {
						const jsonData = JSON.parse(data.substring(10));
						const [eventName, eventData] = jsonData;
						
						if (eventName === 'signal') {
							this.signalReceive(eventData);
						} else if (eventName === 'newConnection') {
							this.signalReceive(eventData);
						}
					} catch (e) {
						console.error('Error parsing WebRTC message:', e);
					}
				}
			};
			
			this.#sock.onclose = (e) => {
				console.log('WebRTC WebSocket disconnected', e);
			};
		} catch (error) {
			console.error('WebRTC WebSocket creation error:', error);
		}

	}

	// async id() {
	// 	if (this.#id) {
	// 		return this.#id;
	// 	}
	// 	return new Promise((resolve, reject) => {
	// 		this.onid = resolve
	// 	})
	// }

	#initConnection(userID, hosting) {
		const self = this;

		const co = new RTCPeerConnection({
			/*'iceServers': [
				{ "urls": "stun:stun.l.google.com:19302" },
				{ "urls": "stun:stun1.l.google.com:19302" },
				{ "urls": "stun:stun2.l.google.com:19302" },
				{ "urls": "stun:stun3.l.google.com:19302" },
				// {
				//   "urls":"turn:[ADDRESS]:[PORT][?transport=udp]",
				//   "username":"[USERNAME]",
				//   "credential":"[CREDENTIAL]"
				// }
			]*/
		});
		self.#connections[userID] = co;

		for (const stream of self.#streams) {
			stream.getTracks().forEach(track => co.addTrack(track, stream))
		}

		co.addEventListener('connectionstatechange', function(event) {
			self.#onconnectionstatechange(co.connectionState, userID);
			switch (co.connectionState) {
				case "connected": // The connection has become fully connected
					console.log('connected to peer ' + userID);
					break;
				case "disconnected":
					console.log('disconnected of peer' + userID);
					break;
				case "failed": // One or more transports has terminated unexpectedly or in an error
					console.log('failed to contact peer ' + userID);
					break;
				case "closed": // The connection has been closed
					console.log('connection closed with peer ' + userID);
					self.#connections[userID].close()
					delete self.#connections[userID]
					break;
			}
		});

		co.ontrack = event => self.ontrack(event, userID)

		co.oniceconnectionstatechange += console.log;

		function negociate() {
			co.createOffer({ offerToReceiveVideo: true, offerToReceiveAudio: true })
			.then(offer => co.setLocalDescription(offer))
			.then(() => self.#signalSend({ to: userID, hostDescription: co.localDescription }))
				.catch(console.error)
		}

		co.addEventListener("negotiationneeded", (event) => negociate())

		co.onicecandidate = event => {
			if (event.candidate) {
				self.#signalSend({ to: userID, candidate: event.candidate }); // Send the candidate to the remote peer
			} else {
				console.log('All ICE candidates have been sent.');
			}
		}

		if (hosting) { // Create data channels and setup event listeners
			for (const [label, data] of Object.entries(self.#channels)) {
				const { config } = data
				const { opts } = config
				console.log(`host create channel ${label} with options ${opts} for user ${userID}`)
				const channel = co.createDataChannel(label, opts)
				self.#setupChannel(channel, userID)
			}

			negociate()
		} else {
			co.ondatachannel = event => {
				console.log(`channel ${event.channel.label} opened for user ${userID}`)
				const channel = event.channel
				self.#setupChannel(channel, userID)
			}
		}
	}

	#setupChannel(channel, userID) {
		const self = this
		channel.onopen = self.#channels[channel.label].config.onopen
		channel.onmessage = (evt) => {
			// evt.userID = userID
			self.#channels[channel.label].config.onmessage(evt, userID)
		}
		channel.onclose = self.#channels[channel.label].config.onclose
		self.#channels[channel.label][userID] = channel
	}

	signalReceive(event) { // receive event from signalling server
		const self = this;

		// when a new user is connected to the signalling server
		if (event.newConnection) { // event.newConnection == userID
			self.#hosting = true;
			self.#initConnection(event.newConnection, true);
			return;
		}

		// as a remote, there is a need to create the connection before receiving messages
		if (!self.#connections[event.from]) {
			self.#initConnection(event.from, false);
		}

		if (event.candidate) { // candidate exchange
			self.#connections[event.from].addIceCandidate(event.candidate).catch(console.error)
		} else if (event.remoteDescription) { // host get the remote description
			self.#connections[event.from].setRemoteDescription(event.remoteDescription).catch(console.error)
		} else if (event.hostDescription) { // remote get the host description
			const co = self.#connections[event.from];
			co.setRemoteDescription(event.hostDescription)
			.then(() => co.createAnswer())
			.then(answer => co.setLocalDescription(answer))
			.then(() => self.#signalSend({ to: event.from, remoteDescription: co.localDescription }))
			.catch(console.error)
		}
	}

	#signalSend(message) {
		if (this.#sock && this.#sock.readyState === WebSocket.OPEN) {
			// Send message in Socket.IO format: 42/webrtc,["signal",data]
			const socketIOMessage = `42/webrtc,${JSON.stringify(['signal', message])}`;
			this.#sock.send(socketIOMessage);
		}
	}

	openChannel(name, opts) {
		const self = this

		if (!self.#channels[name]) {
			self.#channels[name] = {
				config: {
					opts,
					listeners: new Listener(),
					send: (message) => {
						for (const userID in self.#channels[name]) {
							if (userID === 'config') continue;
							// console.log(`send ${message} on channel ${name} to ${userID}`);
							self.#channels[name][userID].send(message)
						}
					},
					on: (listener) => {
						self.#channels[name].config.listeners.on('message', listener)
					},
					onopen: event => {
						console.log(`[default-channel-onopen] channel ${name} opened`)
					},
					onmessage: function(event, userID) {
						self.#channels[name].config.listeners.trigger('message', event.data, userID)
						// console.log(`channel ${name} onmessage`, event.data)
					},
					onclose: event => {
						console.log(`[default-channel-onclose] channel ${name} closed`)
					}
				}
			}
		}

		return self.#channels[name].config
	}

	send(message, toid) {
		if (toid) {
			const channel = this.#channels['default'][toid];
			if (channel && channel.readyState === "open")
				channel.send(message);
			return;
		}
		for (const userID in this.#channels['default']) {
			this.send(message, userID)
		}
	}

	#streams = []
	track(stream) {
		console.log('track', stream);
		this.#streams.push(stream)

		for (const userID in this.#connections) {
			stream.getTracks().forEach(track => {
				this.#connections[userID].addTrack(track, stream)
			})
			// this.#connections[userID].restartIce()
		}
	}

	close() {
		// close channels
		for (const label in this.#channels) {
			for (const userID in this.#channels[label]) {
				if (userID === 'config') continue;
				this.#channels[label][userID].close()
			}
		}

		// close connections
		for (const userID in this.#connections) {
			this.#connections[userID].close()
		}
		if (this.#sock && this.#sock.readyState === WebSocket.OPEN) {
			this.#sock.close();
		}
	}
}