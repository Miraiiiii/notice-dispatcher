module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true,
    worker: true
  },
  extends: 'airbnb-base',
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
      // 为所有 .worker.js 文件关闭 no-restricted-globals 规则
      files: ['src/**/*.worker.js'],
      rules: {
        'no-restricted-globals': 'off'
      }
    }
  ]
}
