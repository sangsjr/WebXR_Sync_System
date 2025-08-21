class Listener {
	#listeners = {}

	on(key, callback) {
		// console.log(`Listener.on(${key}, ${callback})`);
		if (key in this.#listeners) {
			this.#listeners[key].push(callback);
		} else {
			this.#listeners[key] = [callback];
		}
	}

	// off

	trigger(key, ...args) {
		// console.log(`Listener.trigger(${key}, ${args})`);
		if (key in this.#listeners) {
			for (const listener of this.#listeners[key]) {
				listener(...args)
			}
		}
	}

	reset() {
		this.#listeners = {}
	}
}