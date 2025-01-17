import React, { useCallback, useEffect } from 'react';
import * as monaco from 'monaco-editor';
import { Box } from '@mantine/core';

const initialCode = `
name: "d3-hierarchy"
version: "3.1.2"
description: "Layout algorithms for visualizing hierarchical data."
homepage: "https://d3js.org/d3-hierarchy/"
repository:
  type: "git"
  url: "https://github.com/d3/d3-hierarchy.git"
keywords: [
  "d3",
  "d3-module",
  "layout",
  "tree",
  "treemap",
  "hierarchy",
  "infovis"
]
license: "ISC"
author:
  name: "Mike Bostock"
  url: "http://bost.ocks.org/mike"
type: "module"
files: [
  "dist/**/*.js",
  "src/**/*.js"
]
module: "src/index.js"
main: "src/index.js"
jsdelivr: "dist/d3-hierarchy.min.js"
unpkg: "dist/d3-hierarchy.min.js"
exports:
  umd: "./dist/d3-hierarchy.min.js"
  default: "./src/index.js"
sideEffects: false
devDependencies:
  benchmark: "2"
  d3-array: "1.2.0 - 3"
  d3-dsv: "1 - 3"
  d3-random: "1.1.0 - 3"
  eslint: "8"
  mocha: "9"
  rollup: "2"
  rollup-plugin-terser: "7"
# d3-random is a peer dependency.
scripts:
  test: mocha 'test/**/*-test.js' && eslint src test
  prepublishOnly: rm -rf dist && yarn test && rollup -c
  postpublish: |
    git push &&
    git push --tags &&
    cd ../d3.github.com &&
    git pull &&
    cp ../$npm_package_name/dist/$npm_package_name.js $npm_package_name.v$npm_package_version%.*.js &&
    cp ../$npm_package_name/dist/$npm_package_name.min.js $npm_package_name.v$npm_package_version%.*.min.js &&
    git add $npm_package_name.v$npm_package_version%.*.js $npm_package_name.v$npm_package_version%.*.min.js &&
    git commit -m $npm_package_name\ $npm_package_version &&
    git push &&
    cd -
engines:
  node: ">=12"
`;

function CodeEditorTest(): React.ReactElement {
  useEffect(() => {
    // 注册 HJSON 语言
    monaco.languages.register({ id: 'hjson' });

    monaco.languages.setMonarchTokensProvider('hjson', {
      tokenizer: {
        root: [
          // 注释
          [/#.*$/, 'comment'],
          
          // 键名（支持有引号和无引号）
          [/^[ \t]*([A-Za-z_$][\w$]*)(?=\s*:)/, 'type'],
          [/^[ \t]*"([^"]*)"(?=\s*:)/, 'type'],
          
          // 冒号和中括号
          [/:/, 'delimiter.colon'],
          [/[\[\]]/, 'delimiter.bracket'],
          [/,/, 'delimiter.comma'],
          
          // 布尔值和 null
          [/\b(?:true|false|null)\b/, 'keyword'],
          
          // 数字
          [/-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/, 'number'],
          
          // 引号字符串
          [/"[^"]*"/, 'string'],
          
          // 多行字符串（使用 | 语法）
          [/^\s*\|/, 'string', '@multiline'],
          
          // 无引号字符串（包括命令和路径）
          [/[^\s,\[\]{}#:]+/, 'string']
        ],
        
        multiline: [
          [/^(?!\s)/, '@pop'],  // 当遇到非空白开头的行时结束
          [/.*$/, 'string']     // 多行字符串内容
        ]
      }
    });

    monaco.languages.setLanguageConfiguration('hjson', {
      comments: {
        lineComment: '#'
      },
      brackets: [
        ['{', '}'],
        ['[', ']']
      ],
      autoClosingPairs: [
        { open: '{', close: '}' },
        { open: '[', close: ']' },
        { open: '"', close: '"' }
      ]
    });
  }, []);

  const containerRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      const editor = monaco.editor.create(node, {
        value: initialCode,
        language: 'hjson',
        theme: 'hc-black',
        automaticLayout: true,
        readOnly: true,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        renderValidationDecorations: 'on',
        folding: true,
        lineNumbers: 'on',
        roundedSelection: false,
        wordWrap: 'on'
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