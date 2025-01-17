import React, { useRef, useEffect } from 'react';
import * as monaco from 'monaco-editor';
import { Box } from '@mantine/core';

const initialYamlCode = `
name: d3-hierarchy
version: 3.1.2
description: Layout algorithms for visualizing hierarchical data.
homepage: https://d3js.org/d3-hierarchy/
repository:
  type: git
  url: https://github.com/d3/d3-hierarchy.git
keywords:
  - d3
  - d3-module
  - layout
  - tree
  - treemap
  - hierarchy
  - infovis
license: ISC
author:
  name: Mike Bostock
  url: http://bost.ocks.org/mike
type: module
files:
  - dist/**/*.js
  - src/**/*.js
module: src/index.js
main: src/index.js
jsdelivr: dist/d3-hierarchy.min.js
unpkg: dist/d3-hierarchy.min.js
exports:
  umd: ./dist/d3-hierarchy.min.js
  default: ./src/index.js
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
  postpublish: >
    git push &&
    git push --tags &&
    cd ../d3.github.com &&
    git pull &&
    cp ../\${npm_package_name}/dist/\${npm_package_name}.js \${npm_package_name}.v\${npm_package_version%%.*}.js &&
    cp ../\${npm_package_name}/dist/\${npm_package_name}.min.js \${npm_package_name}.v\${npm_package_version%%.*}.min.js &&
    git add \${npm_package_name}.v\${npm_package_version%%.*}.js \${npm_package_name}.v\${npm_package_version%%.*}.min.js &&
    git commit -m "\${npm_package_name} \${npm_package_version}" &&
    git push &&
    cd -
engines:
  node: ">=12"
`;

function CodeEditorYaml(): React.ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

  // 初始化和清理 Monaco Editor
  useEffect(() => {
    if (containerRef.current) {
      editorRef.current = monaco.editor.create(containerRef.current, {
        value: initialYamlCode,
        language: 'yaml', // 使用 YAML 语言
        theme: 'hc-black', // 深色主题
        automaticLayout: true,
        readOnly: true, // 只读模式
        automaticLayout: true,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        renderValidationDecorations: 'on',
        folding: true,
        lineNumbers: 'on',
        roundedSelection: false,
        wordWrap: 'on',
        renderIndentGuides: true,
      });
    }


    return () => {
      editorRef.current?.dispose(); // 清理编辑器实例
    };
  }, []);

  return (
    <Box
      style={{
        height: '700px',
        border: '1px solid #ccc',
        borderRadius: '8px',
      }}
      ref={containerRef} // 绑定容器引用
    />
  );
}

export default CodeEditorYaml;
