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
  autoReconnect: true,               // 启用自动重连
  retryInterval: 5000,               // 重连间隔时间，默认 5000ms
  withCredentials: true,             // 启用凭证发送（cookies等）
  headers: {                         // 自定义请求头
    'Authorization': 'Bearer token'
  }
})

// 监听连接状态
dispatcher.on('sse:connected', () => {
  console.log('SSE 连接成功')
})

// 监听错误
dispatcher.on('sse:error', ({ error }) => {
  console.error('发生错误:', error)
})

// 监听连接关闭
dispatcher.on('sse:closed', () => {
  console.log('SSE 连接已关闭')
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

## 配置选项

| 参数 | 类型 | 默认值 | 必填 | 说明 |
|------|------|--------|------|------|
| sseUrl | string | - | 是 | SSE 服务端地址 |
| events | string[] | [] | 否 | 要监听的自定义事件列表 |
| retryInterval | number | 5000 | 否 | 重连间隔时间（毫秒） |
| headers | object | - | 否 | 请求头配置 |
| withCredentials | boolean | false | 否 | 是否携带认证信息（cookies等） |
| autoReconnect | boolean | false | 否 | 是否在连接断开时自动重连 |

## API 方法

| 方法名 | 参数 | 返回值 | 说明 |
|--------|------|--------|------|
| on | (type: string, handler: Function) | void | 添加事件监听器 |
| off | (type: string, handler: Function) | void | 移除事件监听器 |
| isConnected | () | boolean | 检查连接状态 |
| reconnect | () | void | 手动重新连接 |
| close | () | void | 关闭连接 |

## 内置事件

| 事件名 | 数据格式 | 说明 |
|--------|----------|------|
| sse:connected | { timestamp: number } | SSE 连接成功 |
| sse:closed | { timestamp: number } | SSE 连接关闭 |
| sse:error | { error: { message: string, type: string }, timestamp: number } | 发生错误 |
| sse:message | { data: any, origin: string, timestamp: number } | 默认消息事件 |

## 本地开发调试

### npm link 使用

1. 在本项目目录下执行：
```bash
npm link
```

2. 在使用此库的项目中执行：
```bash
npm link notice-dispatcher
```

### 处理跨域问题

#### 1. 配置开发服务器代理

##### Vue CLI (webpack) 项目

```javascript
// vue.config.js
module.exports = {
  devServer: {
    proxy: {
      '/api': {
        target: 'http://your-api-server.com',
        changeOrigin: true,
        ws: true,
        credentials: true  // 如果需要发送 cookies
      }
    }
  }
}
```

##### Vite 项目

```javascript
// vite.config.js
export default {
  server: {
    proxy: {
      '/api': {
        target: 'http://your-api-server.com',
        changeOrigin: true,
        ws: true,
        credentials: true  // 如果需要发送 cookies
      }
    }
  }
}
```

#### 2. 认证和 Cookie 处理

如果需要发送认证信息（如 cookies），需要：

1. 客户端配置：
```javascript
const dispatcher = new NoticeDispatcher({
  sseUrl: 'http://localhost:8080/api/events',
  withCredentials: true  // 启用 cookies 发送
})
```

2. 服务器配置：
```javascript
// Node.js Express 示例
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Origin', 'http://localhost:8080'); // 必须是具体的源
  next();
});
```

## 浏览器兼容性

- 支持 EventSource API 的现代浏览器
- Chrome 9+
- Firefox 6+
- Safari 5+
- Edge 79+
- Opera 11+

## 注意事项

1. **跨域处理**
   - 确保服务器正确配置了 CORS 头
   - 使用代理时注意配置 `ws: true`
   - 发送认证信息时必须配置 `credentials: true`

2. **安全性**
   - 生产环境建议使用 HTTPS
   - 注意 token 等敏感信息的处理
   - 合理配置重连机制，避免服务器压力

3. **性能优化**
   - 合理使用 `autoReconnect` 和 `retryInterval`
   - 及时调用 `close()` 方法清理资源
   - 注意移除不使用的事件监听器

## License

MIT
