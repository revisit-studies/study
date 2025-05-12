/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { createContext, useContext } from 'react';
import * as d3 from 'd3';
import { Trrack } from '@trrack/core';
import { ConfigProps, Link, TrrackState } from './Interfaces';

interface MatrixContextType {
  // Data and dimensions
  data: Link[];
  width: number;
  height: number;
  size: number;
  cellSize: number;
  margin: { top: number; left: number; right: number; bottom: number };

  // Scales and axes
  originScale: d3.ScaleBand<string>;
  destinationScale: d3.ScaleBand<string>;
  meanScale: d3.ScaleQuantize<string | number, never>;
  devScale: d3.ScaleQuantize<string | number, never>;

  configProps: ConfigProps;

  // State management
  originHighlight: string | null;
  destinationHighlight: string | null;
  orderedOrigins: string[] | null;
  orderedDestinations: string[] | null;
  linkMarks: string[][] | null;
  orderingNode: string | null;
  answerNodes: string[];

  // Setters
  setOriginHighlight: (value: string | null) => void;
  setDestinationHighlight: (value: string | null) => void;
  setOrderedOrigins: (value: string[] | null) => void;
  setOrderedDestinations: (value: string[] | null) => void;
  setLinkMarks: (value: string[][] | null) => void;
  setOrderingNode: (value: string | null) => void;
  setAnswerNodes: (nodes: string[]) => void;

  // Utility functions
  cellRenderer: (
    gCells: d3.Selection<SVGGElement, Link, SVGGElement | null, unknown>,
    showMean?: boolean,
    showDev?: boolean
  ) => void;

  // Provenance
  actions?: any;
  trrack?: Trrack<TrrackState, string>;
  setAnswer?: any;
}

const MatrixContext = createContext<MatrixContextType | null>(null);

export function MatrixProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: MatrixContextType;
}) {
  return <MatrixContext.Provider value={value}>{children}</MatrixContext.Provider>;
}

export const useMatrixContext = () => {
  const context = useContext(MatrixContext);
  if (!context) {
    throw new Error('useMatrixContext must be used within a MatrixProvider');
  }
  return context;
};
