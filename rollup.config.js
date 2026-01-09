import babel from '@rollup/plugin-babel'
import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import webWorkerLoader from 'rollup-plugin-web-worker-loader'

const babelConfig = {
  babelHelpers: 'bundled',
  presets: [
    ['@babel/preset-env', {
      targets: {
        node: '12',
        browsers: [
          'last 2 versions',
          'not dead',
          '> 0.2%'
        ]
      }
    }]
  ]
}

const baseConfig = {
  input: ['src/index.js', 'src/utils/sse.worker.js'],
  output: [
    {
      dir: 'dist',
      format: 'es',
      entryFileNames: '[name].mjs'
    },
    {
      dir: 'dist',
      format: 'es',
      entryFileNames: '[name].modern.mjs',
      intro: "const __NOTICE_DISPATCHER_AUTO_WORKER_URL__ = new URL('./sse.worker.js', import.meta.url).toString();"
    },
    {
      dir: 'dist',
      format: 'cjs',
      entryFileNames: '[name].cjs'
    }
  ],
  plugins: [
    resolve(),
    commonjs(),
    webWorkerLoader({
      targetPlatform: 'browser',
      inline: false,
      preserveFileNames: true
    }),
    babel(babelConfig)
  ]
}

const workerConfig = {
  input: 'src/utils/sse.worker.js',
  output: {
    dir: 'dist/worker',
    format: 'iife',
    entryFileNames: '[name].js',
    name: 'NoticeDispatcherWorker'
  },
  plugins: [
    resolve(),
    commonjs(),
    babel(babelConfig)
  ]
}

export default [baseConfig, workerConfig]
