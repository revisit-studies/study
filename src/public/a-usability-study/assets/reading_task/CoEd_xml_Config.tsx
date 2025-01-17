import React, { useRef, useEffect } from 'react';
import * as monaco from 'monaco-editor';
import { Box } from '@mantine/core';

const initialXmlCode = `<project>
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
    <dependency name="benchmark">2</dependency>
    <dependency name="d3-array">1.2.0 - 3</dependency>
    <dependency name="d3-dsv">1 - 3</dependency>
    <dependency name="d3-random">1.1.0 - 3</dependency>
    <dependency name="eslint">8</dependency>
    <dependency name="mocha">9</dependency>
    <dependency name="rollup">2</dependency>
    <dependency name="rollup-plugin-terser">7</dependency>
  </devDependencies>
  <!-- d3-random is a peer dependency -->
  <scripts>
    <test>mocha test/**/*-test.js && eslint src test</test>
    <prepublishOnly>rm -rf dist && yarn test && rollup -c</prepublishOnly>
    <postpublish>
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
    </postpublish>
  </scripts>
  <engines>
    <node>>=12</node>
  </engines>
</project>`;

function CodeEditorXml(): React.ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

  useEffect(() => {
    if (containerRef.current) {
      // 配置 XML 语言支持
      monaco.languages.register({ id: 'xml' });

      // 设置 XML 的语法高亮规则
      monaco.languages.setMonarchTokensProvider('xml', {
        tokenizer: {
          root: [
            // CDATA
            [/(<!\[)(CDATA)(\[)/, ['delimiter.cdata', 'tag', 'delimiter.cdata']],
            [/\]\]>/, 'delimiter.cdata'],

            // 注释
            [/<!--/, { token: 'comment', next: '@comment' }],
            [/-->/, 'comment'],

            // 开始标签
            [/<(?![\!\[])([a-zA-Z_:][\w.:_-]*)/, 'tag.content'],
            [/>/, 'tag.content'],

            // 结束标签
            [/<\/([a-zA-Z_:][\w.:_-]*)>/, 'tag.content'],

            // 属性
            [/[a-zA-Z_:][\w.:_-]*(?=\s*=)/, 'attribute.name'],
            [/=/, 'delimiter'],
            [/"[^"]*"|'[^']*'/, 'attribute.value'],

            // CDATA 内容处理
            [/\[[\s\S]*?\](?=\]>)/, 'string.content'],

            // 一般文本
            [/[^<>&]+/, 'text'],
          ],

          comment: [
            [/-->/, { token: 'comment', next: '@pop' }],
            [/[^-]+/, 'comment'],
            [/./, 'comment'],
          ],

          cdata: [
            [/\[.*?\](?=\]>)/, 'string.content'],
            [/\]\]>/, { token: 'delimiter.cdata', next: '@pop' }],
            [/[^\]]+/, 'string.content'],
          ],
        },
      });

      // 创建并添加自定义主题
      monaco.editor.defineTheme('custom-hc-black', {
        base: 'hc-black',
        inherit: true,
        rules: [
          { token: 'tag.content', foreground: '569CD6' },
          { token: 'string.content', foreground: 'CE9178' },
          { token: 'comment', foreground: '6A9955' },
          { token: 'delimiter.cdata', foreground: '808080' },
          { token: 'attribute.name', foreground: '9CDCFE' },
          { token: 'attribute.value', foreground: 'CE9178' },
        ],
        colors: {
          'editor.foreground': '#D4D4D4',
          'editor.background': '#000000',
        },
      });

      // 创建编辑器实例
      editorRef.current = monaco.editor.create(containerRef.current, {
        value: initialXmlCode,
        language: 'xml',
        theme: 'custom-hc-black',
        automaticLayout: true,
        readOnly: true,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        renderValidationDecorations: 'on',
        wordWrap: 'on',
        guides: {
          indentation: true,
          highlightActiveIndentation: true,
        },
        renderIndentGuides: true,
        folding: true,
        lineNumbers: 'on',
      });

      // 创建编辑器实例
      editorRef.current = monaco.editor.create(containerRef.current, {
        value: initialXmlCode,
        language: 'xml',
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
    }

    return () => {
      editorRef.current?.dispose();
    };
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

export default CodeEditorXml;
