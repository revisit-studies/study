import React, { useRef, useEffect } from 'react';
import * as monaco from 'monaco-editor';
import { Box } from '@mantine/core';

// 初始 TOML 代码内容
const initialTomlCode = `name = "d3-hierarchy"
version = "3.1.2"
description = "Layout algorithms for visualizing hierarchical data."
homepage = "https://d3js.org/d3-hierarchy/"

[repository]
type = "git"
url = "https://github.com/d3/d3-hierarchy.git"

keywords = [
   "d3",
   "d3-module",
   "layout",
   "tree",
   "treemap",
   "hierarchy",
   "infovis"
]

license = "ISC"

[author]
name = "Mike Bostock"
url = "http://bost.ocks.org/mike"

type = "module"
files = [
   "dist/**/*.js",
   "src/**/*.js"
]

module = "src/index.js"
main = "src/index.js"
jsdelivr = "dist/d3-hierarchy.min.js"
unpkg = "dist/d3-hierarchy.min.js"

[exports]
umd = "./dist/d3-hierarchy.min.js"
default = "./src/index.js"

sideEffects = false

[devDependencies]
benchmark = "2"
d3-array = "1.2.0 - 3"
d3-dsv = "1 - 3"
d3-random = "1.1.0 - 3"
eslint = "8"
mocha = "9"
rollup = "2"
rollup-plugin-terser = "7"

[scripts]
test = "mocha test/**/*-test.js && eslint src test"
prepublishOnly = "rm -rf dist && yarn test && rollup -c"
postpublish = """
  git push &&
  git push --tags &&
  cd ../d3.github.com &&
  git pull &&
  cp ../$npm_package_name/dist/$npm_package_name.js $npm_package_name.v$npm_package_version.*.js &&
  cp ../$npm_package_name/dist/$npm_package_name.min.js $npm_package_name.v$npm_package_version.*.min.js &&
  git add $npm_package_name.v$npm_package_version.*.js $npm_package_name.v$npm_package_version.*.min.js &&
  git commit -m "$npm_package_name $npm_package_version" &&
  git push &&
  cd -
"""

[engines]
node = ">=12"`;

function ReadOnlyTomlEditor(): React.ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // 确保 monaco 已加载
    if (!monaco || !containerRef.current) return;

    // 注册 TOML 语言
    monaco.languages.register({ id: 'toml' });

    // 设置 TOML 的语法高亮
    monaco.languages.setMonarchTokensProvider('toml', {
      defaultToken: '',
      tokenPostfix: '.toml',

      tokenizer: {
        root: [
          // 注释
          [/#.*$/, 'comment'],

          // 表格和数组表格
          [/^\s*\[\[.*?\]\]/, 'metatag'], // 数组表格
          [/^\s*\[.*?\]/, 'metatag'], // 普通表格

          // 键值对
          [/([A-Za-z_][A-Za-z0-9_\-]*)(?=\s*=)/, 'type'], // 键名
          [/=/, 'operators'], // 等号

          // 多行字符串
          [/'''/, { token: 'string', next: 'mlString' }],
          [/"""/, { token: 'string', next: 'mlStringDouble' }],

          // 普通字符串
          [/"([^"\\]|\\.)*"/, 'string'],
          [/'[^']*'/, 'string'],

          // 数字
          [/[+-]?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/, 'number'],

          // 布尔值
          [/\b(?:true|false)\b/, 'keyword'],

          // 分隔符
          [/[{}[\],]/, 'delimiter'],

          // 空白
          [/\s+/, 'white'],
        ],

        mlString: [
          [/[^']+/, 'string'],
          [/'''/, { token: 'string', next: '@pop' }],
          [/'/, 'string'],
        ],

        mlStringDouble: [
          [/[^"]+/, 'string'],
          [/"""/, { token: 'string', next: '@pop' }],
          [/"/, 'string'],
        ],
      },
    });

    // 配置 TOML 语言特性
    monaco.languages.setLanguageConfiguration('toml', {
      comments: {
        lineComment: '#',
      },
      brackets: [
        ['{', '}'],
        ['[', ']'],
        ['(', ')'],
      ],
      autoClosingPairs: [
        { open: '{', close: '}' },
        { open: '[', close: ']' },
        { open: '(', close: ')' },
        { open: '"', close: '"' },
        { open: '\'', close: '\'' },
        { open: '"""', close: '"""' },
        { open: '\'\'\'', close: '\'\'\'' },
      ],
      surroundingPairs: [
        { open: '{', close: '}' },
        { open: '[', close: ']' },
        { open: '(', close: ')' },
        { open: '"', close: '"' },
        { open: '\'', close: '\'' },
      ],
    });

    // 创建编辑器实例
    const editor = monaco.editor.create(containerRef.current, {
      value: initialTomlCode,
      language: 'toml',
      theme: 'hc-black',
      automaticLayout: true,
      readOnly: true,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      renderValidationDecorations: 'on',
      wordWrap: 'on',
      folding: true,
      lineNumbers: 'on',
      renderIndentGuides: true,
    });

    // 清理函数
    return () => {
      editor.dispose();
    };
  }, []); // 空依赖数组确保只运行一次

  return (
    <Box
      ref={containerRef}
      style={{
        height: '700px',
        border: '1px solid #ccc',
        borderRadius: '8px',
      }}
    />
  );
}

export default ReadOnlyTomlEditor;
