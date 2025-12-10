import { defineConfig } from "eslint/config";
import eslint from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier/flat";

export default defineConfig(
  // 1. 引入 ESLint 推荐配置 (JS 基础)
  eslint.configs.recommended,

  // 2. 引入 TypeScript 推荐配置 (包含 parser 和 plugin)
  ...tseslint.configs.recommended,

  // 3. Prettier 兼容配置 (放在最后，关闭所有格式化相关规则)
  eslintConfigPrettier,

  // 4. 项目自定义规则
  {
    files: ["**/*.{js,mjs,ts}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node, // 增加 Node 环境支持 (用于 scripts 和 config)
      },
    },
    rules: {
      // =========================
      // TypeScript 专属规则
      // =========================
      // 允许定义未使用但以 _ 开头的变量 (例如 _args)
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_" },
      ],

      // 警告显式的 any 类型，鼓励使用具体类型
      "@typescript-eslint/no-explicit-any": "warn",

      // =========================
      // 通用代码质量
      // =========================
      "no-var": "error",
      "prefer-const": "warn",
      eqeqeq: ["error", "always"], // 强制使用 ===

      // 允许 console.warn 和 console.error，其他 console 报警告
      "no-console": ["warn", { allow: ["warn", "error", "info"] }],
    },
  },
);
