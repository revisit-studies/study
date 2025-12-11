import {
  useCallback, useEffect, useMemo, useState,
} from 'react';
import {
  Badge,
  Box,
  Code,
  Flex,
  HoverCard,
  NavLink,
  Text,
  Tooltip,
  Button,
} from '@mantine/core';
import {
  IconArrowsShuffle, IconBrain, IconCheck, IconChevronUp, IconDice3, IconDice5, IconInfoCircle,
  IconPackageImport,
  IconX,
} from '@tabler/icons-react';
import { useNavigate } from 'react-router';
import { ParticipantData, Response, StudyConfig } from '../../parser/types';
import { Sequence, StoredAnswer } from '../../store/types';
import { addPathToComponentBlock } from '../../utils/getSequenceFlatMap';
import { useStudyId } from '../../routes/utils';
import { encryptIndex } from '../../utils/encryptDecryptIndex';
import { isDynamicBlock } from '../../parser/utils';
import { componentAnswersAreCorrect } from '../../utils/correctAnswer';

function hasRandomization(responses: Response[]) {
  return responses.some((response) => {
    if (response.type === 'radio' || response.type === 'checkbox' || response.type === 'buttons') {
      return response.optionOrder === 'random';
    }
    if (response.type === 'matrix-radio' || response.type === 'matrix-checkbox') {
      return response.questionOrder === 'random';
    }
    return false;
  });
}

function findMatchingComponentInFullOrder(
  sequence: Sequence,
  fullOrder: Sequence,
): Sequence | null {
  let studySequence: Sequence | null = null;

  const findMatchingSequence = (node: string | Sequence) => {
    if (typeof node === 'string') {
      return;
    }
    if (node.id === sequence.id) {
      studySequence = node;
      return;
    }
    node.components.forEach((child) => {
      if (studySequence === null) {
        findMatchingSequence(child);
      }
    });
  };

  findMatchingSequence(fullOrder);
  return studySequence;
}

function countComponentsInSequence(sequence: Sequence, participantAnswers: ParticipantData['answers']) {
  let count = 0;

  // TODO: Handle dynamic blocks properly
  if (isDynamicBlock(sequence)) {
    return Object.entries(participantAnswers).filter(([key, _]) => key.startsWith(`${sequence.id}_`)).length;
  }

  sequence.components.forEach((component) => {
    if (typeof component === 'string') {
      count += 1;
    } else {
      count += countComponentsInSequence(component, participantAnswers);
    }
  });

  return count;
}

type StepItem = {
  label: string;
  indentLevel: number;

  // Component Attributes
  href?: string;
  isInterruption?: boolean;
  isLibraryImport?: boolean;
  component?: StudyConfig['components'][string];
  componentAnswer?: StoredAnswer;

  // Block Attributes
  order?: Sequence['order'];
  numInterruptions?: number;
  numComponentsInSequence?: number;
  numComponentsInStudySequence?: number;
};

