# Notice Dispatcher

一个轻量的 SSE（Server‑Sent Events）通知调度器，默认运行在 Worker 中，支持多标签页复用同一连接（SharedWorker）。

## 特性

- 同源 + 相同 sseUrl 的标签页共享同一 SSE 连接
- 支持自动重连与自定义事件
- ESM / CJS 双输出
- 内置类型声明

## 安装

```bash
npm install notice-dispatcher
```

## 基本使用

```js
import NoticeDispatcher from 'notice-dispatcher'

const dispatcher = new NoticeDispatcher({
  sseUrl: 'https://api.example.com/events',
  events: ['notification', 'alert'],
  autoReconnect: true,
  retryInterval: 5000,
  withCredentials: true
})

dispatcher.on('sse:connected', () => {
  console.log('SSE 已连接')
})

dispatcher.on('sse:error', ({ error }) => {
  console.error('SSE 错误:', error)
})

dispatcher.on('notification', (data) => {
  console.log('收到通知:', data)
})
```

## 多标签共享（SharedWorker）

SharedWorker 只有在「**同源 + 同脚本 URL + 同 name**」时才能共享实例。  
本库默认 name 为 `notice-dispatcher:${sseUrl}`，所以需要保证 **worker 脚本 URL 稳定且可访问**。

### 1) 现代构建器（Vite / webpack5 / Rollup）

使用 ESM import（`exports.import`）时，会通过 `import.meta.url` 自动推导 worker URL。  
无需额外配置，但构建产物仍会生成一个 worker 静态文件。

#### Vite 4+ 预构建导致 Failed to fetch

Vite 4 会对依赖做预构建，可能导致 `import.meta.url` 指向错误路径，从而报：
`Failed to fetch a worker script`。  
解决方法是在 `vite.config.js` 中排除预构建：

```js
// vite.config.js
import { defineConfig } from 'vite'

export default defineConfig({
  optimizeDeps: {
    exclude: ['notice-dispatcher']
  }
})
```

### 2) 旧版 Vue CLI（webpack4）

旧版不支持 `import.meta.url`，需要手动提供 worker 文件并设置 URL。

推荐做法：构建时自动拷贝 worker 文件

```bash
npm i -D copy-webpack-plugin@6
```

```js
// vue.config.js
const path = require('path')
const CopyWebpackPlugin = require('copy-webpack-plugin')

module.exports = {
  configureWebpack: {
    plugins: [
      new CopyWebpackPlugin({
        patterns: [
          {
            from: path.resolve(__dirname, 'node_modules/notice-dispatcher/dist/worker/sse.worker.js'),
            to: 'notice-dispatcher/sse.worker.js'
          }
        ]
      })
    ]
  }
}
```

入口设置一次即可：

```js
import { setWorkerUrl } from 'notice-dispatcher'

setWorkerUrl('/notice-dispatcher/sse.worker.js')
```

也可以用 `setWorkerBaseUrl('/notice-dispatcher/')` 自动拼接文件名。

### 3) npm link / 本地调试

1. 先构建：`npm run build`
2. 再 `npm link`
3. 使用方按“旧版 Vue CLI”方式拷贝 worker，并设置 `setWorkerUrl`

如果控制台出现：
`NoticeDispatcher: 未配置 workerUrl/workerBaseUrl...`
说明当前回退为 inline 模式，**不会跨标签共享**。

## API

### new NoticeDispatcher(options)

### createNoticeDispatcher(options)

同一个 `sseUrl` 在单页内只创建一个实例。

### setWorkerUrl(url)

全局设置 SharedWorker 脚本 URL。

### setWorkerBaseUrl(baseUrl)

全局设置基础路径，会自动拼接 `sse.worker.js`。

## 配置项

| 参数 | 类型 | 默认 | 必填 | 说明 |
|---|---|---|---|---|
| sseUrl | string | - | 是 | SSE 服务端地址 |
| events | string[] | [] | 否 | 监听的自定义事件 |
| retryInterval | number | 5000 | 否 | 重试间隔（ms） |
| withCredentials | boolean | false | 否 | 是否携带凭证 |
| autoReconnect | boolean | false | 否 | 连接错误时自动重连 |
| workerUrl | string | - | 否 | SharedWorker 脚本 URL |
| workerBaseUrl | string | - | 否 | SharedWorker 脚本基础 URL |

## 调试事件

```js
dispatcher.on('worker:info', (info) => {
  console.log(info.workerId, info.ports)
})
```

若两个标签页输出的 `workerId` 相同，则复用成功。

## 常见问题

### Failed to fetch a worker script

worker 文件没有被静态资源服务到，或 URL 不正确。  
旧版项目请按「旧版 Vue CLI」的拷贝方式处理。

### Cannot use import statement outside a module

说明你把 `workerUrl` 指向了 ESM 版本（`dist/sse.worker.js`）。  
请改用 `dist/worker/sse.worker.js`（经典脚本）。

### 标签页 workerId 不同

通常是使用了 inline/Blob worker（URL 不稳定）。  
请提供可访问的 worker 文件并设置 `setWorkerUrl`。

## License

MIT
