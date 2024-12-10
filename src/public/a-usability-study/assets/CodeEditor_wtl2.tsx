import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import CodeBlock from '@tiptap/extension-code-block';
import { Box, Select } from '@mantine/core';
import { initializeTrrack, Registry } from '@trrack/core';
import { StimulusParams } from '../../../store/types';
import hljs from 'highlight.js';
import 'highlight.js/styles/github.css';
import * as yaml from 'js-yaml';
import JSON5 from 'json5';
import * as jsonc from 'jsonc-parser';

type SupportedFormat = 'json' | 'jsonc' | 'json5' | 'yaml' | 'xml' | 'csv';

const parseCSV = (csvText: string) => {
 const lines = csvText.trim().split('\n');
 if (lines.length === 0) throw new Error('Empty CSV');

 const headers = lines[0].split(',').map(h => h.trim());
 if (headers.length === 0) throw new Error('No headers found');

 const rows = lines.slice(1).map(line => {
   const values = line.split(',').map(v => v.trim());
   if (values.length !== headers.length) {
     throw new Error('Row length does not match headers');
   }
   return Object.fromEntries(headers.map((h, i) => [h, values[i]]));
 });

 return { headers, rows };
};

const validateXML = (xmlText: string) => {
 const parser = new DOMParser();
 const doc = parser.parseFromString(xmlText, 'text/xml');
 const parserError = doc.querySelector('parsererror');
 if (parserError) {
   throw new Error(parserError.textContent || 'Invalid XML');
 }
 return doc;
};

function CodeEditorTest({ parameters, setAnswer }: StimulusParams<any>) {
 const { taskid = 'code-submission' } = parameters || {};
 const [code, setCode] = useState('');
 const [errors, setErrors] = useState<string[]>([]);
 const [format, setFormat] = useState<SupportedFormat>('json');

 const editor = useEditor({
   extensions: [
     StarterKit,
     CodeBlock.configure({
       HTMLAttributes: {
         class: 'hljs',
         'data-language': format
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

 const { actions, trrack } = useMemo(() => {
   const reg = Registry.create();
   const updateCodeAction = reg.register(
     'Update Code',
     (state, payload: { code: string; errors: string[] }) => {
       state.code = payload.code;
       state.errors = payload.errors;
       return state;
     }
   );
   
   const trrackInst = initializeTrrack({
     registry: reg,
     initialState: {
       code: '',
       errors: [],
     },
   });
   
   return {
     actions: { updateCodeAction },
     trrack: trrackInst,
   };
 }, []);

 const highlightCode = useCallback(() => {
   if (editor) {
     const codeBlocks = document.querySelectorAll('.hljs');
     codeBlocks.forEach((block) => {
       block.setAttribute('data-language', format);
       hljs.highlightElement(block as HTMLElement);
     });
   }
 }, [editor, format]);

 const handleFormatChange = useCallback((newFormat: SupportedFormat) => {
   setFormat(newFormat);
   setCode('');
   setTimeout(highlightCode, 0);
 }, [highlightCode]);

 const validateCode = useCallback(() => {
   try {
     let parsed;
     switch (format) {
       case 'json':
         parsed = JSON.parse(code);
         setErrors([
           'JSON is valid!',
           'Parsed content:',
           JSON.stringify(parsed, null, 2)
         ]);
         break;

       case 'jsonc':
         const jsonErrors: jsonc.ParseError[] = [];
         parsed = jsonc.parse(code, jsonErrors);
         if (jsonErrors.length > 0) {
           throw new Error(jsonErrors.map(err =>
             `Error at offset ${err.offset}: ${jsonc.getParseErrorMessage(err.error)}`
           ).join('; '));
         }
         setErrors([
           'JSONC is valid!',
           'Parsed content:',
           JSON.stringify(parsed, null, 2)
         ]);
         break;

       case 'json5':
         parsed = JSON5.parse(code);
         setErrors([
           'JSON5 is valid!',
           'Parsed content:',
           JSON.stringify(parsed, null, 2)
         ]);
         break;

       case 'yaml':
         parsed = yaml.load(code);
         setErrors([
           'YAML is valid!',
           'Parsed content:',
           JSON.stringify(parsed, null, 2)
         ]);
         break;

       case 'xml':
         const xmlDoc = validateXML(code);
         setErrors(['XML is valid!']);
         break;

       case 'csv':
         parsed = parseCSV(code);
         setErrors([
           'CSV is valid!',
           'Parsed content:',
           JSON.stringify(parsed, null, 2)
         ]);
         break;
     }
   } catch (e: any) {
     setErrors([`${format.toUpperCase()} Validation Error: ${e.message}`]);
   }

   highlightCode();
 }, [code, format, highlightCode]);

 useEffect(() => {
   trrack.apply('Code Updated', actions.updateCodeAction({ code, errors }));
 
   setAnswer({
     status: true,
     answers: {
       [taskid]: code
     },
     format: format,
     errorHistory: errors.join('\n')
   });
 }, [code, errors, format, actions, setAnswer, taskid, trrack]);

 return (
   <div>
     <Box mb="md">
       <img
         src="/a-usability-study/assets/writing_task2.png"
         alt="Task Description"
         style={{
           display: 'block',
           maxWidth: '100%',
           height: 'auto',
           margin: '0 auto',
           borderRadius: '8px',
         }}
       />
     </Box>

     <Box mb="md">
       <Select
         label="Select Format"
         value={format}
         onChange={(value: SupportedFormat) => handleFormatChange(value)}
         data={[
           { value: 'json', label: 'JSON' },
           { value: 'jsonc', label: 'JSONC (JSON with Comments)' },
           { value: 'json5', label: 'JSON5' },
           { value: 'yaml', label: 'YAML' },
           { value: 'xml', label: 'XML' },
           { value: 'csv', label: 'CSV' }
         ]}
       />
     </Box>

     {!editor ? (
       <div>Loading editor...</div>
     ) : (
       <>
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
           <EditorContent editor={editor} />
         </Box>

         <Box mt="md">
           <button onClick={validateCode}>Validate {format.toUpperCase()}</button>
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
       </>
     )}
   </div>
 );
}

export default CodeEditorTest;