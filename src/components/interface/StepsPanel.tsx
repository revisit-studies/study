import {
  useCallback, useEffect, useMemo, useState, useRef,
} from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
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
  path: string; // Unique path from root for stable keying

  // Component Attributes
  href?: string;
  isInterruption?: boolean;
  isLibraryImport?: boolean;
  component?: StudyConfig['components'][string];
  componentAnswer?: StoredAnswer;
  componentName?: string; // Full component name (e.g., package.co.ComponentName)

  // Block Attributes
  order?: Sequence['order'];
  numInterruptions?: number;
  numComponentsInSequence?: number;
  numComponentsInStudySequence?: number;
  childrenRange?: { start: number; end: number }; // Pre-computed indices of children in fullFlatTree
  isExcluded?: boolean; // Block was excluded from participant sequence
};

/**
 * Find blocks in sequenceBlock that are missing from participantNode by comparing orderPath
 */
function findExcludedBlocks(
  sequenceBlock: Sequence,
  participantNode: Sequence,
): Sequence[] {
  const excludedBlocks: Sequence[] = [];

  // Get all block orderPaths from participant sequence
  const participantBlockOrderPaths = new Set<string>();
  participantNode.components.forEach((comp) => {
    if (typeof comp !== 'string' && comp.orderPath) {
      participantBlockOrderPaths.add(comp.orderPath);
    }
  });

  // Find blocks in study sequence that aren't in participant sequence based on orderPath
  sequenceBlock.components.forEach((comp) => {
    if (typeof comp !== 'string' && comp.orderPath && !participantBlockOrderPaths.has(comp.orderPath)) {
      excludedBlocks.push(comp);
    }
  });

  return excludedBlocks;
}

