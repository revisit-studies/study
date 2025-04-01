/*  eslint-disable @typescript-eslint/no-explicit-any */

import React, { createContext, useContext, useMemo } from 'react';
import * as d3 from 'd3';
import { Registry, Trrack } from '@trrack/core';
import { TrrackState } from './Interfaces';

interface MatrixContextType {
  margin: { top: number; left: number; right: number; bottom: number };
  width: number;
  height: number;
  size: number;
  cellSize: number;

  originScale: d3.ScaleBand<string>;
  destinationScale: d3.ScaleBand<string>;

  encoding: string | null;
  setEncoding: (value: string | null) => void;
  isSnr: boolean | null;
  setIsSnr: (value: boolean | null) => void;

  originHighlight: string | null;
  setOriginHighlight: (value: string | null) => void;
  destinationHighlight: string | null;
  setDestinationHighlight: (value: string | null) => void;

  answerNodes: string[];
  setAnswerNodes: (nodes: string[]) => void;

  actions?: Registry<string>;
  trrack?: Trrack<TrrackState, string>;
  setAnswer?: any;
}

const MatrixContext = createContext<MatrixContextType | undefined>(undefined);

export function MatrixProvider({ children, context }: { children: React.ReactNode; context: MatrixContextType }): React.ReactElement {
  const contextValue = useMemo(
    () => ({
      ...context,
    }),
    [context],
  );

  return <MatrixContext.Provider value={contextValue}>{children}</MatrixContext.Provider>;
}

export const useMatrixContext = () => {
  const context = useContext(MatrixContext);
  if (!context) {
    throw new Error('useMatrixContext must be used within a MatrixProvider');
  }
  return context;
};
