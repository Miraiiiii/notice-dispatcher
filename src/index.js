// eslint-disable-next-line import/no-unresolved
import SharedWorkerFactory from 'shared-worker:./utils/sse.worker'
import EventDispatcher from './utils/event-dispatch'
import createTabChannel from './utils/tabBus'
import createTabCloseSync from './utils/tabCloseSync'

// 存储实例的静态映射
const instanceMap = new Map()
let configuredWorkerUrl = null
let configuredWorkerBaseUrl = null
let hasWarnedMissingWorkerUrl = false
const autoWorkerUrl = typeof __NOTICE_DISPATCHER_AUTO_WORKER_URL__ !== 'undefined'
  ? __NOTICE_DISPATCHER_AUTO_WORKER_URL__
  : null

function resolveWorkerUrlFromBase(baseUrl) {
  if (!baseUrl || typeof URL === 'undefined') {
    return null
  }
  try {
    return new URL('sse.worker.js', baseUrl).toString()
  } catch (error) {
    return null
  }
}

function getAutoWorkerUrl() {
  if (autoWorkerUrl) {
    return autoWorkerUrl
  }
  if (typeof document === 'undefined' || typeof URL === 'undefined') {
    return null
  }
  const { currentScript } = document
  const base = currentScript && currentScript.src
    ? currentScript.src
    : document.baseURI || (typeof window !== 'undefined' ? window.location.href : '')
  return resolveWorkerUrlFromBase(base)
}

function resolveWorkerUrl(options = {}) {
  if (options.workerUrl) {
    return options.workerUrl
  }
  if (options.workerBaseUrl) {
    return resolveWorkerUrlFromBase(options.workerBaseUrl)
  }
  if (configuredWorkerUrl) {
    return configuredWorkerUrl
  }
  if (configuredWorkerBaseUrl) {
    return resolveWorkerUrlFromBase(configuredWorkerBaseUrl)
  }
  return getAutoWorkerUrl()
}

function setWorkerUrl(url) {
  configuredWorkerUrl = url || null
}

function setWorkerBaseUrl(baseUrl) {
  configuredWorkerBaseUrl = baseUrl || null
}

function hasExplicitWorkerConfig(options = {}) {
  return Boolean(
    options.workerUrl
    || options.workerBaseUrl
    || configuredWorkerUrl
    || configuredWorkerBaseUrl
  )
}

function shouldWarnMissingWorkerUrl(options = {}) {
  return !autoWorkerUrl && !hasExplicitWorkerConfig(options)
}

function warnMissingWorkerUrl() {
  if (hasWarnedMissingWorkerUrl) {
    return
  }
  hasWarnedMissingWorkerUrl = true
  if (typeof console !== 'undefined' && typeof console.warn === 'function') {
    console.warn('NoticeDispatcher: 未配置 workerUrl/workerBaseUrl，且无法自动推导 SharedWorker URL，已回退为 inline 模式（不同标签页不会共享实例）。如需共享，请将 notice-dispatcher 的 dist/worker/sse.worker.js 作为静态资源并调用 setWorkerUrl()/setWorkerBaseUrl().')
  }
}

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
   * @param {string} [options.workerUrl] SharedWorker 脚本 URL（用于多标签共享）
   * @param {string} [options.workerBaseUrl] SharedWorker 脚本基础 URL
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
    this.port = null
    this.connected = false
    this.unloadHandler = null
    this.unloadListenerBound = false
    this.ensureUnloadListener()
    this.initWorker()
  }

  /**
   * 绑定卸载时自动关闭的监听器
   * @private
   */
  ensureUnloadListener() {
    if (this.unloadListenerBound) {
      return
    }
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') {
      return
    }
    this.unloadHandler = () => {
      this.close()
    }
    window.addEventListener('beforeunload', this.unloadHandler)
    window.addEventListener('pagehide', this.unloadHandler)
    this.unloadListenerBound = true
  }

  /**
   * 初始化 Worker
   * @private
   */
  initWorker() {
    try {
      // 创建 SharedWorker
      const workerName = this.options.sseUrl
        ? `notice-dispatcher:${this.options.sseUrl}`
        : 'notice-dispatcher'
      const workerUrl = resolveWorkerUrl(this.options)
      if (shouldWarnMissingWorkerUrl(this.options)) {
        warnMissingWorkerUrl()
      }
      if (workerUrl) {
        this.worker = new globalThis.SharedWorker(workerUrl, { name: workerName })
      } else {
        this.worker = new SharedWorkerFactory({ name: workerName })
      }
      this.port = this.worker.port

      // 监听 Worker 消息
      this.port.onmessage = (event) => {
        const { type, data } = event.data
        if (type === 'sse:connected') {
          this.connected = true
        } else if (type === 'sse:closed') {
          this.connected = false
        }
        this.dispatch(type, data)
      }
      this.port.start()

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
      this.port.postMessage({
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
        if (this.port) {
          this.port.postMessage({ type: 'close' })
          this.port.close()
        }
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
        this.port = null
        this.connected = false
        if (this.unloadListenerBound && typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
          window.removeEventListener('beforeunload', this.unloadHandler)
          window.removeEventListener('pagehide', this.unloadHandler)
          this.unloadHandler = null
          this.unloadListenerBound = false
        }
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
    if (this.port) {
      this.port.postMessage({ type: 'reconnect' })
      return
    }
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

export {
  NoticeDispatcher,
  createNoticeDispatcher,
  createTabChannel,
  createTabCloseSync,
  setWorkerUrl,
  setWorkerBaseUrl
}
export default {
  NoticeDispatcher,
  createNoticeDispatcher,
  createTabChannel,
  createTabCloseSync,
  setWorkerUrl,
  setWorkerBaseUrl
}
