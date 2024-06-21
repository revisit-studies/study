import { useEffect, useMemo, useState } from 'react';
import { Grid, NavLink } from '@mantine/core';
import { Worker, Viewer } from '@react-pdf-viewer/core';
import { initializeTrrack, Registry } from '@trrack/core';
import { StimulusParams } from '../../store/types';
import { SumParams } from './types';
import { PREFIX } from '../../utils/Prefix';

import '@react-pdf-viewer/core/lib/styles/index.css';

function SummaryApp({ parameters, setAnswer }: StimulusParams<SumParams>) {
  const [docIndex, setDocIndex] = useState(0);

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
    if (parameters.documents.length) {
      setDocIndex(0);
    }
  }, [parameters]);

  return (
    <Grid gutter={50}>
      <Grid.Col span={2}>
        <div style={{ position: 'sticky', top: 100 }}>
          {parameters.documents.map((doc, index) => (
            <NavLink key={index} onClick={() => setDocIndex(index)} label={`Doc ${index + 1}`} active={index === docIndex} />
          ))}

        </div>
      </Grid.Col>
      <Grid.Col span={8}>
        <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.4.120/build/pdf.worker.min.js">
          {parameters.documents.length > 0 && <Viewer fileUrl={`${PREFIX}${parameters.documents[docIndex]}`} />}
        </Worker>
      </Grid.Col>
    </Grid>
  );
}

export default SummaryApp;
