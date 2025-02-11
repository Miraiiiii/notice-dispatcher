import EventDispatcher from './event-dispatch'

/**
 * SSE Worker 类
 * 用于在 Worker 线程中处理 SSE 连接
 */
class SSEWorker extends EventDispatcher {
  constructor() {
    super()
    this.eventSource = null
    this.retryCount = 0
    this.maxRetries = 3
    this.retryInterval = 5000
  }

  /**
   * 初始化 EventSource 连接
   * @param {Object} options 配置选项
   * @param {string} options.sseUrl SSE 服务端地址，必填
   * @param {string[]} [options.events] 要监听的自定义事件列表，可选
   * @param {number} [options.maxRetries=3] 连接失败时的最大重试次数，默认 3 次
   * @param {number} [options.retryInterval=5000] 重试间隔时间（毫秒），默认 5000ms
   * @param {Object} [options.headers] 请求头配置，可选，例如：{ 'Authorization': 'Bearer token' }
   * @param {boolean} [options.withCredentials=false] 是否携带认证信息，默认 false
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
      this.maxRetries = options.maxRetries ?? 3
      this.retryInterval = options.retryInterval ?? 5000

      // 创建 EventSource 实例
      const eventSourceInit = {
        withCredentials: options.withCredentials ?? false
      }

      // 如果有自定义请求头，添加到配置中
      if (options.headers) {
        eventSourceInit.headers = options.headers
      }

      this.eventSource = new EventSource(options.sseUrl, eventSourceInit)
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
      this.retryCount = 0
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

      // 尝试重连
      if (this.retryCount < this.maxRetries) {
        this.retryCount += 1
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
      const data = JSON.parse(event.data)
      self.postMessage({ type, data })
    } catch (error) {
      this.handleError({
        error,
        type: 'parsing',
        eventType: type,
        rawData: event.data
      })
    }
  }

  /**
   * 处理错误
   * @private
   * @param {Object} errorInfo 错误信息
   */
  handleError(errorInfo) {
    self.postMessage({
      type: 'sse:error',
      data: {
        error: {
          message: errorInfo.error.message,
          type: errorInfo.type,
          ...errorInfo
        },
        timestamp: Date.now()
      }
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
