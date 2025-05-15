import React, { createContext, useContext } from 'react';
import * as d3 from 'd3';
import { Trrack } from '@trrack/core';
import { ConfigProps, Link, TrrackState } from './Interfaces';

interface MatrixContextType {
  data: Link[];

  width: number;
  height: number;
  size: number;
  cellSize: number;
  margin: { top: number; left: number; right: number; bottom: number };

  originScale: d3.ScaleBand<string>;
  destinationScale: d3.ScaleBand<string>;
  meanScale: d3.ScaleQuantize<string | number, never>;
  devScale: d3.ScaleQuantize<string | number, never>;

  configProps: ConfigProps;

  originHighlight: string | null;
  destinationHighlight: string | null;

  orderedOrigins: string[] | null;
  orderedDestinations: string[] | null;

  orderingNode: string | null;
  answerNodes: string[];

  linkMarks: string[][];

  setOriginHighlight: (value: string | null) => void;
  setDestinationHighlight: (value: string | null) => void;
  setOrderedOrigins: (value: string[] | null) => void;
  setOrderedDestinations: (value: string[] | null) => void;
  setLinkMarks: (value: string[][]) => void;
  setOrderingNode: (value: string | null) => void;
  setAnswerNodes: (nodes: string[]) => void;

  cellRenderer: (
    gCells: d3.Selection<SVGGElement, Link, SVGGElement | null, unknown>,
    showMean?: boolean,
    showDev?: boolean
  ) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  actions?: any;
  trrack?: Trrack<TrrackState, string>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
