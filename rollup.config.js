import babel from '@rollup/plugin-babel'
import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'

const config = {
  input: ['src/index.js', 'src/utils/sse.worker.js'],
  output: [
    {
      dir: 'dist',
      format: 'es',
      entryFileNames: '[name].mjs'
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
    babel({
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
    })
  ]
}

export default config
