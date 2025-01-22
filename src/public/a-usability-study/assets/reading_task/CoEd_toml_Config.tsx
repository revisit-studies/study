import React, { useCallback, useEffect } from 'react';
import * as monaco from 'monaco-editor';
import { Box } from '@mantine/core';

// 注册 TOML 语言
monaco.languages.register({ id: 'toml' });

// 改进的 TOML 语法高亮配置
monaco.languages.setMonarchTokensProvider('toml', {
  defaultToken: '',
  tokenPostfix: '.toml',

  brackets: [
    { open: '{', close: '}', token: 'delimiter.curly' },
    { open: '[', close: ']', token: 'delimiter.square' },
    { open: '(', close: ')', token: 'delimiter.parenthesis' },
  ],

  keywords: ['true', 'false'],
  operators: ['=', '.'],
  symbols: /[=><!~?:&|+\-*/%]+/,

  // 改进的 tokenizer 配置
  tokenizer: {
    root: [
      // 注释 (需要放在最前面以确保优先匹配)
      [/#.*$/, 'comment'],

      // 表格头 (sections)
      [/^\s*\[[^\]]*\]/, 'metatag'],

      // 键值对
      [/([A-Za-z0-9_-]+)(\s*=)/, ['key', 'delimiter']],

      // 字符串
      [/"([^"\\]|\\.)*$/, 'string.invalid'], // 未闭合的双引号字符串
      [/'([^'\\]|\\.)*$/, 'string.invalid'], // 未闭合的单引号字符串
      [/"/, 'string', '@string_double'], // 双引号字符串
      [/'/, 'string', '@string_single'], // 单引号字符串

      // 数字
      [/\d*\.\d+([eE][-+]?\d+)?/, 'number.float'],
      [/0[xX][0-9a-fA-F]+/, 'number.hex'],
      [/\d+/, 'number'],

      // 空白字符
      [/\s+/, 'white'],
    ],

    string_double: [
      [/[^\\"]+/, 'string'],
      [/\\./, 'string.escape'],
      [/"/, 'string', '@pop'],
    ],

    string_single: [
      [/[^\\']+/, 'string'],
      [/\\./, 'string.escape'],
      [/'/, 'string', '@pop'],
    ],
  },
});

// 自定义主题配置，添加注释样式
monaco.editor.defineTheme('hc-black', {
  base: 'hc-black',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '6A9955' }, // 添加注释样式
    { token: 'string', foreground: 'ce9178' }, // 字符串
    { token: 'number', foreground: 'b5cea8' }, // 数字
    { token: 'keyword', foreground: '569cd6' }, // 关键字
    { token: 'metatag', foreground: '4ec9b0' }, // 表格头
    { token: 'key', foreground: 'dcdcaa' }, // 键名
    { token: 'delimiter', foreground: '808080' }, // 分隔符
  ],
  colors: {
    'editor.foreground': '#ffffff',
    'editor.background': '#000000',
    'editor.lineHighlightBackground': '#333333',
    'editorCursor.foreground': '#ffffff',
    'editor.selectionBackground': '#264f78',
    'editorLineNumber.foreground': '#858585',
  },
});

// 初始代码保持不变
const initialCode = `
name = "d3-hierarchy"
version = "3.1.2"
description = "Layout algorithms for visualizing hierarchical data."
homepage = "https://d3js.org/d3-hierarchy/"
license = "ISC"
type = "module"
module = "src/index.js"
main = "src/index.js"
jsdelivr = "dist/d3-hierarchy.min.js"
unpkg = "dist/d3-hierarchy.min.js"
sideEffects = false
comments = "d3-random is a peer dependency."

[repository]
type = "git"
url = "https://github.com/d3/d3-hierarchy.git"

[author]
name = "Mike Bostock"
url = "http://bost.ocks.org/mike"

keywords = [
  "d3",
  "d3-module",
  "layout",
  "tree",
  "treemap",
  "hierarchy",
  "infovis"
]

files = [
  "dist/**/*.js",
  "src/**/*.js"
]

[exports]
umd = "./dist/d3-hierarchy.min.js"
default = "./src/index.js"

[devDependencies]
benchmark = "2"
d3-array = "1.2.0 - 3"
d3-dsv = "1 - 3"
d3-random = "1.1.0 - 3"
eslint = "8"
mocha = "9"
rollup = "2"
rollup-plugin-terser = "7"

# d3-random is a peer dependency.

[scripts]
test = "mocha 'test/**/*-test.js' && eslint src test"
prepublishOnly = "rm -rf dist && yarn test && rollup -c"
postpublish = "git push && git push --tags && cd ../d3.github.com && git pull && cp ../$npm_package_name/dist/$npm_package_name.js $npm_package_name.v$npm_package_version%%.*.js && cp ../$npm_package_name/dist/$npm_package_name.min.js $npm_package_name.v$npm_package_version%%.*.min.js && git add $npm_package_name.v$npm_package_version%%.*.js $npm_package_name.v$npm_package_version%%.*.min.js && git push && cd -"

[engines]
node = ">=12"
`;

function CodeEditorTest(): React.ReactElement {
  useEffect(() => {
    monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
      validate: true,
      allowComments: true,
      schemas: [],
      enableSchemaRequest: false,
      schemaRequest: 'ignore',
      schemaValidation: 'ignore',
    });
  }, []);

  const containerRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      const editor = monaco.editor.create(node, {
        value: initialCode,
        language: 'toml',
        theme: 'hc-black',
        automaticLayout: true,
        readOnly: true,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        renderValidationDecorations: 'on',
        folding: true,
        lineNumbers: 'on',
        roundedSelection: false,
        wordWrap: 'on',
      });

      return () => {
        editor.dispose();
      };
    }
    return undefined;
  }, []);

  return (
    <Box
      style={{
        height: '700px',
        border: '1px solid #ccc',
        borderRadius: '8px',
      }}
      ref={containerRef}
    />
  );
}

export default CodeEditorTest;