export function StepsPanel({
  participantSequence,
  participantAnswers,
  studyConfig,
}: {
  participantSequence?: Sequence;
  participantAnswers: ParticipantData['answers'];
  studyConfig: StudyConfig;
}) {
  const INITIAL_CLAMP = 6;
  // Per-row clamp state, keyed by idx
  const [correctAnswerClampMap, setCorrectAnswerClampMap] = useState<Record<string, number | undefined>>({});
  const [responseClampMap, setResponseClampMap] = useState<Record<string, number | undefined>>({});
  const [fullFlatTree, setFullFlatTree] = useState<StepItem[]>([]);
  const [renderedFlatTree, setRenderedFlatTree] = useState<StepItem[]>([]);

  const studyId = useStudyId();
  const navigate = useNavigate();

  const fullOrder = useMemo(() => {
    let r = structuredClone(studyConfig.sequence) as Sequence;
    r = addPathToComponentBlock(r, 'root') as Sequence;
    r.components.push('end');
    return r;
  }, [studyConfig.sequence]);

  useEffect(() => {
    let newFlatTree: StepItem[] = [];
    if (participantSequence === undefined) {
      // Browse Components
      newFlatTree = Object.keys(studyConfig.components).map((key) => {
        const coOrComponents = key.includes('.co.')
          ? '.co.'
          : (key.includes('.components.') ? '.components.' : false);

        return {
          label: coOrComponents ? key.split(coOrComponents).at(-1)! : key,
          indentLevel: 0,
          href: `/${studyId}/reviewer-${key}`,
          isLibraryImport: coOrComponents !== false,
        };
      });
    } else {
      // Participant view

      // Indices to keep track of component positions, used for navigation hrefs
      let idx = 0;
      let dynamicIdx = 0;

      const traverse = (node: string | Sequence, indentLevel: number, parentNode: Sequence, dynamic = false) => {
        if (typeof node === 'string') {
          // Check to see if the component is from imported library
          const coOrComponents = node.includes('.co.')
            ? '.co.'
            : (node.includes('.components.') ? '.components.' : false);

          // Generate component identifier for participantAnswers lookup
          const componentIdentifier = dynamic ? `${parentNode.id}_${idx}_${node}_${dynamicIdx}` : `${node}_${idx}`;

          newFlatTree.push({
            label: coOrComponents ? node.split(coOrComponents).at(-1)! : node,
            indentLevel,
            isLibraryImport: coOrComponents !== false,

            // Component Attributes
            href: dynamic ? `/${studyId}/${encryptIndex(idx)}/${encryptIndex(dynamicIdx)}` : `/${studyId}/${encryptIndex(idx)}`,
            isInterruption: (parentNode.interruptions || []).flatMap((intr) => intr.components).includes(node),
            component: studyConfig.components[node],
            componentAnswer: participantAnswers[componentIdentifier],
          });

          if (dynamic) {
            dynamicIdx += 1;
          } else {
            idx += 1;
          }

          // Return, this is the recursive base case
          return;
        }

        const blockInterruptions = (node.interruptions || []).flatMap((intr) => intr.components);
        const matchingStudySequence = findMatchingComponentInFullOrder(node, fullOrder);

        // Push the block itself
        newFlatTree.push({
          label: node.id ?? node.order,
          indentLevel,

          // Block Attributes
          order: node.order,
          numInterruptions: node.components.filter((comp) => typeof comp === 'string' && blockInterruptions.includes(comp)).length,
          numComponentsInSequence: countComponentsInSequence(node, participantAnswers),
          numComponentsInStudySequence: countComponentsInSequence(matchingStudySequence || node, participantAnswers)!,
        });

        // Reset dynamicIdx when entering a new dynamic block
        if (node.order === 'dynamic') {
          dynamicIdx = 0;
        }

        // Loop through components, including any dynamic components added via participantAnswers
        const dynamicComponents = Object.entries(participantAnswers).filter(([key, _]) => key.startsWith(`${node.id}_${idx}`)).map(([_, value]) => value.componentName);
        const blockComponents = [...node.components, ...dynamicComponents];
        if (blockComponents.length > 0) {
          blockComponents.forEach((child) => {
            traverse(child, indentLevel + 1, node, node.order === 'dynamic');
          });
        }
      };

      traverse(participantSequence, 0, participantSequence);
    }

    // Map over tree and set correctAnswerClampMap and responseClampMap
    const clampMap = Object.fromEntries(newFlatTree.map((item) => {
      if (item.component) {
        return [item.href!, INITIAL_CLAMP];
      }
      return null;
    }).filter((item): item is [string, number] => item !== null));
    setCorrectAnswerClampMap(structuredClone(clampMap));
    setResponseClampMap(structuredClone(clampMap));

    // Set full and rendered flat tree
    setFullFlatTree(newFlatTree);
    setRenderedFlatTree(newFlatTree);
  }, [fullOrder, participantAnswers, participantSequence, studyConfig.components, studyId]);

  const collapseBlock = useCallback((startIndex: number, startItem: StepItem) => {
    const startIndentLevel = startItem.indentLevel;

    // Find the index of the next block at the same or less indent level so we can remove the sub-items
    let endIndex = renderedFlatTree.findIndex((item, idx) => idx > startIndex && item.indentLevel <= startIndentLevel);

    // If no next block, collapse to the end of the list
    if (endIndex === -1) {
      endIndex = renderedFlatTree.length;
    }

    // Create new array without the items between startIndex and endIndex
    const newFlatTree = [
      ...renderedFlatTree.slice(0, startIndex + 1),
      ...renderedFlatTree.slice(endIndex),
    ];
    setRenderedFlatTree(newFlatTree);
  }, [renderedFlatTree]);

  const expandBlock = useCallback((startIndex: number, startItem: StepItem) => {
    const startIndentLevel = startItem.indentLevel;

    const fullFlatStartIndex = fullFlatTree.findIndex((item) => item === startItem);

    // Find all items in fullFlatTree that are children of the block being expanded
    const itemsToInsert: StepItem[] = [];
    for (let i = fullFlatStartIndex + 1; i < fullFlatTree.length; i += 1) {
      const item = fullFlatTree[i];
      if (item.indentLevel <= startIndentLevel) {
        break;
      }
      itemsToInsert.push(item);
    }

    // Create new array with the items inserted after startIndex
    const newFlatTree = [
      ...renderedFlatTree.slice(0, startIndex + 1),
      ...itemsToInsert,
      ...renderedFlatTree.slice(startIndex + 1),
    ];
    setRenderedFlatTree(newFlatTree);
  }, [fullFlatTree, renderedFlatTree]);

  return renderedFlatTree.length > 0 && renderedFlatTree.map(({
    label,
    indentLevel,
    isLibraryImport,

    // Component Attributes
    href,
    isInterruption,
    component,
    componentAnswer,

    // Block Attributes
    order,
    numInterruptions,
    numComponentsInSequence,
    numComponentsInStudySequence,
  }, idx) => {
    const isComponent = order === undefined;

    // Determine correct answer from componentAnswer or component
    const correctAnswer = componentAnswer?.correctAnswer?.length
      ? componentAnswer.correctAnswer
      : component?.correctAnswer;

    // Check if the answer is correct
    const correct = correctAnswer
      && componentAnswer
      && Object.keys(componentAnswer.answer).length > 0
      && componentAnswersAreCorrect(componentAnswer.answer, correctAnswer);

    // Icon for correct/incorrect answer
    const correctIncorrectIcon = correctAnswer && componentAnswer && componentAnswer?.endTime > -1
      ? (correct
        ? <IconCheck size={16} style={{ marginRight: 4, flexShrink: 0 }} color="green" />
        : <IconX size={16} style={{ marginRight: 4, flexShrink: 0 }} color="red" />
      )
      : null;

    // JSON text for correct answer
    const correctAnswerJSONText = correctAnswer
      ? JSON.stringify(correctAnswer, null, 2)
      : undefined;

    const responseJSONText = component && JSON.stringify(component.response, null, 2);

    const parameters = componentAnswer && 'parameters' in componentAnswer
      ? componentAnswer.parameters
      : component && 'parameters' in component
        ? component.parameters
        : undefined;

    const blockIsCollapsed = !isComponent && (
      renderedFlatTree[idx + 1]?.indentLevel === undefined
      || renderedFlatTree[idx + 1]?.indentLevel <= indentLevel
    );

    return (
      <HoverCard withinPortal position="left" withArrow arrowSize={10} shadow="md" offset={0} closeDelay={0} key={`${indentLevel}-${idx}`}>
        <NavLink
          h={32}
          pl={indentLevel * 24 + 12}
          onClick={() => {
            if (isComponent && href) {
              navigate(href);
            } else if (blockIsCollapsed) {
              expandBlock(idx, renderedFlatTree[idx]);
            } else {
              collapseBlock(idx, renderedFlatTree[idx]);
            }
          }}
          active={window.location.pathname === href}
          rightSection={
            isComponent
              ? undefined
              : <IconChevronUp size={16} stroke={1.5} style={{ cursor: 'pointer', transform: blockIsCollapsed ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          }
          label={(
            <Flex align="center">
              {isInterruption && (
              <Tooltip label="Interruption" position="right" withArrow>
                <IconBrain size={16} style={{ marginRight: 4, flexShrink: 0 }} color="orange" />
              </Tooltip>
              )}
              {isLibraryImport && (
              <Tooltip label="Package import" position="right" withArrow>
                <IconPackageImport size={16} style={{ marginRight: 4, flexShrink: 0 }} color="blue" />
              </Tooltip>
              )}
              {component?.responseOrder === 'random' && (
              <Tooltip label="Random responses" position="right" withArrow>
                <IconDice3 size={16} opacity={0.8} style={{ marginRight: 4, flexShrink: 0 }} color="black" />
              </Tooltip>
              )}
              {(component?.response && hasRandomization(component.response)) && (
              <Tooltip label="Random options" position="right" withArrow>
                <IconDice5 size={16} opacity={0.8} style={{ marginRight: 4, flexShrink: 0 }} color="black" />
              </Tooltip>
              )}
              {correctIncorrectIcon}
              <Text
                size="sm"
                title={label}
                fw={!isComponent ? 700 : undefined}
                style={{
                  textWrap: 'nowrap',
                  flexGrow: 1,
                  width: 0,
                  textOverflow: 'ellipsis',
                  overflow: 'hidden',
                }}
              >
                {label}
              </Text>
              {isComponent && label !== 'end' && (
              <HoverCard.Target>
                <IconInfoCircle size={16} style={{ marginLeft: '5px', verticalAlign: 'middle' }} opacity={0.5} />
              </HoverCard.Target>
              )}
              {order === 'random' || order === 'latinSquare' ? (
                <Tooltip label={order} position="right" withArrow>
                  <IconArrowsShuffle size="15" opacity={0.5} style={{ marginLeft: '5px', verticalAlign: 'middle' }} />
                </Tooltip>
              ) : null}
              {!isComponent && (
                <Badge ml={5} variant="light">
                  {numComponentsInSequence}
                  /
                  {numComponentsInStudySequence}
                </Badge>
              )}
              {numInterruptions !== undefined && numInterruptions > 0 && (
              <Badge ml={5} color="orange" variant="light">
                {numInterruptions}
              </Badge>
              )}
            </Flex>
          )}
        />
        {isComponent && (
        <HoverCard.Dropdown>
          <Box mah={700} maw={500} style={{ overflow: 'auto' }}>
            <Box>
              <Text fw={900} display="inline-block" mr={2}>
                Name:
              </Text>
              {' '}
              <Text fw={400} component="span">
                {label}
              </Text>
            </Box>
            {component && component.description && (
            <Box>
              <Text fw={900} display="inline-block" mr={2}>
                Description:
              </Text>
              {' '}
              <Text fw={400} component="span">
                {component.description}
              </Text>
            </Box>
            )}
            {parameters && (
            <Box>
              <Text fw={900} display="inline-block" mr={2}>
                Parameters:
              </Text>
              {' '}
              <Code block>{JSON.stringify(parameters, null, 2)}</Code>
            </Box>
            )}
            {componentAnswer && Object.keys(componentAnswer.answer).length > 0 && (
            <Box>
              <Text fw={900} display="inline-block" mr={2}>
                {correctIncorrectIcon}
                Participant Answer:
              </Text>
              {' '}
              <Code block>{JSON.stringify(componentAnswer.answer, null, 2)}</Code>
            </Box>
            )}
            {correctAnswerJSONText && (
            <Box>
              <Text fw={900} display="inline-block" mr={2}>
                Correct Answer:
              </Text>
              {' '}
              <Code block>
                <Text size="xs" lineClamp={correctAnswerClampMap[href!]}>{correctAnswerJSONText}</Text>
                {correctAnswerJSONText.split('\n').length > INITIAL_CLAMP && (
                <Flex justify="flex-end">
                  {(correctAnswerClampMap[href!] === undefined || correctAnswerJSONText.split('\n').length > (correctAnswerClampMap[href!] || -1)) && (
                    <Button
                      variant="light"
                      size="xs"
                      onClick={() => {
                        setCorrectAnswerClampMap((prev) => ({
                          ...prev,
                          [href!]: prev[href!] === INITIAL_CLAMP ? undefined : INITIAL_CLAMP,
                        }));
                      }}
                    >
                      {correctAnswerClampMap[href!] !== undefined ? 'Show more' : 'Show less'}
                    </Button>
                  )}
                </Flex>
                )}
              </Code>
            </Box>
            )}
            {component && responseJSONText && (
            <Box>
              <Text fw={900} display="inline-block" mr={2}>
                Response:
              </Text>
              {' '}
              <Code block>
                <Text size="xs" lineClamp={responseClampMap[href!]}>{JSON.stringify(component.response, null, 2)}</Text>
                {responseJSONText.split('\n').length > INITIAL_CLAMP && (
                <Flex justify="flex-end">
                  {(responseClampMap[href!] === undefined || responseJSONText.split('\n').length > (responseClampMap[href!] || -1)) && (
                    <Button
                      variant="light"
                      size="xs"
                      onClick={() => {
                        setResponseClampMap((prev) => ({
                          ...prev,
                          [href!]: prev[href!] === INITIAL_CLAMP ? undefined : INITIAL_CLAMP,
                        }));
                      }}
                    >
                      {responseClampMap[href!] !== undefined ? 'Show more' : 'Show less'}
                    </Button>
                  )}
                </Flex>
                )}
              </Code>
            </Box>
            )}
            {component && component.meta && (
            <Box>
              <Text fw="900" component="span">Task Meta: </Text>
              <Code block>{JSON.stringify(component.meta, null, 2)}</Code>
            </Box>
            )}
          </Box>
        </HoverCard.Dropdown>
        )}
      </HoverCard>
    );
  });
}
