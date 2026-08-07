/**
 * ESLint 扁平配置 (Flat Config)
 *
 * 目标：仅统一两种代码风格问题，不改动任何逻辑：
 *   1. no-var  → var 提升为 const/let（ESLint no-var 规则，自动修复）
 *   2. semi    → 统一使用分号
 *
 * 说明：
 *   - 刻意不启用 Prettier / 全量格式化，避免大范围 diff 引入风险。
 *   - 第三方压缩文件（three / skinview3d / marked）与构建产物忽略，禁止改动。
 */
export default [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      '**/three.bundle.js',
      '**/skinview3d.bundle.js',
      '**/marked.min.js',
      'build-scripts/**',
      'installer-app/**'
    ]
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs'
    },
    rules: {
      'no-var': 'error',
      'semi': ['error', 'always']
    }
  }
];