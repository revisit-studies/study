import React, { useCallback, useRef, useEffect } from 'react';
import * as monaco from 'monaco-editor';
import { Box } from '@mantine/core';

// JSON C 格式的初始代码
const initialCode = `{
  "name": "d3-hierarchy",
  "version": "3.1.2",
  "description": "Layout algorithms for visualizing hierarchical data.",
  "homepage": "https://d3js.org/d3-hierarchy/",
  "repository": {
    "type": "git",
    "url": "https://github.com/d3/d3-hierarchy.git"
  },
  "keywords": [
    "d3",
    "d3-module",
    "layout",
    "tree",
    "treemap",
    "hierarchy",
    "infovis"
  ],
  "license": "ISC",
  "author": {
    "name": "Mike Bostock",
    "url": "http://bost.ocks.org/mike"
  },
  "type": "module",
  "files": [
    "dist/**/*.js",
    "src/**/*.js"
  ],
  "module": "src/index.js",
  "main": "src/index.js",
  "jsdelivr": "dist/d3-hierarchy.min.js",
  "unpkg": "dist/d3-hierarchy.min.js",
  "exports": {
    "umd": "./dist/d3-hierarchy.min.js",
    "default": "./src/index.js"
  },
  "sideEffects": false,
  "devDependencies": {
    "benchmark": "2",
    "d3-array": "1.2.0 - 3",
    "d3-dsv": "1 - 3",
    "d3-random": "1.1.0 - 3",
    "eslint": "8",
    "mocha": "9",
    "rollup": "2",
    "rollup-plugin-terser": "7"
  },
  // d3-random is a peer dependency.
  "scripts": {
    "test": "mocha \\"test/**/*-test.js\\" && eslint src test",
    "prepublishOnly": "rm -rf dist && yarn test && rollup -c",
    "postpublish": "git push && git push --tags && cd ../d3.github.com && git pull && cp ../$npm_package_name/dist/$npm_package_name.js $npm_package_name.v$npm_package_version%%.*.js && cp ../$npm_package_name/dist/$npm_package_name.min.js $npm_package_name.v$npm_package_version%%.*.min.js && git add $npm_package_name.v$npm_package_version%%.*.js $npm_package_name.v$npm_package_version%%.*.min.js && git commit -m \\"$npm_package_name $npm_package_version\\" && git push && cd -"
  },
  "engines": {
    "node": ">=12"
  }
}`;

function CodeEditorTest(): React.ReactElement {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null); // 保存编辑器实例
  const containerRef = useRef<HTMLDivElement | null>(null); // 保存容器引用

  // 初始化语言配置
  useEffect(() => {
    // 注册 JSONC 语言
    monaco.languages.register({ id: 'jsonc' });

    // 设置 JSONC 的语言配置
    monaco.languages.setMonarchTokensProvider('jsonc', {
      tokenizer: {
        root: [
          // 注释
          [/\/\/.*$/, 'comment'],
          [/\/\*/, 'comment', '@comment'],

          // 键值对
          [/"(?:[^\\"]|\\.)*"(?=\s*:)/, 'string.key'],   // 键名
          [/:/, 'operator'],                              // 冒号
          [/,/, 'delimiter'],                             // 逗号

          // 字符串值（处理转义引号）
          [/"(?:[^\\"]|\\.)*"/, 'string.value'],         // 字符串

          // 数字
          [/-?\d+\.?\d*([eE][+-]?\d+)?/, 'number'],      // 数字

          // 布尔值和 null
          [/\b(true|false|null)\b/, 'keyword'],           // 关键字

          // 括号
          [/[\{\}\[\]]/, 'delimiter'],                    // 括号
        ],

        comment: [
          [/[^/*]+/, 'comment'],
          [/\*\//, 'comment', '@pop'],
          [/[/*]/, 'comment']
        ],
      }
    });

    // 配置 JSONC 语言特性
    monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
      validate: true,
      allowComments: true,
      trailingCommas: 'ignore',
    });
  }, []);

  // 初始化编辑器
  const initializeEditor = useCallback(() => {
    if (containerRef.current && !editorRef.current) {
      editorRef.current = monaco.editor.create(containerRef.current, {
        value: initialCode,
        language: 'jsonc',
        theme: 'hc-black',
        automaticLayout: true,
        readOnly: true,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        renderValidationDecorations: 'on',
        folding: true,
        lineDecorationsWidth: 0,
        lineNumbersMinChars: 3,
        wordWrap: 'wordWrapColumn',
        wordWrapColumn: 80,
        wrappingStrategy: 'advanced',
        wrappingIndent: 'same',
      });
    }
  }, []);

  // 销毁编辑器实例
  const disposeEditor = useCallback(() => {
    editorRef.current?.dispose();
    editorRef.current = null;
  }, []);

  // 在组件挂载和卸载时处理编辑器
  useEffect(() => {
    initializeEditor();
    return disposeEditor;
  }, [initializeEditor, disposeEditor]);

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