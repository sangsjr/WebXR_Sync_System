const events = [
	'connectionstatechange',
	'connected',
	'disconnected',
	'failed',
	'close',
	'track'
]

class BushiSync {

	#network
	#internalListeners = new Listener()
	#listener = new Listener()

	#serializer
	#unserializer

	constructor(args = {}) {
		const {
			host, // host='ip:port/room'
			// port
			// room
			serializer = JSON.stringify,
			unserializer = JSON.parse,
		} = args

		this.#serializer = serializer
		this.#unserializer = unserializer

		console.log('init network...');

		const internalOn = this.#internalListeners.on.bind(this.#internalListeners)
		for (const key of events) {
			this.on[key] =  (...args) => internalOn(key, ...args)
		}

		this.#network = new WebRTCNetwork(host);
		// another idea is to use QRCode to communicate between phones
		// with each front camera pointing at the other screen
		// so there is no need for a signalling server
		// there is also bluetooth, or NFC (https://developer.mozilla.org/en-US/docs/Web/API/Web_NFC_API)

		this.#network.onmessage = (event, userID) => {
			const data = this.#unserializer(event.data);
			this.#listener.trigger(data.evt, data.data, userID)
		};

		this.#network.onconnectionstatechange = (state, userID) => {
			this.#internalListeners.trigger('connectionstatechange', state, userID)
			this.#internalListeners.trigger(state, userID)
		};

		// this.#network.onready = (userID) => {
		// 	console.log("onready " + userID);
		// 	this.send({ "evt": "test" }, userID);
		// };

		this.#network.ontrack = (event, userID) => {
			this.#internalListeners.trigger('track', event, userID)
		}

		// close network when the page is closed
		window.addEventListener("beforeunload", () => this.#network.close())
	}

	send(key, data, toid) {
		this.#network.send(this.#serializer({ evt: key, data }), toid)
	}

	on(evt, callback) {
		this.#listener.on(evt, callback)
	}

	track(stream) {
		this.#network.track(stream)
	}

	// async id() {
	// 	return this.#network.id()
	// }

	open(name, opts) {
		return this.#network.openChannel(name, opts)
	}

	close() {
		if (this.#network) {
			this.#network.close()
		}
	}
}