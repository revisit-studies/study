import React, { useCallback, useEffect } from 'react';
import * as monaco from 'monaco-editor';
import { Box } from '@mantine/core';

// JSON 格式的初始代码
const initialCode = JSON.stringify({
  name: 'd3-hierarchy',
  version: '3.1.2',
  description: 'Layout algorithms for visualizing hierarchical data.',
  homepage: 'https://d3js.org/d3-hierarchy/',
  repository: {
    type: 'git',
    url: 'https://github.com/d3/d3-hierarchy.git',
  },
  keywords: [
    'd3',
    'd3-module',
    'layout',
    'tree',
    'treemap',
    'hierarchy',
    'infovis',
  ],
  license: 'ISC',
  author: {
    name: 'Mike Bostock',
    url: 'http://bost.ocks.org/mike',
  },
  type: 'module',
  files: [
    'dist/**/*.js',
    'src/**/*.js',
  ],
  module: 'src/index.js',
  main: 'src/index.js',
  jsdelivr: 'dist/d3-hierarchy.min.js',
  unpkg: 'dist/d3-hierarchy.min.js',
  exports: {
    umd: './dist/d3-hierarchy.min.js',
    default: './src/index.js',
  },
  sideEffects: false,
  devDependencies: {
    benchmark: '2',
    'd3-array': '1.2.0 - 3',
    'd3-dsv': '1 - 3',
    'd3-random': '1.1.0 - 3',
    eslint: '8',
    mocha: '9',
    rollup: '2',
    'rollup-plugin-terser': '7',
  },
  comments: 'd3-random is a peer dependency.',
  scripts: {
    test: "mocha 'test/**/*-test.js' && eslint src test",
    prepublishOnly: 'rm -rf dist && yarn test && rollup -c',
    postpublish:
      'git push && git push --tags && cd ../d3.github.com && git pull && cp ../$npm_package_name/dist/$npm_package_name.js $npm_package_name.v$npm_package_version%%.*.js && cp ../$npm_package_name/dist/$npm_package_name.min.js $npm_package_name.v$npm_package_version%%.*.min.js && git add $npm_package_name.v$npm_package_version%%.*.js $npm_package_name.v$npm_package_version%%.*.min.js && git push && cd -',
  },
  engines: {
    node: '>=12',
  },
}, null, 2);

function CodeEditorTest(): React.ReactElement {
  // 配置 Monaco Editor 的语言支持
  useEffect(() => {
    // 配置 JSON 语言特性
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
        language: 'json',
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
