import {
  memo, useCallback, useEffect, useMemo, useState,
} from 'react';
import { Grid, Loader } from '@mantine/core';
import { initializeTrrack, Registry } from '@trrack/core';
import Summary from './Summary';
import { StimulusParams } from '../../store/types';
import { SumParams } from './types';
import Source from './Source';

const API_BASE_URL = import.meta.env.VITE_SUMSIFTER_API_URL;

function SummaryApp({ parameters, setAnswer }: StimulusParams<SumParams>) {
  const [activeSourceId, setActiveSourceId] = useState<string | null>(null);

  const [summaryData, setSummaryData] = useState<{ id: string; text: string; sources: string[] }[]>([]);

  const [sourcesData, setSourcesData] = useState<{ id: string; text: string }[]>([]);

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [summaryBadgeTop, setSummaryBadgeTop] = useState(0);
  const [sourceBadgeTop, setSourceBadgeTop] = useState(0);
  const [sourceBadgeLeft, setSourceBadgeLeft] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [queryText, setQueryText] = useState('');

  const { prompt: defaultPrompt, document: studyDocument } = parameters;

  const { actions, trrack } = useMemo(() => {
    const reg = Registry.create();

    const mouseHoverAction = reg.register('mouseHover', (state, mouseEnter: { summaryId: string | null, sourceId: string | null }) => {
      state.activeSummaryId = mouseEnter.summaryId;
      state.activeSourceId = mouseEnter.sourceId;
      return state;
    });

    const trrackInst = initializeTrrack({
      registry: reg,
      initialState: {
        activeSummaryId: null, activeSourceId: null,
      },
    });

    return {
      actions: {
        mouseHoverAction,
      },
      trrack: trrackInst,
    };
  }, []);

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      const response = await fetch(`${API_BASE_URL}/summaries/generate/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversationId: null,
          documentId: studyDocument,
          promptType: 'general',
          prompt: defaultPrompt,
        }),
      });
      const data = await response.json();

      setConversationId(data.conversationId);

      const summary = data.summary.map((sentenceObj: { text: string, sources: string[] }, idx: number) => ({
        id: String(idx),
        text: sentenceObj.text,
        sources: sentenceObj.sources,
      }));

      const source = data.source.map((sourceObj: { id: string, text: string }) => ({
        id: sourceObj.id,
        text: sourceObj.text,
      }));

      setSummaryData(summary);
      setSourcesData(source);
      setIsLoading(false);
    }

    fetchData();
  }, [defaultPrompt, studyDocument]);

  const handleSourceClick = (summaryId: string | null, sourceId: string | null) => {
    trrack.apply('Clicked', actions.mouseHoverAction({ summaryId, sourceId }));

    setAnswer({
      status: true,
      provenanceGraph: trrack.graph.backend,
      answers: {},
    });

    setActiveSourceId(sourceId);
  };

  const handleSummaryBadgePositionChange = (top: number) => {
    setSummaryBadgeTop(top);
  };

  const handleSourceBadgePositionChange = (left: number, top: number) => {
    setSourceBadgeTop(top);
    setSourceBadgeLeft(left);
  };

  const handleSubmitQuery = useCallback((queryPrompt: string) => {
    async function fetchData() {
      setIsLoading(true);
      const response = await fetch(`${API_BASE_URL}/summaries/generate/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversationId,
          documentId: studyDocument,
          promptType: 'general',
          prompt: queryPrompt,
        }),
      });
      const data = await response.json();

      const summary = data.summary.map((sentenceObj: { text: string, sources: string[] }, idx: number) => ({
        id: String(idx),
        text: sentenceObj.text,
        sources: sentenceObj.sources,
      }));

      const source = data.source.map((sourceObj: { id: string, text: string }) => ({
        id: sourceObj.id,
        text: sourceObj.text,
      }));

      setSummaryData(summary);
      setSourcesData(source);
      setIsLoading(false);
    }

    fetchData();
  }, [studyDocument, conversationId]);

  const handleAddToSummary = useCallback((sourceText: string, sourcePrompt: string) => {
    async function fetchData() {
      setIsLoading(true);
      const response = await fetch(`${API_BASE_URL}/summaries/generate/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversationId,
          documentId: studyDocument,
          promptType: 'source',
          sourceTargetText: sourceText,
          prompt: sourcePrompt,
        }),
      });
      const data = await response.json();

      const summary = data.summary.map((sentenceObj: { text: string, sources: string[] }, idx: number) => ({
        id: String(idx),
        text: sentenceObj.text,
        sources: sentenceObj.sources,
      }));

      const source = data.source.map((sourceObj: { id: string, text: string }) => ({
        id: sourceObj.id,
        text: sourceObj.text,
      }));

      setSummaryData(summary);
      setSourcesData(source);
      setIsLoading(false);
    }

    fetchData();
  }, [conversationId, studyDocument]);

  return (
    <>
      {isLoading && (
        <div style={{
          position: 'fixed',
          top: '0',
          left: '0',
          // transform: 'translate(-50%, -50%)',
          zIndex: 1000,
          height: '100vh',
          width: '100vw',
          background: 'rgba(255, 255, 255, 0.9)',
        }}
        >
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            fontSize: '24px',
            fontWeight: 'bold',
            textAlign: 'center',
          }}
          >
            <Loader color="blue" />
            <div>
              Please wait while we summarize the document...
            </div>
          </div>
        </div>
      )}
      <Grid gutter={50}>
        <Grid.Col span={6} pos="relative">
          <Summary sentences={summaryData} onSummaryBadgePositionChange={handleSummaryBadgePositionChange} onSourceClick={handleSourceClick} activeSourceId={activeSourceId} onSubmitQuery={handleSubmitQuery} queryText={queryText} onQueryTextChange={setQueryText} />
        </Grid.Col>
        <Grid.Col span={6}>
          <Source sourceList={sourcesData} onSourceBadgePositionChange={handleSourceBadgePositionChange} activeSourceId={activeSourceId} onAddToSummary={handleAddToSummary} />
        </Grid.Col>
      </Grid>
      {activeSourceId && (
        <div style={{
          position: 'fixed',
          top: (summaryBadgeTop > sourceBadgeTop ? sourceBadgeTop : summaryBadgeTop) + 18,
          left: sourceBadgeLeft - 10,
          width: 2,
          height: Math.abs(summaryBadgeTop - sourceBadgeTop) - (summaryBadgeTop > sourceBadgeTop ? -2 : 2),
          backgroundColor: 'var(--mantine-color-blue-5)',
        }}
        />
      )}
    </>
  );
}

export default memo(SummaryApp);
