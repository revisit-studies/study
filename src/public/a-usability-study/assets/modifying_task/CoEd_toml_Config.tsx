import React, { useState, useEffect, useCallback } from 'react';
import * as monaco from 'monaco-editor';
import { Box } from '@mantine/core';
import * as toml from 'toml';

// 初始 TOML 代码 (保持不变)
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

function useTomlEditor(initialTomlCode: string) {
  const [code, setCode] = useState(initialTomlCode);
  const [currentErrors, setCurrentErrors] = useState<string[]>([]);
  const [editorInstance, setEditorInstance] = useState<monaco.editor.IStandaloneCodeEditor | null>(null);

  const validateToml = useCallback((currentCode: string) => {
    let validationErrors: string[] = [];
    if (!editorInstance) return currentErrors;

    try {
      toml.parse(currentCode);
      validationErrors = ['No errors found. TOML is valid!'];
      monaco.editor.setModelMarkers(editorInstance.getModel()!, 'toml', []);
    } catch (e) {
      if (e instanceof Error && e.message) {
        const match = /at line (\\d+), column (\\d+)/.exec(e.message);
        if (match) {
          const lineNumber = parseInt(match[1], 10);
          const startColumn = parseInt(match[2], 10);

          validationErrors = [`Syntax error at line ${lineNumber}, column ${startColumn}: ${e.message}`];

          monaco.editor.setModelMarkers(editorInstance.getModel()!, 'toml', [{
            startLineNumber: lineNumber,
            startColumn,
            endLineNumber: lineNumber,
            endColumn: startColumn + 1,
            message: e.message,
            severity: monaco.MarkerSeverity.Error,
          }]);
        } else {
          validationErrors = [e.message];
        }
      }
    }

    setCurrentErrors(validationErrors);
    return validationErrors;
  }, [editorInstance, currentErrors]);

  return {
    code,
    setCode,
    currentErrors,
    validateToml,
    setEditorInstance,
  };
}

function CodeEditorTest({ setAnswer }: StimulusParamsTyped): React.ReactElement {
  const {
    code,
    setCode,
    currentErrors,
    validateToml,
    setEditorInstance,
  } = useTomlEditor(initialCode);

  useEffect(() => {
    const latestErrors = validateToml(code);

    setAnswer({
      status: true,
      answers: {
        code,
        error: latestErrors.join('\n'),
      },
    });
  }, [code, validateToml, setAnswer]);

  const containerRef = useCallback((node: HTMLDivElement) => {
    if (node) {
      const editor = monaco.editor.create(node, {
        value: code,
        language: 'toml',
        theme: 'hc-black',
        automaticLayout: true,
        minimap: { enabled: false },
        formatOnPaste: true,
        formatOnType: true,
        scrollBeyondLastLine: false,
        lineNumbers: 'on',
        roundedSelection: false,
        wordWrap: 'on',
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
