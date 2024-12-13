import {
  useCallback, useEffect, useMemo, useState,
} from 'react';
import { Vega, VisualizationSpec } from 'react-vega';
import { VegaComponent } from '../parser/types';
import { getJsonAssetByPath } from '../utils/getStaticAsset';
import ResourceNotFound from '../ResourceNotFound';
import { useStoreActions, useStoreDispatch } from '../store/store';
import { StimulusParams } from '../store/types';
import { useCurrentComponent, useCurrentStep } from '../routes/utils';

function VegaController({ currentConfig }: { currentConfig: VegaComponent }) {
  const currentStep = useCurrentStep();
  const currentComponent = useCurrentComponent();
  const storeDispatch = useStoreDispatch();

  const [loading, setLoading] = useState(true);

  const { updateResponseBlockValidation, setIframeAnswers } = useStoreActions();

  const setAnswer = useCallback(({
    status,
    provenanceGraph,
    answers,
  }: Parameters<StimulusParams<unknown>['setAnswer']>[0]) => {
    storeDispatch(
      updateResponseBlockValidation({
        location: 'sidebar',
        identifier: `${currentComponent}_${currentStep}`,
        status,
        values: answers,
        provenanceGraph,
      }),
    );

    storeDispatch(setIframeAnswers(answers));
  }, [currentComponent, currentStep, storeDispatch, setIframeAnswers, updateResponseBlockValidation]);

  const handleRevisitAnswer = useCallback((key: string, value: unknown) => {
    const { responseId, response } = value as {responseId: string, response: unknown};
    setAnswer({
      status: true,
      provenanceGraph: undefined,
      answers: {
        [responseId]: response,
      },
    });
  }, [setAnswer]);

  const signalListeners = useMemo(
    () => ({ revisitAnswer: handleRevisitAnswer }),
    [handleRevisitAnswer],
  );

  const [vegaConfig, setVegaConfig] = useState<VisualizationSpec | null>(null);

  useEffect(() => {
    async function fetchVega() {
      setLoading(true);
      const asset = await getJsonAssetByPath(currentConfig.path);
      if (asset !== undefined) {
        setVegaConfig(asset);
      }
      setLoading(false);
    }

    fetchVega();
  }, [currentConfig]);

  if (loading) {
    return <div>Loading...</div>;
  }
  if (!vegaConfig) {
    return <ResourceNotFound path={currentConfig.path} />;
  }

  return (<Vega spec={vegaConfig} signalListeners={signalListeners} />);
}

export default VegaController;
