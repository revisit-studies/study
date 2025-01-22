import React, { useCallback, useEffect } from 'react';
import * as monaco from 'monaco-editor';
import { Box } from '@mantine/core';

// 注册 TOML 语言
monaco.languages.register({ id: 'toml' });

// 改进的 TOML 语法高亮规则，添加注释支持
monaco.languages.setMonarchTokensProvider('toml', {
  tokenizer: {
    root: [
      [/#.*$/, 'comment'], // 添加注释支持
      [/".*?"/, 'string'], // 字符串
      [/[-+]?[0-9]+(\.[0-9]+)?/, 'number'], // 数字
      [/(true|false)/, 'keyword'], // 布尔值
      [/\[.*?\]/, 'namespace'], // 表格头
      [/^[a-zA-Z0-9_-]+(?=\s*=)/, 'key'], // 键名
    ],
  },
});

// 自定义 hc-black 主题，添加注释样式
monaco.editor.defineTheme('hc-black', {
  base: 'hc-black',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '6A9955' }, // 添加注释样式
    { token: 'string', foreground: 'ce9178' },
    { token: 'number', foreground: 'b5cea8' },
    { token: 'keyword', foreground: '569cd6', fontStyle: 'bold' },
    { token: 'namespace', foreground: '4ec9b0', fontStyle: 'bold' },
    { token: 'key', foreground: 'dcdcaa', fontStyle: 'italic' },
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
const initialCode = `name = "d3-hierarchy"
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
node = ">=12"`;

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
