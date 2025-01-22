import React, { useState, useEffect, useCallback } from 'react';
import * as monaco from 'monaco-editor';
import { Box } from '@mantine/core';
import * as YAML from 'yaml'; // 只使用 yaml 包

// 初始 YAML 代码保持不变
const initialCode = `name: d3-hierarchy
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
    git push && git push --tags && 
    cd ../d3.github.com && git pull && 
    cp ../$npm_package_name/dist/$npm_package_name.js $npm_package_name.v$npm_package_version%%.*.js && 
    cp ../$npm_package_name/dist/$npm_package_name.min.js $npm_package_name.v$npm_package_version%%.*.min.js && 
    git add $npm_package_name.v$npm_package_version%%.*.js $npm_package_name.v$npm_package_version%%.*.min.js && 
    git push && cd -
engines:
  node: ">=12"`;

// 注册 YAML 语言
monaco.languages.register({ id: 'yaml' });

// 设置 YAML 语法高亮规则
monaco.languages.setMonarchTokensProvider('yaml', {
  tokenizer: {
    root: [
      [/^[\s-]*([a-zA-Z0-9_-]+)(?=\s*:)/, 'key'],
      [/:\s*([a-zA-Z0-9_-]+)/, 'string'],
      [/'[^']*'/, 'string'],
      [/"[^"]*"/, 'string'],
      [/\d+/, 'number'],
      [/^-\s/, 'delimiter'],
      [/true|false/, 'keyword'],
      [/#.*$/, 'comment'],
    ],
  },
});

// 自定义主题
monaco.editor.defineTheme('yaml-dark', {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'key', foreground: '9CDCFE' },
    { token: 'string', foreground: 'CE9178' },
    { token: 'number', foreground: 'B5CEA8' },
    { token: 'delimiter', foreground: 'D4D4D4' },
    { token: 'keyword', foreground: '569CD6' },
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

function useYamlEditor(initialYamlCode: string) {
  const [code, setCode] = useState(initialYamlCode);
  const [currentErrors, setCurrentErrors] = useState<string[]>([]);
  const [editorInstance, setEditorInstance] = useState<monaco.editor.IStandaloneCodeEditor | null>(null);

  const validateYaml = useCallback((currentCode: string) => {
    let validationErrors: string[] = [];
    if (!editorInstance) return currentErrors;

    try {
      YAML.parse(currentCode, {
        strict: true,
        prettyErrors: true,
      });
      validationErrors = ['No errors found. YAML is valid!'];
      monaco.editor.setModelMarkers(editorInstance.getModel()!, 'yaml', []);
    } catch (e) {
      if (e instanceof YAML.YAMLParseError) {
        const errorMsg = e.message;

        validationErrors = [errorMsg];

        monaco.editor.setModelMarkers(editorInstance.getModel()!, 'yaml', [{
          startLineNumber: 1,
          startColumn: 1,
          endLineNumber: 1,
          endColumn: Number.MAX_VALUE,
          message: errorMsg,
          severity: monaco.MarkerSeverity.Error,
        }]);
      }
    }

    setCurrentErrors(validationErrors);
    return validationErrors;
  }, [editorInstance, currentErrors]);

  return {
    code,
    setCode,
    currentErrors,
    validateYaml,
    setEditorInstance,
  };
}

function CodeEditorTest({ setAnswer }: StimulusParamsTyped): React.ReactElement {
  const {
    code,
    setCode,
    currentErrors,
    validateYaml,
    setEditorInstance,
  } = useYamlEditor(initialCode);

  useEffect(() => {
    const latestErrors = validateYaml(code);

    setAnswer({
      status: true,
      answers: {
        code,
        error: latestErrors.join('\n'),
      },
    });
  }, [code, validateYaml, setAnswer]);

  const containerRef = useCallback((node: HTMLDivElement) => {
    if (node) {
      const editor = monaco.editor.create(node, {
        value: code,
        language: 'yaml',
        theme: 'yaml-dark',
        automaticLayout: true,
        minimap: { enabled: false },
        formatOnPaste: true,
        formatOnType: true,
        scrollBeyondLastLine: false,
        lineNumbers: 'on',
        roundedSelection: false,
        wordWrap: 'on',
        tabSize: 2,
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
