const CHANNEL_PREFIX = 'tab-bus:'

export default function createTabChannel(channelName) {
  const name = `${CHANNEL_PREFIX}${channelName}`
  const subscribers = new Set()
  let bc = null
  let storageHandler = null

  const notify = (payload) => {
    subscribers.forEach((fn) => fn(payload))
  }

  if (typeof BroadcastChannel !== 'undefined') {
    bc = new BroadcastChannel(name)
    bc.onmessage = (event) => notify(event.data)
  } else if (typeof window !== 'undefined') {
    storageHandler = (event) => {
      if (event.key !== name || !event.newValue) {
        return
      }
      try {
        notify(JSON.parse(event.newValue))
      } catch (err) {
        // ignore parse errors from unrelated storage writes
      }
    }
    window.addEventListener('storage', storageHandler)
  }

  const post = (payload) => {
    if (bc) {
      bc.postMessage(payload)
      return
    }
    try {
      const value = JSON.stringify(payload)
      localStorage.setItem(name, value)
      localStorage.removeItem(name)
    } catch (err) {
      // storage might be disabled or full
    }
  }

  const subscribe = (fn) => {
    subscribers.add(fn)
    return () => subscribers.delete(fn)
  }

  const close = () => {
    if (bc) {
      bc.close()
      bc = null
    }
    if (storageHandler && typeof window !== 'undefined') {
      window.removeEventListener('storage', storageHandler)
      storageHandler = null
    }
    subscribers.clear()
  }

  return { post, subscribe, close }
}
