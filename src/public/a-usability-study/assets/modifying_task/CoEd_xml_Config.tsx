import React, { useState, useEffect, useCallback } from 'react';
import * as monaco from 'monaco-editor';
import { Box } from '@mantine/core';
// 初始 XML 代码
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
    <postpublish>git push && git push --tags && cd ../d3.github.com && git pull && cp ../$npm_package_name/dist/$npm_package_name.js $npm_package_name.v$npm_package_version%%.*.js && cp ../$npm_package_name/dist/$npm_package_name.min.js $npm_package_name.v$npm_package_version%%.*.min.js && git add $npm_package_name.v$npm_package_version%%.*.js $npm_package_name.v$npm_package_version%%.*.min.js && git commit -m "$npm_package_name $npm_package_version" && git push && cd -</postpublish>
  </scripts>
  <engines>
    <node>>=12</node>
  </engines>
</package>`;
// 注册 XML 语言
monaco.languages.register({ id: 'xml' });

monaco.languages.setMonarchTokensProvider('xml', {
  autoClosingPairs: [
    { open: '<!--', close: ' -->' },
    { open: '<![CDATA[', close: ']]>' },
    { open: '<', close: '>' },
    { open: '"', close: '"' },
    { open: "'", close: "'" },
  ],
  defaultToken: '',
  tokenPostfix: '.xml',

  ignoreCase: true,

  tokenizer: {
    root: [
      [/[^<&]+/, ''],
      { include: '@whitespace' },

      // XML Declaration
      [/(<\?)\s*([a-zA-Z0-9_-]+)/, [ // 移除了 - 的转义
        { token: 'delimiter.xml' },
        { token: 'metatag.xml' },
      ]],
      [/\?>/, 'delimiter.xml'],

      // DOCTYPE
      [/(<![^>]+>)/, 'metatag.xml'],

      // Tags
      [/(<)([a-zA-Z0-9_-]+)/, [ // 移除了 \w 和 - 的转义
        { token: 'delimiter.xml' },
        { token: 'tag.xml' },
      ]],
      [/(>)/, 'delimiter.xml'],
      [/(<\/)([a-zA-Z0-9_-]+)/, [ // 移除了 \w 和 - 的转义
        { token: 'delimiter.xml' },
        { token: 'tag.xml' },
      ]],
      [/([a-zA-Z0-9_-]+)(=)/, [ // 移除了 \w 和 - 的转义
        { token: 'attribute.name.xml' },
        { token: 'delimiter.xml' },
      ]],
      [/"([^"]*)"/, 'string.xml'],
      [/'([^']*)'/, 'string.xml'],
      [/[a-zA-Z0-9_-]+/, 'identifier.xml'], // 移除了 \w 和 - 的转义
      [/[<>&]/, 'delimiter.xml'],
    ],

    whitespace: [
      [/[ \t\r\n]+/, 'white'],
      [/<!--/, 'comment', '@comment'],
    ],

    comment: [
      [/[^-]+/, 'comment.content'],
      [/-->/, 'comment', '@pop'],
      [/[-]+/, 'comment.content'],
    ],
  },
});

// 自定义 XML 主题
monaco.editor.defineTheme('xml-dark', {
  base: 'hc-black',
  inherit: true,
  rules: [
    { token: 'tag.xml', foreground: '569CD6' },
    { token: 'delimiter.xml', foreground: '808080' },
    { token: 'attribute.name.xml', foreground: '9CDCFE' },
    { token: 'string.xml', foreground: 'CE9178' },
    { token: 'metatag.xml', foreground: '569CD6' },
    { token: 'comment', foreground: '6A9955' },
  ],
  colors: {
    'editor.foreground': '#D4D4D4',
    'editor.background': '#1E1E1E',
    'editor.lineHighlightBackground': '#2D2D2D',
  },
});

interface EditorAnswer {
  status: boolean;
  answers: {
    code: string;
    error: string;
  };
}

interface StimulusParamsTyped {
  setAnswer: (answer: EditorAnswer) => void;
}

function useXmlEditor(initialXmlCode: string) {
  const [code, setCode] = useState(initialXmlCode);
  const [currentErrors, setCurrentErrors] = useState<string[]>([]);
  const [editorInstance, setEditorInstance] = useState<monaco.editor.IStandaloneCodeEditor | null>(null);

  const validateXml = useCallback((currentCode: string) => {
    let validationErrors: string[] = [];
    if (!editorInstance) return currentErrors;

    try {
      // 在这里进行实体编码转换
      const processedCode = currentCode
        .replace(/&&/g, '&amp;&amp;')
        .replace(/>=</g, '&gt;=<')
        .replace(/>=([^<])/g, '&gt;=$1');

      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(processedCode, 'text/xml');

      // 检查解析错误
      const parseError = xmlDoc.getElementsByTagName('parsererror');
      if (parseError.length > 0) {
        const errorText = parseError[0].textContent || 'XML parsing error';
        // 尝试从错误消息中提取行号和列号
        const lineMatch = errorText.match(/line (\d+)/i);
        const colMatch = errorText.match(/column (\d+)/i);

        if (lineMatch && colMatch) {
          const line = parseInt(lineMatch[1], 10);
          const column = parseInt(colMatch[1], 10);

          validationErrors = [`Syntax error at line ${line}, column ${column}: ${errorText}`];

          monaco.editor.setModelMarkers(editorInstance.getModel()!, 'xml', [{
            startLineNumber: line,
            startColumn: column,
            endLineNumber: line,
            endColumn: column + 1,
            message: errorText,
            severity: monaco.MarkerSeverity.Error,
          }]);
        } else {
          validationErrors = [errorText];
        }
      } else {
        validationErrors = ['No errors found. XML is valid!'];
        monaco.editor.setModelMarkers(editorInstance.getModel()!, 'xml', []);
      }
    } catch (e) {
      if (e instanceof Error) {
        validationErrors = [e.message];
      } else {
        validationErrors = ['Unknown error occurred while validating XML'];
      }
    }

    setCurrentErrors(validationErrors);
    return validationErrors;
  }, [editorInstance, currentErrors]);

  return {
    code,
    setCode,
    currentErrors,
    validateXml,
    setEditorInstance,
  };
}

function CodeEditorTest({ setAnswer }: StimulusParamsTyped): React.ReactElement {
  const {
    code,
    setCode,
    currentErrors,
    validateXml,
    setEditorInstance,
  } = useXmlEditor(initialCode);

  useEffect(() => {
    const latestErrors = validateXml(code);

    setAnswer({
      status: true,
      answers: {
        code,
        error: latestErrors.join('\n'),
      },
    });
  }, [code, validateXml, setAnswer]);

  const containerRef = useCallback((node: HTMLDivElement) => {
    if (node) {
      const editor = monaco.editor.create(node, {
        value: code,
        language: 'xml',
        theme: 'xml-dark',
        automaticLayout: true,
        minimap: { enabled: false },
        formatOnPaste: true,
        formatOnType: true,
        scrollBeyondLastLine: false,
        lineNumbers: 'on',
        roundedSelection: false,
        wordWrap: 'on',
        renderWhitespace: 'all',
        folding: true,
      });

      setEditorInstance(editor);

      editor.onDidChangeModelContent(() => {
        const rawCode = editor.getValue();
        setCode(rawCode);
      });

      return () => {
        editor.dispose();
      };
    }
    return undefined;
  }, [setCode, setEditorInstance]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '20px',
      padding: '20px',
    }}
    >
      {/* fig and code editor */}
      <div style={{ display: 'flex', width: '100%', gap: '20px' }}>
        <div style={{ flex: '0 0 60%' }}>
          <img
            src="./assets/tasks/fig/config_write.png"
            alt="Example"
            style={{
              width: '100%',
              height: 'auto',
              objectFit: 'contain',
            }}
          />
        </div>

        <Box
          style={{
            flex: '0 0 40%',
            height: '500px',
            border: '1px solid #ccc',
            borderRadius: '8px',
          }}
          ref={containerRef}
        />
      </div>

      {/* validation */}
      <Box
        style={{
          background: '#f5f5f5',
          padding: '10px',
          borderRadius: '4px',
          border: '1px solid #ccc',
          whiteSpace: 'pre-wrap',
          overflow: 'auto',
        }}
      >
        <h3>Validation Status:</h3>
        <ul>
          {currentErrors.map((error, index) => (
            <li key={index} style={{ color: error.includes('valid') ? 'green' : 'red' }}>
              {error}
            </li>
          ))}
        </ul>
      </Box>
    </div>
  );
}

export default CodeEditorTest;
