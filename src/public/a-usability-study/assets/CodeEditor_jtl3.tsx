import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import CodeBlock from '@tiptap/extension-code-block';
import { Box, Button } from '@mantine/core';
import hljs from 'highlight.js';
import 'highlight.js/styles/github.css';

const DEFAULT_JSON_DATA = {
  Class: {
    id: "CS 5150",
    location: "MEB 3170",
    Instructor: {
      id: "u1234",
      name: "Bob",
      department: "SOC"
    },
    Student: [
      {
        id: "u101",
        name: "anne",
        department: "cs"
      },
      {
        id: "u102",
        name: "david",
        department: "cs"
      },
      {
        id: "u103",
        name: "vivian",
        department: "eco"
      }
    ]
  }
};

const DEFAULT_CODE = JSON.stringify(DEFAULT_JSON_DATA, null, 2);

function RefreshableJSONEditor({ parameters, setAnswer }: StimulusParams<any>) {
  const { taskid = 'code-submission' } = parameters || {};
  const [code, setCode] = useState(DEFAULT_CODE);
  const [errors, setErrors] = useState<string[]>([]);

  const editor = useEditor({
    extensions: [
      StarterKit,
      CodeBlock.configure({
        HTMLAttributes: {
          class: 'hljs',
          'data-language': 'json'
        }
      }),
    ],
    content: code,
    onUpdate({ editor }) {
      const newCode = editor.getText();
      setCode(newCode);
      highlightCode();
    },
  });

  const highlightCode = useCallback(() => {
    if (editor) {
      const codeBlocks = document.querySelectorAll('.hljs');
      codeBlocks.forEach((block) => {
        block.setAttribute('data-language', 'json');
        hljs.highlightElement(block as HTMLElement);
      });
    }
  }, [editor]);

  const validateCode = useCallback(() => {
    try {
      const parsed = JSON.parse(code);
      setErrors([
        'JSON is valid!',
        'Parsed content:',
        JSON.stringify(parsed, null, 2)
      ]);
    } catch (e: any) {
      setErrors([`JSON Validation Error: ${e.message}`]);
    }

    highlightCode();
  }, [code, highlightCode]);

  const handleRefresh = () => {
    editor?.commands.setContent(DEFAULT_CODE);
    setCode(DEFAULT_CODE);
    highlightCode();
  };

  useEffect(() => {
    setAnswer({
      status: true,
      answers: {
        [taskid]: code
      },
      format: 'json',
      errorHistory: errors.join('\n')
    });
  }, [code, errors, setAnswer, taskid]);

  return (
    <div>
      <Box
        style={{
          height: '500px',
          overflow: 'auto',
          border: '1px solid #ccc',
          borderRadius: '8px',
          backgroundColor: '#f8f9fa'
        }}
        p="md"
      >
        {!editor ? (
          <div>Loading editor...</div>
        ) : (
          <EditorContent editor={editor} />
        )}
      </Box>

      <Box mt="md" display="flex" justifyContent="space-between">
        <Button onClick={handleRefresh}>Refresh</Button>
        <Button onClick={validateCode}>Validate JSON</Button>
      </Box>

      <Box mt="md">
        <h3>Validation Results:</h3>
        <pre style={{ 
          whiteSpace: 'pre-wrap',
          background: '#f5f5f5',
          padding: '10px',
          borderRadius: '4px'
        }}>
          {errors.join('\n')}
        </pre>
      </Box>
    </div>
  );
}

export default RefreshableJSONEditor;