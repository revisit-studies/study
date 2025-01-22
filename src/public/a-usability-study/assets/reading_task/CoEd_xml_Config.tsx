import React, { useCallback, useEffect } from 'react';
import * as monaco from 'monaco-editor';
import { Box } from '@mantine/core';

// JSON 格式的初始代码
const initialCode = `<?xml version="1.0" encoding="UTF-8"?>
<package>
  <name>d3-hierarchy</name>
  <version>3.1.2</version>
  <description>Layout algorithms for visualizing hierarchical data.</description>
  <homepage>https://d3js.org/d3-hierarchy/</homepage>
  <repository>
    <type>git</type>
    <url>https://github.com/d3/d3-hierarchy.git</url>
  </repository>
  <keywords>
    <keyword>d3</keyword>
    <keyword>d3-module</keyword>
    <keyword>layout</keyword>
    <keyword>tree</keyword>
    <keyword>treemap</keyword>
    <keyword>hierarchy</keyword>
    <keyword>infovis</keyword>
  </keywords>
  <license>ISC</license>
  <author>
    <name>Mike Bostock</name>
    <url>http://bost.ocks.org/mike</url>
  </author>
  <type>module</type>
  <files>
    <file>dist/**/*.js</file>
    <file>src/**/*.js</file>
  </files>
  <module>src/index.js</module>
  <main>src/index.js</main>
  <jsdelivr>dist/d3-hierarchy.min.js</jsdelivr>
  <unpkg>dist/d3-hierarchy.min.js</unpkg>
  <exports>
    <umd>./dist/d3-hierarchy.min.js</umd>
    <default>./src/index.js</default>
  </exports>
  <sideEffects>false</sideEffects>
  <devDependencies>
    <benchmark>2</benchmark>
    <d3-array>1.2.0 - 3</d3-array>
    <d3-dsv>1 - 3</d3-dsv>
    <d3-random>1.1.0 - 3</d3-random>
    <eslint>8</eslint>
    <mocha>9</mocha>
    <rollup>2</rollup>
    <rollup-plugin-terser>7</rollup-plugin-terser>
  </devDependencies>
  <!-- d3-random is a peer dependency. -->
  <scripts>
    <test>mocha 'test/**/*-test.js' && eslint src test</test>
    <prepublishOnly>rm -rf dist && yarn test && rollup -c</prepublishOnly>
    <postpublish>git push && git push --tags && cd ../d3.github.com && git pull && cp ../$npm_package_name/dist/$npm_package_name.js $npm_package_name.v$npm_package_version%%.*.js && cp ../$npm_package_name/dist/$npm_package_name.min.js $npm_package_name.v$npm_package_version%%.*.min.js && git add $npm_package_name.v$npm_package_version%%.*.js $npm_package_name.v$npm_package_version%%.*.min.js && git push && cd -</postpublish>
  </scripts>
  <engines>
    <node>>=12</node>
  </engines>
</package>`;

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
        language: 'xml',
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
