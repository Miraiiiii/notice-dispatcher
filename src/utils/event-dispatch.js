class EventDispatcher {
  constructor() {
    this.handlers = new Map()
  }

  /**
   * 注册通知处理器
   * @param {string} type 通知类型
   * @param {Function} handler 处理函数
   */
  on(type, handler) {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, [])
    }
    this.handlers.get(type).push(handler)
  }

  /**
   * 移除通知处理器
   * @param {string} type 通知类型
   * @param {Function} handler 处理函数
   */
  off(type, handler) {
    if (!this.handlers.has(type)) {
      return
    }
    const handlers = this.handlers.get(type)
    const index = handlers.indexOf(handler)
    if (index !== -1) {
      handlers.splice(index, 1)
    }
    if (handlers.length === 0) {
      this.handlers.delete(type)
    }
  }

  /**
   * 发送通知
   * @param {string} type 通知类型
   * @param {*} data 通知数据
   */
  dispatch(type, data) {
    const handlers = this.handlers.get(type)
    if (handlers) {
      handlers.forEach((handler) => handler(data))
    }
  }
}

export default EventDispatcher
