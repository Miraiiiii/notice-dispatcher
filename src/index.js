// eslint-disable-next-line import/no-unresolved
import Worker from 'web-worker:./utils/sse.worker'
import EventDispatcher from './utils/event-dispatch'

/**
 * NoticeDispatcher 类
 * 用于处理 SSE 通知的调度器，运行在 Web Worker 中
 */
class NoticeDispatcher extends EventDispatcher {
  /**
   * 创建一个新的 NoticeDispatcher 实例
   * @param {Object} options 配置选项
   * @param {string} options.sseUrl SSE 服务端地址，必填
   * @param {string[]} [options.events] 要监听的自定义事件列表，可选
   * @param {number} [options.retryInterval=5000] 重试间隔时间（毫秒），默认 5000ms
   * @param {Object} [options.headers] 请求头配置，可选
   * @param {boolean} [options.withCredentials=false] 是否携带认证信息，默认 false
   * @param {boolean} [options.autoReconnect=false] 是否在连接错误时自动重连，默认 false
   */
  constructor(options = {}) {
    super()
    this.options = {
      retryInterval: 5000,
      withCredentials: false,
      autoReconnect: false,
      ...options
    }
    this.worker = null
    this.connected = false
    this.initWorker()
  }

  /**
   * 初始化 Worker
   * @private
   */
  initWorker() {
    try {
      // 创建 Worker
      this.worker = new Worker()

      // 监听 Worker 消息
      this.worker.onmessage = (event) => {
        const { type, data } = event.data
        if (type === 'sse:connected') {
          this.connected = true
        } else if (type === 'sse:closed') {
          this.connected = false
        }
        this.dispatch(type, data)
      }

      // 监听 Worker 错误
      this.worker.onerror = (error) => {
        this.connected = false
        this.dispatch('worker:error', {
          error: {
            message: error.message,
            type: 'worker'
          },
          timestamp: Date.now()
        })
      }

      // 初始化 SSE
      this.worker.postMessage({
        type: 'init',
        data: this.options
      })
    } catch (error) {
      this.dispatch('worker:error', {
        error: {
          message: error.message,
          type: 'initialization'
        },
        timestamp: Date.now()
      })
    }
  }

  /**
   * 关闭连接
   */
  close() {
    if (this.worker) {
      try {
        this.worker.postMessage({ type: 'close' })
        this.worker.terminate()
      } catch (error) {
        this.dispatch('worker:error', {
          error: {
            message: error.message,
            type: 'termination'
          },
          timestamp: Date.now()
        })
      } finally {
        this.worker = null
        this.connected = false
      }
    }
  }

  /**
   * 检查连接状态
   * @returns {boolean} 是否已连接
   */
  isConnected() {
    return this.connected
  }

  /**
   * 重新连接
   */
  reconnect() {
    this.close()
    this.initWorker()
  }
}

export default NoticeDispatcher
