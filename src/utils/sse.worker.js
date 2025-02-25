import EventDispatcher from './event-dispatch'

/**
 * SSE Worker 类
 * 用于在 Worker 线程中处理 SSE 连接
 */
class SSEWorker extends EventDispatcher {
  constructor() {
    super()
    this.eventSource = null
    this.retryInterval = 5000
  }

  /**
   * 初始化 EventSource 连接
   * @param {Object} options 配置选项
   * @param {string} options.sseUrl SSE 服务端地址，必填
   * @param {string[]} [options.events] 要监听的自定义事件列表，可选
   * @param {number} [options.retryInterval=5000] 重试间隔时间（毫秒），默认 5000ms
   * @param {boolean} [options.withCredentials=false] 是否携带认证信息，默认 false
   * @param {boolean} [options.autoReconnect=false] 是否在连接断开时自动重连，默认 false
   */
  initEventSource(options) {
    if (!options.sseUrl) {
      self.postMessage({
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

    try {
      // 更新重试配置
      this.retryInterval = options.retryInterval ?? 5000

      const url = new URL(options.sseUrl, self.location.origin)

      // 创建 EventSource 实例
      const eventSourceInit = {
        withCredentials: options.withCredentials ?? false
      }

      this.eventSource = new EventSource(url.toString(), eventSourceInit)
      this.setupEventListeners(options)
    } catch (error) {
      this.handleError({
        error,
        type: 'initialization'
      })
    }
  }

  /**
   * 设置事件监听器
   * @private
   * @param {Object} options 配置选项
   */
  setupEventListeners(options) {
    // 处理连接状态
    this.eventSource.onopen = () => {
      self.postMessage({
        type: 'sse:connected',
        data: { timestamp: Date.now() }
      })
    }

    this.eventSource.onerror = (error) => {
      this.handleError({
        error,
        type: 'connection'
      })

      // 根据配置决定是否自动重连
      if (options.autoReconnect === true) {
        setTimeout(() => {
          this.reconnect(options)
        }, this.retryInterval)
      }
    }

    // 处理默认消息
    this.eventSource.onmessage = (event) => {
      this.handleMessage('sse:message', event)
    }

    // 处理自定义事件
    if (options.events && Array.isArray(options.events)) {
      options.events.forEach((eventName) => {
        this.eventSource.addEventListener(eventName, (event) => {
          this.handleMessage(eventName, event)
        })
      })
    }
  }

  /**
   * 处理消息
   * @private
   * @param {string} type 消息类型
   * @param {MessageEvent} event 消息事件
   */
  handleMessage(type, event) {
    try {
      const data = {
        data: event.data,
        origin: event.origin,
        timestamp: Date.now()
      }
      self.postMessage({ type, data })
    } catch (error) {
      this.handleError({
        error,
        type: 'parsing'
      })
    }
  }

  /**
   * 处理错误
   * @private
   * @param {Object} errorInfo 错误信息
   */
  handleError({ error, type }) {
    const errorData = {
      message: error.message || 'Unknown error',
      type,
      timestamp: Date.now()
    }
    self.postMessage({
      type: 'sse:error',
      data: { error: errorData }
    })
  }

  /**
   * 重新连接
   * @private
   * @param {Object} options 配置选项
   */
  reconnect(options) {
    this.close()
    this.initEventSource(options)
  }

  /**
   * 关闭连接
   */
  close() {
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
        self.postMessage({
          type: 'sse:closed',
          data: { timestamp: Date.now() }
        })
      }
    }
  }
}

const worker = new SSEWorker()

self.addEventListener('message', (event) => {
  const { type, data } = event.data
  switch (type) {
  case 'init':
    worker.initEventSource(data)
    break
  case 'close':
    worker.close()
    break
  default:
    break
  }
})
