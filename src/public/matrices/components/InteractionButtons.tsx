/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  Button, Group, Radio, RangeSlider, Stack, Text,
} from '@mantine/core';
import { useEffect, useState } from 'react';
import { UserAction } from '../utils/Enums';
import { useMatrixContext } from '../utils/MatrixContext';
import { clusterMark } from '../utils/Interfaces';

function ClearAndResetButtons() {
  const {
    config, setAnswerNodes, trrack, actions, setAnswer,
  } = useMatrixContext();

  return (
    <>
      <Button
        onClick={() => {
          setAnswerNodes([]);
          trrack?.apply('Set Answer', actions?.setAnswerNodes([]));
          setAnswer({
            status: true,
            provenanceGraph: trrack?.graph.backend,
            answers: { answerNodes: [] },
          });
        }}
      >
        {UserAction.clearNodeSelection}
      </Button>

      {/* {!config.isClusterTask && (
        <Button
          onClick={() => {
            setOrderingNode(null);
            setOrderedDestinations(orderedOrigins);
          }}
        >
          {UserAction.resetOrdering}
        </Button>
      )} */}
    </>
  );
}

function ClusterSelection() {
  const [cluster, setCluster] = useState('');
  const { config, setAnswer, trrack } = useMatrixContext();

  useEffect(() => {
    setAnswer({
      status: true,
      provenanceGraph: trrack?.graph.backend,
      answers: { cluster },
    });
  }, [cluster, setAnswer, trrack]);

  return (
    <Radio.Group
      value={cluster}
      onChange={setCluster}
      name="clusterSelection"
      label="Select your answer:"
      description="Select the cluster that fits the specified criteria"
      withAsterisk
    >
      <Group mt="s">
        {config.clusterMarks?.map((cm: clusterMark) => (
          <Radio key={cm.option} value={cm.option} label={cm.option} />
        ))}
      </Group>
    </Radio.Group>
  );
}

function PathSelection() {
  const [path, setPath] = useState('');
  const [range, setRange] = useState<[number, number]>();

  const {
    setLinkMarks, setAnswer, trrack, config,
  } = useMatrixContext();

  useEffect(() => {
    setAnswer({
      status: true,
      provenanceGraph: trrack?.graph.backend,
      answers: { range, path },
    });
  }, [path, range, setAnswer, trrack]);

  return (
    <Stack gap="5vh">
      {/*  <Radio.Group
        value={path}
        onChange={setPath}
        name="pathSelection"
        label="Select your answer:"
        description="Select the path that fits the specified criteria"
        withAsterisk
      >
        <Stack>
          {config.paths.map((pathOption: any) => (
            <Radio key={pathOption.option} value={pathOption.option} label={pathOption.path} />
          ))}
        </Stack>
      </Radio.Group>

      <Text>Select the price range:</Text>
      <RangeSlider labelAlwaysOn onChange={setRange} value={range} min={0} max={500} /> */}

      <Button
        onClick={() => {
          setLinkMarks([]);
        }}
      >
        {UserAction.clearLinkSelection}
      </Button>
    </Stack>
  );
}

function RangeSelection() {
  const [range, setRange] = useState<[number, number]>();

  const { setAnswer, trrack } = useMatrixContext();

  useEffect(() => {
    setAnswer({
      status: true,
      provenanceGraph: trrack?.graph.backend,
      answers: { range },
    });
  }, [range, setAnswer, trrack]);

  return (
    <Stack gap="5vh">
      <Text>Select the price range:</Text>
      <RangeSlider labelAlwaysOn onChange={setRange} value={range} min={0} max={500} />
    </Stack>
  );
}

export function InteractionButtons() {
  const { config } = useMatrixContext();

  return (
    <Stack>
      {/* {config.isClusterTask && <ClusterSelection />} */}
      <PathSelection />
      {/* {config.isRangeTask && <RangeSelection />} */}
      <ClearAndResetButtons />
    </Stack>
  );
}
