import {
  getActions, initializeProvenanceTracking, process, Upset,
} from '@visdesignlab/upset2-react';
import {
  ColumnTypes, populateConfigDefaults, TableRow, UpsetConfig,
} from '@visdesignlab/upset2-core';
import { useEffect, useMemo } from 'react';
import { StimulusParams, TrrackedProvenance } from '../../../store/types';
import { useIsAnalysis } from '../../../store/hooks/useIsAnalysis';
import movies from './movies.json' with { type: 'json' };

const movieColumns = Object.fromEntries(
  Object.entries(movies[0]).map(([key, value]) => {
    if (typeof value === 'string') return [key, 'label'];
    return [key, typeof value];
  }),
) as ColumnTypes;

export default function App({
  provenanceState,
  setAnswer,
}: StimulusParams<Record<string, never>, UpsetConfig>) {
  const isAnalysis = useIsAnalysis();
  const processedMovies = useMemo(() => {
    const movieRows = movies.map((movie) => ({
      ...movie,
      _key: movie.id,
      _id: movie.id,
      _rev: '',
    })) as unknown as TableRow[];
    return process(movieRows, movieColumns);
  }, []);
  const initialConfig = useMemo(
    () => populateConfigDefaults({}, processedMovies, false),
    [processedMovies],
  );
  const provenance = useMemo(
    () => initializeProvenanceTracking(provenanceState ?? initialConfig),
    [initialConfig, provenanceState],
  );
  const extProvenance = useMemo(() => ({
    provenance,
    actions: getActions(provenance),
  }), [provenance]);

  useEffect(() => {
    if (isAnalysis) {
      return undefined;
    }

    const reportProvenance = () => {
      setAnswer({
        status: true,
        answers: {},
        provenanceGraph: provenance.graph.backend as TrrackedProvenance,
      });
    };
    const unsubscribe = provenance.currentChange(reportProvenance);
    reportProvenance();
    return () => {
      unsubscribe();
    };
  }, [isAnalysis, provenance, setAnswer]);

  return (
    <div inert={(isAnalysis ? '' : undefined) as never}>
      <Upset
        data={processedMovies}
        extProvenance={extProvenance}
        parentHasHeight
      />
    </div>
  );
}
