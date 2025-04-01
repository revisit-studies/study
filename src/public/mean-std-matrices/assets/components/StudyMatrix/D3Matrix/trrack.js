import { initializeTrrack, Registry } from '@trrack/core';
import { initialState } from '../../../constants/matrixInitialState';

export function initProvenance(setAnswer) {
  const registry = Registry.create();

  const addNode = registry.register('add-node', (currentState, payload) => {
    currentState.answerNodes = [...currentState.answerNodes, payload];
  });

  const removeNode = registry.register('remove-node', (currentState, payload) => {
    currentState.answerNodes = currentState.answerNodes.filter((node) => node !== payload);
  });

  const setNodes = registry.register('set-nodes', (currentState, payload) => {
    currentState.selectedNodes = payload;
  });

  const addHorizontalHighligthNode = registry.register(
    'add-horizontal-node',
    (currentState, payload) => {
      currentState.horizontal = [...currentState.horizontal, payload];
    },
  );

  const removeHorizontalHighligthNode = registry.register(
    'remove-horizontal-node',
    (currentState, payload) => {
      currentState.horizontal = currentState.horizontal.filter((node) => node !== payload);
    },
  );

  const setHoriztonalHighlightNodes = registry.register(
    'set-horizontal-nodes',
    (currentState, payload) => {
      currentState.horizontal = payload;
    },
  );

  const orderByNode = registry.register('order-by-node', (currentState, payload) => {
    currentState.orderNode = payload;
  });

  const highlightLinks = registry.register('highlight-links', (currentState, payload) => {
    currentState.highlightedLinks = payload;
  });

  const endHighlightLinks = registry.register('end-highlight-links', (currentState, payload) => {
    currentState.highlightedLinks = payload;
  });

  const trrack = initializeTrrack({
    initialState,
    registry,
  });

  let prevState = trrack.getState();

  trrack.currentChange(() => {
    const newState = trrack.getState();

    if (
      JSON.stringify(prevState.answerNodes) !== JSON.stringify(newState.answerNodes)
      || JSON.stringify(prevState.orderNode) !== JSON.stringify(newState.orderNode)
    ) {
      setAnswer({
        status: true,
        provenanceGraph: trrack.graph.backend,
        answers: { answerNodes: newState.answerNodes },
      });

      prevState = newState;
    }
  });

  const actions = {
    addNode,
    removeNode,
    setNodes,

    addHorizontalHighligthNode,
    removeHorizontalHighligthNode,
    setHoriztonalHighlightNodes,

    highlightLinks,
    endHighlightLinks,
    orderByNode,
  };

  return { actions, trrack };
}
