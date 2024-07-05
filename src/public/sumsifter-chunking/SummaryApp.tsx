import {
  memo, useEffect, useMemo, useState,
} from 'react';
import { Box, Grid, NavLink } from '@mantine/core';
import { Worker, Viewer } from '@react-pdf-viewer/core';
import { initializeTrrack, Registry } from '@trrack/core';
import { StimulusParams } from '../../store/types';
import { SumParams } from './types';
import { PREFIX } from '../../utils/Prefix';
import { useNextStep } from '../../store/hooks/useNextStep';
import styles from './sumsifter.module.css';

import '@react-pdf-viewer/core/lib/styles/index.css';

const myText = `Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Blandit aliquam etiam erat velit scelerisque. 

A diam maecenas sed enim ut sem viverra. Velit euismod in pellentesque massa. Quis blandit turpis cursus in hac habitasse. Leo integer malesuada nunc vel risus commodo. In nulla posuere sollicitudin aliquam ultrices sagittis. Facilisis leo vel fringilla est. Aliquam sem fringilla ut morbi tincidunt. Facilisi cras fermentum odio eu feugiat pretium. Pulvinar neque laoreet suspendisse interdum consectetur libero id. Pellentesque sit amet porttitor eget dolor. Mattis aliquam faucibus purus in massa. Non consectetur a erat nam at. Nullam non nisi est sit amet facilisis magna. Adipiscing enim eu turpis egestas pretium aenean pharetra magna ac. Condimentum vitae sapien pellentesque habitant morbi tristique senectus.
`;

function Word({
  text, wordIdx, isActive, onClick,
}: { text: string, wordIdx: number, isActive: boolean, onClick: (idx: number) => void }) {
  const handleClick = () => {
    onClick(wordIdx);
  };

  return (
    <span className={`${styles.splitWord} ${isActive && styles.splitWordActive}`}>
      <span onClick={handleClick}>{text}</span>
      <span className={styles.splitter} onClick={handleClick}> </span>
    </span>
  );
}

function WordSplit({ text, onWordClick, chunkBreaks }: { text: string, chunkBreaks: { [n: number]: boolean }, onWordClick: (idx: number) => void }) {
  return (
    <div>
      {text.split(' ').map((word, index) => (
        <Word key={index} wordIdx={index} text={word} onClick={onWordClick} isActive={chunkBreaks[index]} />
      ))}
    </div>
  );
}

function SummaryApp({ parameters: tempParameters, setAnswer }: StimulusParams<SumParams>) {
  const [docIndex, setDocIndex] = useState(0);
  const { goToNextStep } = useNextStep();
  const [chunkBreaks, setChunkBreaks] = useState<{ [id: number]: boolean }>({});

  // temporary fix for parameters updating on every setAnswer call
  const [parameters] = useState(tempParameters);

  const { actions, trrack } = useMemo(() => {
    const reg = Registry.create();

    const documentClickAction = reg.register('click', (state, document: { documentIdx: number, documentPath: string }) => {
      state.documentIdx = document.documentIdx;
      state.documentPath = document.documentPath;
      return state;
    });

    const trrackInst = initializeTrrack({
      registry: reg,
      initialState: {
        documentIdx: 0, documentPath: parameters.documents[0],
      },
    });

    return {
      actions: {
        documentClickAction,
      },
      trrack: trrackInst,
    };
  }, [parameters]);

  useEffect(() => {
    if (parameters.documents.length) {
      setDocIndex(0);
    }
  }, [parameters]);

  const handleWordClick = (idx: number) => {
    const newChunkBreaks = { ...chunkBreaks };
    newChunkBreaks[idx] = !newChunkBreaks[idx];
    setChunkBreaks(newChunkBreaks);
  };

  // TODO: Move this to onClick event.
  const chunkOutput = useMemo(() => {
    if (Object.keys(chunkBreaks).length) {
      const chunkedText = myText.split(' ');
      const chunks = Object.keys(chunkBreaks).reduce<number[]>((acc, curr: string) => {
        const c = +curr;
        if (chunkBreaks[c]) {
          acc.push(c);
        }
        return acc;
      }, []);

      // slice
      let start = 0;
      let end = 0;
      const chunked = chunks.reduce<string[][]>((acc, curr) => {
        end = curr + 1;
        acc.push(chunkedText.slice(start, end));
        start = curr + 1;
        return acc;
      }, []);
      chunked.push(chunkedText.slice(start));
      return chunked;
    }
    return [myText.split(' ')];
  }, [chunkBreaks]);

  return (
    <Box pos="relative">
      <Grid gutter={50}>
        <Grid.Col span={2}>
          <div style={{ position: 'sticky', top: 100 }}>
            {parameters.documents.map((doc, index) => (
              <NavLink
                key={index}
                onClick={() => {
                  setDocIndex(index);
                  trrack.apply('Clicked', actions.documentClickAction({ documentIdx: index, documentPath: doc }));
                  setAnswer({
                    status: true,
                    provenanceGraph: trrack.graph.backend,
                    answers: {},
                  });
                }}
                label={`Doc ${index + 1}`}
                active={index === docIndex}
              />
            ))}
          </div>
        </Grid.Col>
        <Grid.Col span={8}>
          <div>
            <h2>Sample Text as Input</h2>
            <WordSplit text={myText} chunkBreaks={chunkBreaks} onWordClick={handleWordClick} />
          </div>
          <div>
            <h2>Output</h2>
            <div>
              {chunkOutput?.map((chunk, index) => (
                <div key={index}>
                  <h4>
                    Chunk
                    {' '}
                    {index + 1}
                  </h4>
                  <div>
                    {chunk.join(' ')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Grid.Col>
      </Grid>
    </Box>
  );
}

export default memo(SummaryApp);
