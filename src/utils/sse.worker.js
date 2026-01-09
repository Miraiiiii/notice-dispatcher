import EventDispatcher from './event-dispatch'

class SSEWorker extends EventDispatcher {
  constructor() {
    super()
    this.eventSource = null
    this.options = null
    this.retryInterval = 5000
    this.connected = false
    this.ports = new Set()
    this.eventNames = new Set()
    this.workerId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  }

  normalizeOptions(options = {}) {
    return {
      sseUrl: options.sseUrl,
      retryInterval: typeof options.retryInterval === 'number'
        ? options.retryInterval
        : 5000,
      withCredentials: options.withCredentials === true,
      autoReconnect: options.autoReconnect === true
    }
  }

  addPort(port) {
    if (this.ports.has(port)) {
      return
    }
    this.ports.add(port)
    port.onmessage = (event) => {
      const payload = event.data || {}
      const { type, data } = payload
      switch (type) {
      case 'init':
        this.handleInit(port, data)
        break
      case 'close':
        this.handlePortClose(port)
        break
      case 'reconnect':
        this.reconnect()
        break
      default:
        break
      }
    }
    port.start()
  }

  handleInit(port, options = {}) {
    const normalized = this.normalizeOptions(options)
    if (!normalized.sseUrl) {
      this.postToPort(port, {
        type: 'sse:error',
        data: {
          error: {
            message: 'SSE URL is required',
            type: 'configuration'
          },
          timestamp: Date.now()
        }
      })
      return
    }

    if (!this.options) {
      this.options = normalized
      this.retryInterval = normalized.retryInterval
    } else if (!this.isCompatible(normalized)) {
      this.postToPort(port, {
        type: 'sse:error',
        data: {
          error: {
            message: 'SharedWorker already initialized with different options',
            type: 'configuration'
          },
          timestamp: Date.now()
        }
      })
      this.detachPort(port)
      return
    } else {
      this.mergeOptions(normalized)
    }

    this.addEvents(options.events)

    if (!this.eventSource) {
      this.initEventSource(this.options)
    } else {
      this.sendStatusToPort(port)
    }
    this.sendWorkerInfo(port)
  }

  isCompatible(normalized) {
    return this.options
      && normalized.sseUrl === this.options.sseUrl
      && normalized.withCredentials === this.options.withCredentials
  }

  mergeOptions(normalized) {
    if (normalized.autoReconnect) {
      this.options.autoReconnect = true
    }
    if (typeof normalized.retryInterval === 'number' && normalized.retryInterval > 0) {
      this.retryInterval = Math.min(this.retryInterval, normalized.retryInterval)
      this.options.retryInterval = this.retryInterval
    }
  }

  addEvents(events) {
    if (!Array.isArray(events)) {
      return
    }
    events.forEach((eventName) => {
      if (this.eventNames.has(eventName)) {
        return
      }
      this.eventNames.add(eventName)
      if (this.eventSource) {
        this.eventSource.addEventListener(eventName, (event) => {
          this.handleMessage(eventName, event)
        })
      }
    })
  }

  attachStoredEvents() {
    if (!this.eventSource) {
      return
    }
    this.eventNames.forEach((eventName) => {
      this.eventSource.addEventListener(eventName, (event) => {
        this.handleMessage(eventName, event)
      })
    })
  }

  initEventSource(options) {
    try {
      const url = new URL(options.sseUrl, self.location.origin)
      const eventSourceInit = {
        withCredentials: options.withCredentials ?? false
      }
      this.eventSource = new EventSource(url.toString(), eventSourceInit)
      this.setupEventListeners()
      this.attachStoredEvents()
    } catch (error) {
      this.handleError({
        error,
        type: 'initialization'
      })
    }
  }

  setupEventListeners() {
    this.eventSource.onopen = () => {
      this.connected = true
      this.broadcast({
        type: 'sse:connected',
        data: { timestamp: Date.now() }
      })
    }

    this.eventSource.onerror = (error) => {
      this.connected = false
      this.handleError({
        error,
        type: 'connection'
      })

      if (this.options && this.options.autoReconnect === true) {
        setTimeout(() => {
          this.reconnect()
        }, this.retryInterval)
      }
    }

    this.eventSource.onmessage = (event) => {
      this.handleMessage('sse:message', event)
    }
  }

  handleMessage(type, event) {
    try {
      const data = {
        data: event.data,
        origin: event.origin,
        timestamp: Date.now()
      }
      this.broadcast({ type, data })
    } catch (error) {
      this.handleError({
        error,
        type: 'parsing'
      })
    }
  }

  handleError({ error, type }) {
    const errorData = {
      message: error.message || 'Unknown error',
      type,
      timestamp: Date.now()
    }
    this.broadcast({
      type: 'sse:error',
      data: { error: errorData }
    })
  }

  reconnect() {
    if (!this.options) {
      return
    }
    this.closeEventSource()
    this.initEventSource(this.options)
  }

  closeEventSource() {
    if (this.eventSource) {
      try {
        this.eventSource.close()
      } catch (error) {
        this.handleError({
          error,
          type: 'closing'
        })
      } finally {
        this.eventSource = null
        this.connected = false
        this.broadcast({
          type: 'sse:closed',
          data: { timestamp: Date.now() }
        })
      }
    }
  }

  handlePortClose(port) {
    this.detachPort(port)
    if (this.ports.size === 0) {
      this.closeEventSource()
      this.options = null
      this.retryInterval = 5000
      this.eventNames.clear()
    }
  }

  detachPort(port) {
    if (this.ports.has(port)) {
      this.ports.delete(port)
    }
    try {
      port.close()
    } catch (error) {
      // Ignore port close errors
    }
  }

  postToPort(port, payload) {
    try {
      port.postMessage(payload)
    } catch (error) {
      this.detachPort(port)
    }
  }

  broadcast(payload) {
    this.ports.forEach((port) => {
      this.postToPort(port, payload)
    })
  }

  sendStatusToPort(port) {
    if (this.connected) {
      this.postToPort(port, {
        type: 'sse:connected',
        data: { timestamp: Date.now() }
      })
    } else {
      this.postToPort(port, {
        type: 'sse:closed',
        data: { timestamp: Date.now() }
      })
    }
  }

  sendWorkerInfo(port) {
    this.postToPort(port, {
      type: 'worker:info',
      data: {
        workerId: this.workerId,
        ports: this.ports.size,
        timestamp: Date.now()
      }
    })
  }
}

const worker = new SSEWorker()

self.onconnect = (event) => {
  const [port] = event.ports
  if (port) {
    worker.addPort(port)
  }
}
