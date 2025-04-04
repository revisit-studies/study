import React from 'react';
import StudyMatrix from './components/StudyMatrix';

const testParameters = {
  file: 'afull_dataset_20250319_153318.txt',
  encoding: 'cellSize',
  colorScale: 'reds',
  isSnr: false,
  nMeans: 5,
  nStds: 3,
  tooltipHistogram: 'frequencies',
};

/**
 * prints the test answer
 * @param {JSON} obj a JSON object with the answer, trigger
 * @returns {void}
 */
function setAnswer(obj) {
  console.log('Answer SETTED:', obj);
}

const App = () => {
  return <StudyMatrix parameters={testParameters} setAnswer={setAnswer}></StudyMatrix>;
};

export default App;
