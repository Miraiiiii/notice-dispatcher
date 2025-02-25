// eslint-disable-next-line import/no-unresolved
import Worker from 'web-worker:./utils/sse.worker'
import EventDispatcher from './utils/event-dispatch'

// 存储实例的静态映射
const instanceMap = new Map()

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
        // 从实例映射中移除
        if (this.options.sseUrl) {
          instanceMap.delete(this.options.sseUrl)
        }
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

/**
 * 创建或获取 NoticeDispatcher 实例
 * @param {Object} options 配置选项
 * @returns {NoticeDispatcher} NoticeDispatcher 实例
 */

function createNoticeDispatcher(options = {}) {
  if (!options.sseUrl) {
    throw new Error('SSE URL is required')
  }

  // 检查是否已存在相同URL的实例
  if (instanceMap.has(options.sseUrl)) {
    return instanceMap.get(options.sseUrl)
  }

  // 创建新实例并存储
  const instance = new NoticeDispatcher(options)
  instanceMap.set(options.sseUrl, instance)
  return instance
}

export { NoticeDispatcher, createNoticeDispatcher }
export default { NoticeDispatcher, createNoticeDispatcher }
