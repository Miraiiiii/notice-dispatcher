# Notice Dispatcher

一个轻量级的消息通知调度器，基于 Server-Sent Events (SSE)，运行在 Web Worker 中。支持 Vue 2.x 和 Vue 3.x。

## 特性

- 🚀 基于 Web Worker，不阻塞主线程
- 🔄 可配置的重连机制
- 🎯 支持自定义事件
- 💪 TypeScript 支持
- 🛡️ 错误处理和状态管理
- 🔌 支持 Vue 2.x 和 Vue 3.x
- 📦 支持 ESM 和 CommonJS

## 安装

```bash
npm install notice-dispatcher
```

## 基础使用

```javascript
import NoticeDispatcher from 'notice-dispatcher'

const dispatcher = new NoticeDispatcher({
  sseUrl: 'http://api.example.com/events',
  events: ['notification', 'alert'],  // 要监听的事件类型
  autoReconnect: true,  // 启用自动重连
  retryInterval: 5000   // 重连间隔时间，默认 5000ms
})

// 监听连接状态
dispatcher.on('sse:connected', () => {
  console.log('SSE 连接成功')
})

// 监听错误
dispatcher.on('sse:error', ({ error }) => {
  console.error('发生错误:', error)
})

// 监听自定义事件
dispatcher.on('notification', (data) => {
  console.log('收到通知:', data)
})

// 检查连接状态
if (!dispatcher.isConnected()) {
  dispatcher.reconnect()
}

// 关闭连接
dispatcher.close()
```

## Vue 3 中使用

### 创建通知服务

```javascript
// src/services/notification.js
import NoticeDispatcher from 'notice-dispatcher'
import { ElNotification } from 'element-plus' // 假设使用 Element Plus

class NotificationService {
  constructor() {
    this.dispatcher = new NoticeDispatcher({
      sseUrl: 'http://api.example.com/events',
      events: ['notification', 'alert'],
      autoReconnect: true,  // 启用自动重连
      retryInterval: 5000   // 重连间隔时间，默认 5000ms
    })
    this.init()
  }

  init() {
    // 连接状态处理
    this.dispatcher.on('sse:connected', () => {
      console.log('SSE 连接成功')
    })

    // 错误处理
    this.dispatcher.on('sse:error', ({ error }) => {
      console.error('SSE 错误:', error)
    })

    // 监听通知
    this.dispatcher.on('notification', (data) => {
      ElNotification({
        title: data.title,
        message: data.message,
        type: data.type || 'info'
      })
    })
  }

  destroy() {
    this.dispatcher.close()
  }
}

export default new NotificationService()
```

### Composition API 方式

```javascript
// src/composables/useNotification.js
import { onMounted, onBeforeUnmount } from 'vue'
import NotificationService from '@/services/notification'

export function useNotification() {
  const handleNotification = (data) => {
    console.log('收到通知:', data)
  }

  onMounted(() => {
    NotificationService.dispatcher.on('notification', handleNotification)
  })

  onBeforeUnmount(() => {
    NotificationService.dispatcher.off('notification', handleNotification)
  })

  return {
    isConnected: () => NotificationService.dispatcher.isConnected(),
    reconnect: () => NotificationService.dispatcher.reconnect()
  }
}

// 在组件中使用
// YourComponent.vue
<script setup>
import { useNotification } from '@/composables/useNotification'

const { isConnected, reconnect } = useNotification()
</script>
```

### Options API 方式

```javascript
// YourComponent.vue
<script>
import NotificationService from '@/services/notification'

export default {
  data() {
    return {
      connected: false
    }
  },
  methods: {
    handleNotification(data) {
      console.log('收到通知:', data)
    },
    checkConnection() {
      this.connected = NotificationService.dispatcher.isConnected()
    }
  },
  mounted() {
    NotificationService.dispatcher.on('notification', this.handleNotification)
  },
  beforeDestroy() {
    NotificationService.dispatcher.off('notification', this.handleNotification)
  }
}
</script>
```

### 配合 Pinia 使用

```javascript
// stores/notification.js
import { defineStore } from 'pinia'
import NotificationService from '@/services/notification'

export const useNotificationStore = defineStore('notification', {
  state: () => ({
    connected: false,
    notifications: []
  }),
  actions: {
    init() {
      NotificationService.dispatcher.on('notification', (data) => {
        this.notifications.push(data)
      })
      
      NotificationService.dispatcher.on('sse:connected', () => {
        this.connected = true
      })
    }
  }
})
```

## API 参考

### NoticeDispatcher

#### 配置选项

| 参数 | 类型 | 默认值 | 必填 | 说明 |
|------|------|--------|------|------|
| sseUrl | string | - | 是 | SSE 服务端地址 |
| events | string[] | [] | 否 | 要监听的自定义事件列表 |
| retryInterval | number | 5000 | 否 | 重连间隔时间（毫秒） |
| headers | object | - | 否 | 请求头配置 |
| withCredentials | boolean | false | 否 | 是否携带认证信息 |
| autoReconnect | boolean | false | 否 | 是否在连接断开时自动重连 |

#### 方法

| 方法名 | 参数 | 返回值 | 说明 |
|--------|------|--------|------|
| on | (type: string, handler: Function) | void | 添加事件监听器 |
| off | (type: string, handler: Function) | void | 移除事件监听器 |
| isConnected | () | boolean | 检查连接状态 |
| reconnect | () | void | 重新连接 |
| close | () | void | 关闭连接 |

#### 内置事件

| 事件名 | 数据 | 说明 |
|--------|------|------|
| sse:connected | { timestamp: number } | SSE 连接成功 |
| sse:error | { error: Error, type: string } | 发生错误 |
| sse:closed | { timestamp: number } | 连接关闭 |
| sse:message | any | 默认消息 |

## 注意事项

1. **错误处理**
   - 建议监听 `sse:error` 事件处理连接错误
   - 可以根据 error.type 区分错误类型（connection/parsing/configuration）

2. **内存管理**
   - 在组件销毁时记得调用 `off` 移除事件监听
   - 在应用关闭时调用 `close` 关闭连接

3. **跨域支持**
   - 确保服务端配置了正确的 CORS 头
   - SSE 连接需要服务端支持 `text/event-stream` Content-Type

4. **自动重连**
   - 可以通过 `autoReconnect` 参数配置是否启用自动重连
   - 可以通过 `retryInterval` 参数配置重连间隔时间

## 浏览器支持

需要支持以下特性的现代浏览器：
- Web Worker
- EventSource
- ES Modules

## 许可证

[MIT](LICENSE)
