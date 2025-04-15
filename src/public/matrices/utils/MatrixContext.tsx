/*  eslint-disable @typescript-eslint/no-explicit-any */

import React, { createContext, useContext, useMemo } from 'react';
import * as d3 from 'd3';
import { Trrack } from '@trrack/core';
import { link, TrrackState } from './Interfaces';

interface MatrixContextType {
  data: link[];
  margin: { top: number; left: number; right: number; bottom: number };
  width: number;
  height: number;
  size: number;
  cellSize: number;

  nMeans: number;
  nDevs: number;

  colorScale: string;

  meanMin: number;
  meanMax: number;
  devMin: number;
  devMax: number;

  originScale: d3.ScaleBand<string>;
  destinationScale: d3.ScaleBand<string>;

  encoding: string;
  setEncoding: (value: string) => void;
  isSnr: boolean;
  setIsSnr: (value: boolean) => void;

  originHighlight: string | null;
  setOriginHighlight: (value: string | null) => void;
  destinationHighlight: string | null;
  setDestinationHighlight: (value: string | null) => void;

  orderedOrigins: string[] | null;
  setOrderedOrigins: (value: string[] | null) => void;
  orderedDestinations: string[] | null;
  setOrderedDestinations: (value: string[] | null) => void;

  meanScale: d3.ScaleQuantize<string | number, never>;
  devScale: d3.ScaleQuantize<string | number, never>;

  orderNode: string | null;
  setOrderNode: (value: string | null) => void;

  answerNodes: string[];
  setAnswerNodes: (nodes: string[]) => void;

  actions?: any;
  trrack?: Trrack<TrrackState, string>;
  setAnswer?: any;
}

const MatrixContext = createContext<MatrixContextType | undefined>(undefined);

export function MatrixProvider({
  children,
  context,
}: {
  children: React.ReactNode;
  context: MatrixContextType;
}): React.ReactElement {
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
