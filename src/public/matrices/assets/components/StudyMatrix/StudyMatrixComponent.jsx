import React, { useEffect, useState, useRef } from 'react';
import D3Matrix from './D3Matrix/index.js';
import './style.css';
import { useDispatch, useSelector } from 'react-redux';
import useResizeObserver from './useResizeObserver.js';
import Menu from '../Menu/index.jsx';
import { setParameters } from '../../features/matrix/matrixSlice.js';
import { Button, Loader } from '@mantine/core';

const StudyMatrixComponent = ({ parameters, setAnswer, provenanceState }) => {
  const { data, loading } = useLoadData(parameters.dataset);

  return data ? (
    <StudyMatrix data={data} parameters={parameters} setAnswer={setAnswer} provenanceState={provenanceState}></StudyMatrix>
  ) : (
    <Loader size={50} style={{ position: 'absolute', top: '50%', left: '50%' }} />
  );
};

export default StudyMatrixComponent;

const StudyMatrix = ({ data, parameters, setAnswer, provenanceState }) => {
  const matrixRef = useRef(null);
  const dimensions = useResizeObserver(matrixRef);
  const [matrix, setMatrix] = useState(null);

  useEffect(() => {
    setMatrix(new D3Matrix(matrixRef.current, data, parameters, setAnswer));

    return () => {
      // should include a better cleanup...
      if (matrixRef.current) matrixRef.current.innerHTML = '';
    };
  }, []);

  useEffect(() => {
    if (!dimensions || !matrix) return;
    matrix.onResize(dimensions);
  }, [dimensions]);

  // custom hook to allow modifying the matrix, will be deleted on study
  useMatrixUpdate(matrix, data, parameters);

  // useEffects for replay
  useProvenanceReplay(matrix, provenanceState);

  return (
    <div id="matrix-div">
      <div id="matrix-tooltip"></div>
      {!provenanceState && <StudyButtons parameters={parameters}></StudyButtons>}
      {!provenanceState && parameters.isConfig && <Menu></Menu>}
      <svg ref={matrixRef} className="fill" />
    </div>
  );
};

const StudyButtons = ({ parameters }) => {
  return (
    <div id="buttons-div">
      {parameters.isConfig && (
        <div
          style={{
            display: 'flex',
            gap: '5px',
          }}
        >
          <div
            style={{
              display: 'flex',
              gap: '5px',
              flexDirection: 'column',
            }}
          >
            <div>By mean:</div>
            <Button id="mean-optimal-clustering">Optimal Leaf Clustering</Button>
            <Button id="mean-pca-clustering">PCA Clustering</Button>
          </div>

          <div
            style={{
              display: 'flex',
              gap: '5px',
              flexDirection: 'column',
            }}
          >
            <div>By std:</div>
            <Button id="std-optimal-clustering">Optimal Leaf Clustering</Button>
            <Button id="std-pca-clustering">PCA Clustering</Button>
          </div>
          <div
            style={{
              display: 'flex',
              gap: '5px',
              flexDirection: 'column',
            }}
          >
            <div>By snr:</div>
            <Button id="snr-optimal-clustering">Optimal Leaf Clustering</Button>
            <Button id="snr-pca-clustering">PCA Clustering</Button>
          </div>
        </div>
      )}

      <Button id="clear-selection">Clear Selection</Button>
      <Button id="clear-highlights">Clear Highlights</Button>
      <Button id="reset">Reset Ordering</Button>
    </div>
  );
};

const useMatrixUpdate = (matrix, data, parameters) => {
  const dispatch = useDispatch();
  useEffect(() => {
    if (!parameters) return;
    dispatch(setParameters(parameters));
  }, [parameters]);

  const menuParameters = useSelector((state) => state.matrix.parameters);

  useEffect(() => {
    if (!matrix) return;
    matrix.data = data;
    matrix.updateVis();
  }, [data]);

  useEffect(() => {
    if (!matrix) return;
    Object.assign(matrix, {
      ...menuParameters,
    });
    matrix.updateVis();
  }, [menuParameters]);
};

const useLoadData = (parametersFile) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const menuFile = useSelector((state) => state.data.file);

  const file = menuFile ? menuFile : parametersFile;

  useEffect(() => {
    loadData(file, setData, setLoading);
  }, [file]);

  return { data, loading };
};

const useProvenanceReplay = (matrix, provenanceState) => {
  useEffect(() => {
    if (!provenanceState || !matrix) return;
    const { selectedNodes } = provenanceState;
    matrix.selectNodes(selectedNodes);
  }, [provenanceState?.selectedNodes]);

  useEffect(() => {
    if (!provenanceState || !matrix) return;
    const { highlightedLinks } = provenanceState;
    matrix.highlightLinks(highlightedLinks);
  }, [provenanceState?.highlightedLinks]);

  useEffect(() => {
    if (!provenanceState || !matrix) return;
    const { horizontal } = provenanceState;
    matrix.highlightDestinations(horizontal);
  }, [provenanceState?.horizontal]);

  useEffect(() => {
    if (!provenanceState || !matrix) return;
    const { orderNode } = provenanceState;
    matrix.orderByNode(orderNode);
  }, [provenanceState?.orderNode]);
};

async function loadData(file, setData, setLoading) {
  if (!file) return;

  setLoading(true);
  try {
    const response = await fetch(`data/${file}`);
    if (!response.ok) throw new Error('Failed to fetch file');

    const text = await response.text();
    const parsedData = text
      .split('\n')
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line));
    setData(parsedData);
  } catch (error) {
    console.error('Error loading JSON:', error);
  } finally {
    setLoading(false);
  }
}
