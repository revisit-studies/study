import React, {
  useState, useCallback,
} from 'react';
import { Box } from '@mantine/core';

import AceEditor from 'react-ace';
import { StimulusParams } from '../../../../store/types';

import 'ace-builds/src-noconflict/mode-hjson';
import 'ace-builds/src-noconflict/theme-github_dark';
import 'ace-builds/src-noconflict/ext-language_tools';
// adding worker
function CodeEditorTest({ setAnswer }: StimulusParams<unknown, Record<string, never>>): React.ReactElement {
  const [code, setCode] = useState<string>('');

  const editorOnChange = useCallback((rawCode: string) => {
    setAnswer({
      status: true,
      answers: {
        code: rawCode,
        error: rawCode,
      },
    });

    setCode(rawCode);
  }, [setAnswer]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '20px',
      padding: '20px',
    }}
    >
      {/* 图片与代码编辑器部分 */}
      <div style={{ display: 'flex', width: '100%', gap: '20px' }}>
        {/* <div style={{ flex: '0 0 60%' }}>
          <img
            src="/a-usability-study/assets/tasks/fig/config_write.png"
            alt="Example"
            style={{
              width: '100%',
              height: 'auto',
              objectFit: 'contain',
            }}
          />
        </div> */}

        <AceEditor
          mode="hjson"
          width="100%"
          value={code}
          theme="github_dark"
          onChange={editorOnChange}
          name="UNIQUE_ID_OF_DIV"
          editorProps={{ $blockScrolling: true }}
        />

      </div>

      {/* 验证状态显示 */}
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
          {/* {currentErrors.map((error, index) => (
            <li key={index} style={{ color: error.includes('valid') ? 'green' : 'red' }}>
              {error}
            </li>
          ))} */}
        </ul>
      </Box>
    </div>
  );
}

export default CodeEditorTest;
