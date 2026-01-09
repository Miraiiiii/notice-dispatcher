/* eslint-disable global-require, import/no-dynamic-require */
const path = require('path')

const projectRoot = path.resolve(__dirname)
const cwd = path.resolve(process.cwd())
const isExternalConsumer = cwd !== projectRoot
const resolveFromCwd = (modulePath) => require.resolve(modulePath, { paths: [cwd] })

const baseExtends = []
if (!isExternalConsumer) {
  try {
    const eslintPkg = require(resolveFromCwd('eslint/package.json'))
    const major = Number(String(eslintPkg.version || '').split('.')[0])
    if (Number.isFinite(major) && major >= 8) {
      baseExtends.push(resolveFromCwd('eslint-config-airbnb-base'))
    }
  } catch (error) {
    // Optional in local environments.
  }
}

module.exports = isExternalConsumer ? {
  ignorePatterns: ['**/*']
} : {
  env: {
    browser: true,
    es6: true,
    node: true,
    worker: true
  },
  globals: {
    __NOTICE_DISPATCHER_AUTO_WORKER_URL__: 'readonly',
    globalThis: 'readonly'
  },
  extends: baseExtends,
  parserOptions: {
    ecmaVersion: 12,
    sourceType: 'module'
  },
  rules: {
    indent: ['error', 2],
    semi: ['error', 'never'],
    'class-methods-use-this': 'off',
    'no-param-reassign': 'off',
    'linebreak-style': ['error', 'windows'],
    'no-multiple-empty-lines': ['error', { max: 1, maxEOF: 0, maxBOF: 0 }],
    'comma-dangle': ['error', 'never'],
    'space-before-function-paren': ['error', 'never']
  },
  overrides: [
    {
      // Disable no-restricted-globals for worker files.
      files: ['src/**/*.worker.js'],
      rules: {
        'no-restricted-globals': 'off'
      }
    },
    {
      // Allow dev deps in Rollup config.
      files: ['rollup.config.js'],
      rules: {
        'import/no-extraneous-dependencies': 'off'
      }
    },
    {
      // Allow dynamic require in config files.
      files: ['.eslintrc.js'],
      rules: {
        'global-require': 'off',
        'import/no-dynamic-require': 'off'
      }
    }
  ]
}
