import React, { useCallback, useEffect } from 'react';
import * as monaco from 'monaco-editor';
import { Box } from '@mantine/core';

// 注册 TOML 语言
monaco.languages.register({ id: 'toml' });

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

  symbols: /[=><!~?:&|+\-*/%]+/, // 修正后的行

  tokenizer: {
    root: [
      [/^\s*\[[^\]]*\]/, 'metatag'],
      [/([A-Za-z0-9_-]+)(\s*=)/, ['key', 'delimiter']],
      [/"([^"\\]|\\.)*$/, 'string.invalid'],
      [/'([^'\\]|\\.)*$/, 'string.invalid'],
      [/"/, 'string', '@string_double'],
      [/'/, 'string', '@string_single'],
      [/#.*$/, 'comment'],
      [/\d*\.\d+([eE][-+]?\d+)?/, 'number.float'], // 修正后的行
      [/0[xX][0-9a-fA-F]+/, 'number.hex'],
      [/\d+/, 'number'],
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

// JSON 格式的初始代码
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

[scripts]
test = "mocha 'test/**/*-test.js' && eslint src test"
prepublishOnly = "rm -rf dist && yarn test && rollup -c"
postpublish = "git push && git push --tags && cd ../d3.github.com && git pull && cp ../$npm_package_name/dist/$npm_package_name.js $npm_package_name.v$npm_package_version%%.*.js && cp ../$npm_package_name/dist/$npm_package_name.min.js $npm_package_name.v$npm_package_version%%.*.min.js && git add $npm_package_name.v$npm_package_version%%.*.js $npm_package_name.v$npm_package_version%%.*.min.js && git push && cd -"

[engines]
node = ">=12"
`;

function CodeEditorTest(): React.ReactElement {
  useEffect(() => {
    // 保持原有的 JSON 配置
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
        language: 'toml', // 使用我们注册的 toml 语言
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
