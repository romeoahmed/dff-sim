import js from "@eslint/js";
import jsdoc from "eslint-plugin-jsdoc";
import globals from "globals";
import eslintConfigPrettier from "eslint-config-prettier/flat";

export default [
  // 1. 引入 ESLint 推荐配置
  js.configs.recommended,

  // 2. 引入 JSDoc 推荐配置
  jsdoc.configs["flat/recommended"],

  // 3. 配置 eslint-config-prettier，格式化规则由 Prettier 接管
  eslintConfigPrettier,

  {
    files: ["scripts/**/*.js"],
    plugins: {
      jsdoc: jsdoc,
    },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      // =========================
      // 代码质量与风格 (Code Quality)
      // =========================
      "no-var": "error",
      "prefer-const": "warn",
      eqeqeq: ["error", "always"], // 强制全等，比单纯 "error" 更严格

      // 物理仿真项目特有：
      // 禁止在循环中遗留 console.log，防止卡顿，但允许报错
      "no-console": ["warn", { allow: ["warn", "error"] }],

      // 允许定义未使用但以 _ 开头的变量 (比如 _args)，方便调试或占位
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],

      // =========================
      // JSDoc 增强配置
      // =========================

      // 强制要有描述 (Description)，而不只是参数类型
      // 比如: /** 计算电压 */ 而不是 /** @param x */
      "jsdoc/require-description": "warn",

      // 强制要求写 JSDoc 注释块
      "jsdoc/require-jsdoc": [
        "warn",
        {
          require: {
            FunctionDeclaration: true,
            MethodDefinition: true,
            ClassDeclaration: true,
            // 可选：如果你希望强制类属性也写注释，开启下面这个
            // "ClassExpression": true
          },
        },
      ],

      // 必须写 @param，但对解构参数不做强制要求
      "jsdoc/require-param": "warn",

      // 必须写类型
      "jsdoc/require-param-type": "warn",

      // 必须写 @returns，但【关键修改】：忽略构造函数
      "jsdoc/require-returns": [
        "warn",
        {
          checkConstructors: false,
        },
      ],

      // 检查 @returns 的类型是否存在
      "jsdoc/require-returns-type": "warn",
    },
  },
];
