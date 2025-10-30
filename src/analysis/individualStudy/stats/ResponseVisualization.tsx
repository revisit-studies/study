import {
  Box,
  Code,
  Collapse, Divider, Flex, Paper, ScrollArea, SimpleGrid, Text, Title,
} from '@mantine/core';
import { useDisclosure, useResizeObserver } from '@mantine/hooks';
import {
  IconAdjustmentsHorizontal, IconBubbleText, IconChartGridDots, IconChevronDown, IconCodePlus, IconCopyCheck, IconDots, IconGridDots, IconHtml, IconLetterCase, IconDragDrop, IconNumber123, IconRadio, IconSelect, IconSquares,
} from '@tabler/icons-react';
import { useMemo } from 'react';
import { VegaLite, VisualizationSpec } from 'react-vega';
import { IndividualComponent, ParticipantData, Response } from '../../../parser/types';
import { responseAnswerIsCorrect } from '../../../utils/correctAnswer';

export function ResponseVisualization({
  response, participantData, trialId, trialConfig,
}: {
  response: Response | { id: 'Config and Timing', type: 'metadata' };
  participantData: ParticipantData[];
  trialId: string;
  trialConfig: IndividualComponent;
}) {
  const [opened, { toggle }] = useDisclosure(true);
  const [ref, dms] = useResizeObserver();

  const correctAnswer = useMemo(() => {
    if (response.type === 'metadata') {
      return undefined;
    }

    const found = trialConfig.correctAnswer?.find((a) => a.id === response.id);
    return found;
  }, [response.id, response.type, trialConfig.correctAnswer]);

  const questionData = useMemo(() => {
    if (response.type === 'metadata') {
      return [];
    }

    const data = participantData.map((p) => Object.entries(p.answers).filter(([key]) => key.slice(0, key.lastIndexOf('_')) === trialId)).map((p) => p.filter(([, value]) => value.startTime > 0).map(([, value]) => {
      const answerData = { ...value.answer };

      if (correctAnswer) {
        const participantAnswer = value.answer[response.id];
        const expectedAnswer = correctAnswer.answer;

        answerData.result = responseAnswerIsCorrect(participantAnswer, expectedAnswer) ? 'correct' : 'incorrect';
      }

      return answerData;
    })).flat();
    return data;
  }, [participantData, response.type, trialId, correctAnswer, response.id]);

  // eslint-disable-next-line consistent-return
  const vegaLiteSpec = useMemo(() => {
    const baseSpec = {
      height: 'container',
      width: 'container',
    };

    if (response.type === 'shortText' || response.type === 'longText') {
      return {};
    }

    // Timing visualization for metadata block
    if (response.type === 'metadata') {
      const timingData = participantData
        .map((p) => Object.entries(p.answers).filter(([key]) => key.slice(0, key.lastIndexOf('_')) === trialId))
        .map((p) => p.filter(([_, value]) => value.endTime !== -1).map(([_, value]) => (value.endTime - value.startTime) / 1000))
        .flat();

      // Histogram of completion times
      const spec = {
        ...baseSpec,
        data: { values: timingData },
        mark: 'bar',
        encoding: {
          x: {
            field: 'data',
            bin: true,
            type: 'quantitative',
            title: 'Time (s)',
          },
          y: { aggregate: 'count', type: 'quantitative', title: 'Count' },
        },
      };

      return spec;
    }

    const correctAnswerSpec = {
      params: [
        { name: 'correctAnswer', value: correctAnswer?.answer },
        { name: 'variable', value: response.id },
      ],
      transform: [
        { calculate: "datum[variable] === correctAnswer ? 'correct' : 'incorrect'", as: 'result' },
        {
          calculate: "if(datum.result === 'correct', 0, if(datum.result === 'incorrect', 1, 2))",
          as: 'order',
        },
      ],
      color: {
        field: 'result',
        type: 'nominal',
        scale: { domain: ['correct', 'incorrect'], range: ['#69DB7C', '#ADB5BD'] },
      },
      order: { field: 'order' },
    };

    // Matrix visualization
    if (response.type === 'matrix-radio' || response.type === 'matrix-checkbox') {
      const data = questionData
        .map((row) => Object.entries(row[response.id] || {}).map(([question, value]) => (response.type === 'matrix-checkbox'
          ? (value as string).split('|').map((option) => ({ question, value: option }))
          : [{ question, value }])).flat()).flat();

      // Histogram
      const spec = {
        ...baseSpec,
        data: { values: data },
        mark: 'bar',
        params: correctAnswer !== undefined ? correctAnswerSpec.params : undefined,
        transform: Array.isArray(correctAnswer?.answer) ? undefined : (correctAnswer !== undefined ? correctAnswerSpec.transform : undefined),
        encoding: {
          row: { field: 'question', type: 'nominal', header: { title: 'Question' } },
          x: { field: 'value', type: 'ordinal', title: 'Answer' },
          y: { aggregate: 'count', type: 'quantitative', title: 'Count' },
          color: correctAnswer !== undefined ? correctAnswerSpec.color : undefined,
        },
        order: correctAnswer !== undefined ? correctAnswerSpec.order : undefined,
        resolve: { scale: { x: 'independent' } },
      };
      return spec;
    }

    // Numerical visualization
    if (response.type === 'numerical' || response.type === 'slider' || response.type === 'likert') {
      let min: number | undefined;
      let max: number | undefined;

      if (response.type === 'numerical') {
        // eslint-disable-next-line prefer-destructuring
        min = response.min;
        // eslint-disable-next-line prefer-destructuring
        max = response.max;
      }

      if (response.type === 'slider') {
        min = Math.min(...response.options.map((o) => o.value));
        max = Math.max(...response.options.map((o) => o.value));
      }

      if (response.type === 'likert') {
        min = 1;
        max = response.numItems;
      }

      // Histogram
      const spec = {
        ...baseSpec,
        data: { values: questionData },
        mark: 'bar',
        params: correctAnswer !== undefined ? correctAnswerSpec.params : undefined,
        transform: [
          {
            bin: response.type === 'likert' ? { step: 1 } : { maxbins: 10 },
            field: response.id,
            as: 'bins',
          },
          ...(correctAnswer !== undefined ? correctAnswerSpec.transform : []),
        ],
        encoding: {
          x: {
            field: 'bins',
            scale: min !== undefined && max !== undefined ? { domain: [min, max] } : undefined,
            type: 'quantitative',
            title: 'Answer',
          },
          x2: { field: 'bins_end' },
          y: {
            aggregate: 'count', type: 'quantitative', title: 'Count', stack: true,
          },
          color: correctAnswer !== undefined ? correctAnswerSpec.color : undefined,
          order: correctAnswer !== undefined ? correctAnswerSpec.order : undefined,
        },
      };
      return spec;
    }

    // Categorical visualization
    if (response.type === 'radio' || response.type === 'dropdown' || response.type === 'checkbox' || response.type === 'buttons' || response.type === 'ranking-sublist' || response.type === 'ranking-categorical' || response.type === 'ranking-pairwise') {
      const spec = {
        ...baseSpec,
        data: { values: questionData },
        mark: 'bar',
        params: correctAnswer !== undefined ? correctAnswerSpec.params : undefined,
        transform: Array.isArray(correctAnswer?.answer) ? undefined : (correctAnswer !== undefined ? correctAnswerSpec.transform : undefined),
        encoding: {
          x: { field: response.id, type: 'ordinal', title: 'Answer' },
          y: { aggregate: 'count', type: 'quantitative', title: 'Count' },
          color: correctAnswer !== undefined ? correctAnswerSpec.color : undefined,
        },
      };
      return spec;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps, @typescript-eslint/no-explicit-any
  }, [participantData, questionData, response.id, (response as any).max, (response as any).min, (response as any).numItems, (response as any).options, response.type, trialId, correctAnswer]);

  return (
    <Paper p="lg" withBorder ref={ref}>
      <Flex direction="row" justify="space-between" onClick={toggle}>
        <Flex align="center">
          {response.type === 'metadata' && <IconCodePlus size={20} />}
          {response.type === 'numerical' && <IconNumber123 size={20} />}
          {(response.type === 'shortText' || response.type === 'longText') && <IconBubbleText size={20} />}
          {response.type === 'likert' && <IconDots size={20} />}
          {response.type === 'dropdown' && <IconSelect size={20} />}
          {response.type === 'slider' && <IconAdjustmentsHorizontal size={20} />}
          {response.type === 'radio' && <IconRadio size={20} />}
          {response.type === 'checkbox' && <IconSquares size={20} />}
          {(response.type === 'ranking-sublist' || response.type === 'ranking-categorical' || response.type === 'ranking-pairwise') && <IconDragDrop size={20} />}
          {response.type === 'matrix-radio' && <IconGridDots size={20} />}
          {response.type === 'matrix-checkbox' && <IconChartGridDots size={20} />}
          {response.type === 'buttons' && <IconCopyCheck size={20} />}
          {response.type === 'reactive' && <IconHtml size={20} />}
          {response.type === 'textOnly' && <IconLetterCase size={20} />}
          <Title order={5} ml={4}>
            {response.id}
          </Title>
        </Flex>

        <IconChevronDown style={{ rotate: opened ? '180deg' : 'none', transition: 'rotate 200ms' }} />
      </Flex>

      <Collapse in={opened} mah={400}>
        <Box
          style={{
            top: 0, position: 'sticky', backgroundColor: 'white', zIndex: 2,
          }}
          py="md"
        >
          <Divider />
        </Box>

        <SimpleGrid cols={2} h={360}>
          <ScrollArea mih={200}>
            {(response.type !== 'metadata' && response.type !== 'shortText' && response.type !== 'longText' && response.type !== 'reactive' && response.type !== 'textOnly' && response.type !== 'ranking-sublist' && response.type !== 'ranking-categorical' && response.type !== 'ranking-pairwise') ? (
              <VegaLite
                spec={vegaLiteSpec as VisualizationSpec}
                actions={false}
                height={270}
                width={(response.type === 'matrix-checkbox' || response.type === 'matrix-radio' ? 500 : (dms.width / 2) - 60 - (correctAnswer === undefined ? 0 : 60))}
                padding={0}
                style={{ justifySelf: 'center' }}
                renderer="svg"
              />
            ) : (
              <Flex direction="column" gap="xs" style={{ overflowX: 'clip' }}>
                {response.type === 'metadata' ? (
                  <Code block>{`${JSON.stringify(trialConfig, null, 2)}`}</Code>
                ) : (
                  <>
                    <Text fw={700}>Response Values: </Text>
                    {(response.type === 'textOnly' || response.type === 'ranking-sublist' || response.type === 'ranking-categorical' || response.type === 'ranking-pairwise') ? (
                      <Text>N/A</Text>
                    ) : (
                      questionData.map((d, idx) => (
                        <Flex key={idx} align="center" gap="xs">
                          <Text>{d[response.id] as unknown as string}</Text>
                        </Flex>
                      ))
                    )}
                  </>
                )}
              </Flex>
            )}
          </ScrollArea>

          <ScrollArea mih={200}>
            {response.type === 'metadata'
              ? (
                <VegaLite
                  spec={vegaLiteSpec as VisualizationSpec}
                  actions={false}
                  width={(dms.width / 2) - 60}
                  height={270}
                  padding={0}
                  style={{ justifySelf: 'center' }}
                />
              )
              : (
                <>
                  <Text fw={700}>Response Specification: </Text>
                  <Code block>
                    {JSON.stringify(response, null, 2)}
                  </Code>
                  <br />
                  {correctAnswer && (
                  <>
                    <Text fw={700}>Correct Answer: </Text>
                    <Code block>
                      {JSON.stringify(correctAnswer, null, 2)}
                    </Code>
                  </>
                  )}
                </>
              )}

          </ScrollArea>
        </SimpleGrid>
      </Collapse>
    </Paper>
  );
}