export function StepsPanel({
  participantSequence,
  participantAnswers,
  studyConfig,
}: {
  participantSequence?: Sequence;
  participantAnswers: ParticipantData['answers'];
  studyConfig: StudyConfig;
}) {
  // Constants
  const INITIAL_CLAMP = 6;
  const ROW_HEIGHT = 32; // px, fixed height for each row
  const INDENT_SIZE = 24; // px, indentation per level
  const BASE_PADDING = 12; // px, base left padding
  const VIRTUALIZER_OVERSCAN = 6; // number of items to render outside viewport

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

  // Memoize hasRandomization checks for all components
  const componentHasRandomization = useMemo(() => {
    const map = new Map<string, boolean>();
    Object.entries(studyConfig.components).forEach(([key, component]) => {
      if (component.response) {
        map.set(key, hasRandomization(component.response));
      }
    });
    return map;
  }, [studyConfig.components]);

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
          path: `browse.${key}`,
          href: `/${studyId}/reviewer-${key}`,
          isLibraryImport: coOrComponents !== false,
          componentName: key,
        };
      });
    } else {
      // Participant view

      // Indices to keep track of component positions, used for navigation hrefs
      let idx = 0;
      let dynamicIdx = 0;

      const traverse = (node: string | Sequence, indentLevel: number, parentNode: Sequence, parentPath: string, dynamic = false) => {
        if (typeof node === 'string') {
          // Check to see if the component is from imported library
          const coOrComponents = node.includes('.co.')
            ? '.co.'
            : (node.includes('.components.') ? '.components.' : false);

          // Generate component identifier for participantAnswers lookup
          const componentIdentifier = dynamic ? `${parentNode.id}_${idx}_${node}_${dynamicIdx}` : `${node}_${idx}`;
          const componentPath = `${parentPath}.${node}_${dynamic ? dynamicIdx : idx}`;

          newFlatTree.push({
            label: coOrComponents ? node.split(coOrComponents).at(-1)! : node,
            indentLevel,
            path: componentPath,
            isLibraryImport: coOrComponents !== false,

            // Component Attributes
            href: dynamic ? `/${studyId}/${encryptIndex(idx)}/${encryptIndex(dynamicIdx)}` : `/${studyId}/${encryptIndex(idx)}`,
            isInterruption: (parentNode.interruptions || []).flatMap((intr) => intr.components).includes(node),
            component: studyConfig.components[node],
            componentAnswer: participantAnswers[componentIdentifier],
            componentName: node,
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
        const blockPath = `${parentPath}.${node.id ?? node.order}`;

        // Push the block itself
        newFlatTree.push({
          label: node.id ?? node.order,
          indentLevel,
          path: blockPath,

          // Block Attributes
          order: node.order,
          numInterruptions: node.components.filter((comp) => typeof comp === 'string' && blockInterruptions.includes(comp)).length,
          numComponentsInSequence: countComponentsInSequence(node, participantAnswers),
          numComponentsInStudySequence: countComponentsInSequence(matchingStudySequence || node, participantAnswers),
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
            traverse(child, indentLevel + 1, node, blockPath, node.order === 'dynamic');
          });
        }

        // After processing all children, check for excluded blocks from the study sequence
        const matchingStudyBlock = findMatchingComponentInFullOrder(node, fullOrder);
        if (matchingStudyBlock) {
          const excludedBlocks = findExcludedBlocks(matchingStudyBlock, node);
          excludedBlocks.forEach((excludedBlock) => {
            const excludedBlockPath = `${blockPath}.${excludedBlock.id ?? excludedBlock.order}_excluded`;

            // Add the excluded block
            newFlatTree.push({
              label: excludedBlock.id ?? excludedBlock.order,
              indentLevel: indentLevel + 1,
              path: excludedBlockPath,

              // Block Attributes
              order: excludedBlock.order,
              numInterruptions: 0,
              numComponentsInSequence: 0,
              numComponentsInStudySequence: countComponentsInSequence(excludedBlock, participantAnswers),
              isExcluded: true,
            });

            // Recursively add excluded block's children as excluded
            const traverseExcluded = (excludedNode: Sequence, excludedIndentLevel: number, excludedParentPath: string) => {
              excludedNode.components.forEach((child) => {
                if (typeof child === 'string') {
                  const coOrComponents = child.includes('.co.')
                    ? '.co.'
                    : (child.includes('.components.') ? '.components.' : false);
                  const childPath = `${excludedParentPath}.${child}_excluded`;

                  newFlatTree.push({
                    label: coOrComponents ? child.split(coOrComponents).at(-1)! : child,
                    indentLevel: excludedIndentLevel,
                    path: childPath,
                    isLibraryImport: coOrComponents !== false,
                    component: studyConfig.components[child],
                    componentName: child,
                    isExcluded: true,
                  });
                } else {
                  const childBlockPath = `${excludedParentPath}.${child.id ?? child.order}_excluded`;

                  newFlatTree.push({
                    label: child.id ?? child.order,
                    indentLevel: excludedIndentLevel,
                    path: childBlockPath,
                    order: child.order,
                    numInterruptions: 0,
                    numComponentsInSequence: 0,
                    numComponentsInStudySequence: countComponentsInSequence(child, participantAnswers),
                    isExcluded: true,
                  });

                  traverseExcluded(child, excludedIndentLevel + 1, childBlockPath);
                }
              });
            };

            traverseExcluded(excludedBlock, indentLevel + 2, excludedBlockPath);
          });
        }
      };

      traverse(participantSequence, 0, participantSequence, 'root');
    }

    // Pre-compute children ranges for blocks for O(1) collapse/expand
    for (let i = 0; i < newFlatTree.length; i += 1) {
      const item = newFlatTree[i];
      if (item.order !== undefined) { // It's a block
        const startIndentLevel = item.indentLevel;
        let endIndex = i + 1;
        while (endIndex < newFlatTree.length && newFlatTree[endIndex].indentLevel > startIndentLevel) {
          endIndex += 1;
        }
        item.childrenRange = { start: i + 1, end: endIndex };
      }
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
    setRenderedFlatTree((prevRenderedFlatTree) => {
      // Dynamically calculate children based on indent level in renderedFlatTree
      const startIndentLevel = startItem.indentLevel;
      let endIndex = startIndex + 1;

      // Find all children (items with greater indent level)
      while (endIndex < prevRenderedFlatTree.length && prevRenderedFlatTree[endIndex].indentLevel > startIndentLevel) {
        endIndex += 1;
      }

      const numChildren = endIndex - (startIndex + 1);

      // Remove all children
      return [
        ...prevRenderedFlatTree.slice(0, startIndex + 1),
        ...prevRenderedFlatTree.slice(startIndex + 1 + numChildren),
      ];
    });
  }, []);

  const expandBlock = useCallback((startIndex: number, startItem: StepItem) => {
    setRenderedFlatTree((prevRenderedFlatTree) => {
      // Find the items to insert from fullFlatTree based on the block's childrenRange
      const { start, end } = startItem.childrenRange ?? { start: 0, end: 0 };

      // Only insert direct children (depth = startItem.indentLevel + 1)
      // We need to filter out children of collapsed blocks within the range
      const itemsToInsert: StepItem[] = [];
      const startIndentLevel = startItem.indentLevel;

      for (let i = start; i < end; i += 1) {
        const item = fullFlatTree[i];

        // Only add items that are direct children
        if (item.indentLevel === startIndentLevel + 1) {
          itemsToInsert.push(item);
        } else if (item.indentLevel > startIndentLevel + 1) {
          // This is a nested child - check if its parent block is in itemsToInsert
          // Find the most recent block at the parent level
          let shouldInclude = false;
          for (let j = itemsToInsert.length - 1; j >= 0; j -= 1) {
            const potentialParent = itemsToInsert[j];
            if (potentialParent.indentLevel < item.indentLevel
                && potentialParent.indentLevel === item.indentLevel - 1
                && potentialParent.order !== undefined) {
              // This item's parent is in the list, so include it
              shouldInclude = true;
              break;
            }
            if (potentialParent.indentLevel < item.indentLevel - 1) {
              break;
            }
          }
          if (shouldInclude) {
            itemsToInsert.push(item);
          }
        }
      }

      // Create new array with the items inserted after startIndex
      return [
        ...prevRenderedFlatTree.slice(0, startIndex + 1),
        ...itemsToInsert,
        ...prevRenderedFlatTree.slice(startIndex + 1),
      ];
    });
  }, [fullFlatTree]);

  // Virtualizer setup
  const parentRef = useRef<HTMLDivElement>(null);
  const rowCount = renderedFlatTree.length;
  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: VIRTUALIZER_OVERSCAN,
  });

  return (
    <Box ref={parentRef} style={{ height: '100%', overflow: 'auto' }}>
      <Box style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const idx = virtualRow.index;
          const {
            label,
            indentLevel,
            isLibraryImport,
            href,
            isInterruption,
            component,
            componentAnswer,
            componentName,
            order,
            numInterruptions,
            numComponentsInSequence,
            numComponentsInStudySequence,
            isExcluded,
          } = renderedFlatTree[idx];
          const isComponent = order === undefined;
          const correctAnswer = componentAnswer?.correctAnswer?.length
            ? componentAnswer.correctAnswer
            : component?.correctAnswer;
          const correct = correctAnswer
            && componentAnswer
            && Object.keys(componentAnswer.answer).length > 0
            && componentAnswersAreCorrect(componentAnswer.answer, correctAnswer);
          const correctIncorrectIcon = correctAnswer && componentAnswer && componentAnswer?.endTime > -1
            ? (correct
              ? <IconCheck size={16} style={{ marginRight: 4, flexShrink: 0 }} color="green" />
              : <IconX size={16} style={{ marginRight: 4, flexShrink: 0 }} color="red" />
            )
            : null;
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
            <Box
              key={virtualRow.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: ROW_HEIGHT,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <HoverCard withinPortal position="left" withArrow arrowSize={10} shadow="md" offset={0} closeDelay={0}>
                <NavLink
                  h={ROW_HEIGHT}
                  pl={indentLevel * INDENT_SIZE + BASE_PADDING}
                  onClick={() => {
                    if (isComponent && href && !isExcluded) {
                      navigate(href);
                    } else if (!isComponent) {
                      // Both included and excluded blocks can be collapsed/expanded
                      if (blockIsCollapsed) {
                        expandBlock(idx, renderedFlatTree[idx]);
                      } else {
                        collapseBlock(idx, renderedFlatTree[idx]);
                      }
                    }
                  }}
                  active={!isExcluded && window.location.pathname === href}
                  disabled={isExcluded && isComponent}
                  style={{
                    opacity: isExcluded ? 0.5 : 1,
                    cursor: isExcluded && isComponent ? 'not-allowed' : 'pointer',
                  }}
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
                      {(componentName && componentHasRandomization.get(componentName)) && (
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
                      {!isComponent && !isExcluded && (
                        <Badge ml={5} variant="light">
                          {numComponentsInSequence}
                          /
                          {numComponentsInStudySequence}
                        </Badge>
                      )}
                      {!isComponent && isExcluded && (
                        <Badge ml={5} color="gray" variant="light">
                          Excluded
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
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
