// import { loadPyodide } from 'pyodide';
//
// export var Pyodide = (function () {
//   let instance;
//   function createInstance() {
//     const object = new PythonRunner();
//     return object;
//   }
//   return {
//     getInstance() {
//       if (!instance) {
//         instance = createInstance();
//       }
//       return instance;
//     },
//   };
// }());
//
// class PythonRunner {
//   constructor() {
//     this._output = console.log;
//     this._pyodide = null;
//     loadPyodide({
//       indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.23.2/full',
//       stderr: (text) => {
//         this._output(text);
//       },
//       stdout: (text) => {
//         this._output(text);
//       },
//     }).then((result) => {
//       this._pyodide = result;
//
//       console.log(
//         this._pyodide.runPython(`
//             import sys
//             sys.version
//         `),
//       );
//
//       this._pyodide.runPython('print("Hello from Python!")');
//     });
//   }
//
//   setOutput(output) {
//     this._output = output;
//   }
//
//   run(code) {
//     if (this._pyodide) {
//       return this._pyodide.runPython(code);
//     }
//   }
// }
