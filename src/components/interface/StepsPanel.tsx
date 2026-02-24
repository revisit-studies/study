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
  IconArrowsShuffle, IconBinaryTree, IconBrain, IconCheck, IconChevronUp, IconDice3, IconDice5, IconInfoCircle,
  IconPackageImport,
  IconX,
} from '@tabler/icons-react';
import { useNavigate, useLocation } from 'react-router';
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

    // Match by orderPath if available
    if (node.orderPath && sequence.orderPath && node.orderPath === sequence.orderPath) {
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

  // Dynamic blocks generate components at runtime, so we count from participant answers
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

type StepItemBase = {
  label: string;
  indentLevel: number;
  path: string; // Unique path from root for stable keying
};

type ComponentStepItem = StepItemBase & {
  type: 'component';
  href?: string;
  isInterruption?: boolean;
  isLibraryImport: boolean;
  importedLibraryName?: string;
  component?: StudyConfig['components'][string];
  componentAnswer?: StoredAnswer;
  componentName: string; // Full component name (e.g., package.components.ComponentName)
  isExcluded?: boolean; // Component was excluded from participant sequence
};

type BlockStepItem = StepItemBase & {
  type: 'block';
  order: Sequence['order'];
  orderPath?: string; // Order path for blocks
  conditional?: boolean;
  numInterruptions?: number;
  numComponentsInSequence?: number;
  numComponentsInStudySequence?: number;
  isLibraryImport?: boolean;
  importedLibraryName?: string;
  childrenRange?: { start: number; end: number }; // Pre-computed indices of children in fullFlatTree
  isExcluded?: boolean; // Block was excluded from participant sequence
};

type StepItem = ComponentStepItem | BlockStepItem;

type SequenceWithImportReference = Sequence & {
  __revisitImportedSequenceRef?: string;
};

function parseLibraryComponentReference(componentName: string) {
  const separator = componentName.includes('.components.')
    ? '.components.'
    : (componentName.includes('.co.') ? '.co.' : false);
  const isLibraryImport = separator !== false && componentName.startsWith('$');
  const label = isLibraryImport ? componentName.split(separator).at(-1)! : componentName;
  const importedLibraryName = isLibraryImport ? componentName.split(separator)[0].slice(1) : undefined;
  return { isLibraryImport, label, importedLibraryName };
}

function getImportedSequenceReference(sequence?: Sequence | null): string | undefined {
  return (sequence as SequenceWithImportReference | undefined | null)?.__revisitImportedSequenceRef;
}

function parseLibrarySequenceReference(blockId: string, importedSequenceReference?: string) {
  const importReference = importedSequenceReference || blockId;
  const separator = importReference.includes('.sequences.')
    ? '.sequences.'
    : (importReference.includes('.se.') ? '.se.' : false);
  const isLibraryImport = separator !== false && importReference.startsWith('$');
  const labelSeparator = blockId.includes('.sequences.')
    ? '.sequences.'
    : (blockId.includes('.se.') ? '.se.' : false);
  const label = labelSeparator ? blockId.split(labelSeparator).at(-1)! : blockId;
  const importedLibraryName = isLibraryImport ? importReference.split(separator)[0].slice(1) : undefined;
  return { isLibraryImport, label, importedLibraryName };
}

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

/**
 * Find components (strings) in sequenceBlock that are missing from participantNode
 */
function findExcludedComponents(
  sequenceBlock: Sequence,
  participantNode: Sequence,
): string[] {
  const excludedComponents: string[] = [];

  // Get all component names from participant sequence
  const participantComponents = new Set<string>();
  participantNode.components.forEach((comp) => {
    if (typeof comp === 'string') {
      participantComponents.add(comp);
    }
  });

  // Find components in study sequence that aren't in participant sequence
  sequenceBlock.components.forEach((comp) => {
    if (typeof comp === 'string' && !participantComponents.has(comp)) {
      excludedComponents.push(comp);
    }
  });

  return excludedComponents;
}

export function StepsPanel({
  participantSequence,
  participantAnswers,
  studyConfig,
  isAnalysis,
}: {
  participantSequence?: Sequence;
  participantAnswers: ParticipantData['answers'];
  studyConfig: StudyConfig;
  isAnalysis?: boolean;
}) {
  // Constants
  const INITIAL_CLAMP = 6;
  const ROW_HEIGHT = 32; // px, fixed height for each row
  const INDENT_SIZE = 24; // px, indentation per level
  const BASE_PADDING = 12; // px, base left padding
  const VIRTUALIZER_OVERSCAN = 10; // number of items to render outside viewport

  // Per-row clamp state, keyed by idx
  const [correctAnswerClampMap, setCorrectAnswerClampMap] = useState<Record<string, number | undefined>>({});
  const [responseClampMap, setResponseClampMap] = useState<Record<string, number | undefined>>({});
  const [fullFlatTree, setFullFlatTree] = useState<StepItem[]>([]);
  const [renderedFlatTree, setRenderedFlatTree] = useState<StepItem[]>([]);
  // Map from item.path -> index in `fullFlatTree` for O(1) range checks
  const fullIndexByPathRef = useRef<Map<string, number>>(new Map());

  const studyId = useStudyId();
  const navigate = useNavigate();
  const location = useLocation();

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
        const {
          label,
          isLibraryImport,
          importedLibraryName,
        } = parseLibraryComponentReference(key);

        return {
          type: 'component',
          label,
          indentLevel: 0,
          path: `browse.${key}`,
          href: `/${studyId}/reviewer-${key}`,
          isLibraryImport,
          importedLibraryName,
          componentName: key,
        };
      });
    } else {
      // Participant view

      // Pre-compute expensive lookups to avoid O(n²) complexity
      const matchingStudySequenceCache = new Map<string, Sequence | null>();
      const componentCountCache = new Map<Sequence, number>();

      // Indices to keep track of component positions, used for navigation hrefs
      let idx = 0;
      let dynamicIdx = 0;

      const traverse = (node: string | Sequence, indentLevel: number, parentNode: Sequence, parentPath: string, dynamic = false) => {
        if (typeof node === 'string') {
          // Check to see if the component is from imported library
          const {
            label,
            isLibraryImport,
            importedLibraryName,
          } = parseLibraryComponentReference(node);

          // Generate component identifier for participantAnswers lookup
          const componentIdentifier = dynamic ? `${parentNode.id}_${idx}_${node}_${dynamicIdx}` : `${node}_${idx}`;
          const componentPath = `${parentPath}.${node}_${dynamic ? dynamicIdx : idx}`;

          newFlatTree.push({
            type: 'component',
            label,
            indentLevel,
            path: componentPath,
            isLibraryImport,
            importedLibraryName,

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
        const blockPath = `${parentPath}.${node.id ?? node.order}`;

        // Use cache for expensive lookups
        const cacheKey = node.orderPath || blockPath;
        let matchingStudySequence = matchingStudySequenceCache.get(cacheKey);
        if (matchingStudySequence === undefined) {
          matchingStudySequence = findMatchingComponentInFullOrder(node, fullOrder);
          matchingStudySequenceCache.set(cacheKey, matchingStudySequence);
        }

        // Cache component counts
        let numComponentsInSequence = componentCountCache.get(node);
        if (numComponentsInSequence === undefined) {
          numComponentsInSequence = countComponentsInSequence(node, participantAnswers);
          componentCountCache.set(node, numComponentsInSequence);
        }

        let numComponentsInStudySequence = componentCountCache.get(matchingStudySequence || node);
        if (numComponentsInStudySequence === undefined) {
          numComponentsInStudySequence = countComponentsInSequence(matchingStudySequence || node, participantAnswers);
          if (matchingStudySequence) {
            componentCountCache.set(matchingStudySequence, numComponentsInStudySequence);
          }
        }

        // Determine label for block - extract sequence name for library sequences
        const blockId = node.id ?? node.order;
        const importedSequenceReference = getImportedSequenceReference(node) || getImportedSequenceReference(matchingStudySequence);
        const {
          label: blockLabel,
          isLibraryImport: isLibraryBlockImport,
          importedLibraryName: blockImportedLibraryName,
        } = parseLibrarySequenceReference(String(blockId), importedSequenceReference);

        // Push the block itself
        newFlatTree.push({
          type: 'block',
          label: blockLabel,
          indentLevel,
          path: blockPath,

          // Block Attributes
          order: node.order,
          orderPath: node.orderPath,
          conditional: node.conditional,
          numInterruptions: node.components.filter((comp) => typeof comp === 'string' && blockInterruptions.includes(comp)).length,
          numComponentsInSequence,
          numComponentsInStudySequence,
          isLibraryImport: isLibraryBlockImport,
          importedLibraryName: blockImportedLibraryName,
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
        if (node.order === 'dynamic') {
          idx += 1;
        }
        // After processing all children, check for excluded blocks and components from the study sequence
        // Reuse the cached matchingStudySequence from above
        if (matchingStudySequence) {
          // First, add excluded components (strings)
          const excludedComponents = findExcludedComponents(matchingStudySequence, node);
          excludedComponents.forEach((excludedComponent) => {
            const {
              label,
              isLibraryImport,
              importedLibraryName,
            } = parseLibraryComponentReference(excludedComponent);
            const excludedComponentPath = `${blockPath}.${excludedComponent}_excluded`;

            newFlatTree.push({
              type: 'component',
              label,
              indentLevel: indentLevel + 1,
              path: excludedComponentPath,
              isLibraryImport,
              importedLibraryName,
              component: studyConfig.components[excludedComponent],
              componentName: excludedComponent,
              isExcluded: true,
            });
          });

          // Then, add excluded blocks
          const excludedBlocks = findExcludedBlocks(matchingStudySequence, node);
          excludedBlocks.forEach((excludedBlock) => {
            const excludedBlockPath = `${blockPath}.${excludedBlock.id ?? excludedBlock.order}_excluded`;

            // Determine label for excluded block - extract sequence name for library sequences
            const excludedBlockId = excludedBlock.id ?? excludedBlock.order;
            const {
              label: excludedBlockLabel,
              isLibraryImport: isExcludedBlockImport,
              importedLibraryName: excludedBlockImportedLibraryName,
            } = parseLibrarySequenceReference(String(excludedBlockId), getImportedSequenceReference(excludedBlock));

            // Add the excluded block
            newFlatTree.push({
              type: 'block',
              label: excludedBlockLabel,
              indentLevel: indentLevel + 1,
              path: excludedBlockPath,

              // Block Attributes
              order: excludedBlock.order,
              orderPath: excludedBlock.orderPath,
              numInterruptions: 0,
              numComponentsInSequence: 0,
              numComponentsInStudySequence: countComponentsInSequence(excludedBlock, participantAnswers),
              isLibraryImport: isExcludedBlockImport,
              importedLibraryName: excludedBlockImportedLibraryName,
              isExcluded: true,
            });

            // Recursively add excluded block's children as excluded
            const traverseExcluded = (excludedNode: Sequence, excludedIndentLevel: number, excludedParentPath: string) => {
              excludedNode.components.forEach((child) => {
                if (typeof child === 'string') {
                  const {
                    label,
                    isLibraryImport,
                    importedLibraryName,
                  } = parseLibraryComponentReference(child);
                  const childPath = `${excludedParentPath}.${child}_excluded`;

                  newFlatTree.push({
                    type: 'component',
                    label,
                    indentLevel: excludedIndentLevel,
                    path: childPath,
                    isLibraryImport,
                    importedLibraryName,
                    component: studyConfig.components[child],
                    componentName: child,
                    isExcluded: true,
                  });
                } else {
                  const childBlockPath = `${excludedParentPath}.${child.id ?? child.order}_excluded`;

                  // Determine label for nested excluded block - extract sequence name for library sequences
                  const childBlockId = child.id ?? child.order;
                  const {
                    label: childBlockLabel,
                    isLibraryImport: isChildBlockImport,
                    importedLibraryName: childBlockImportedLibraryName,
                  } = parseLibrarySequenceReference(String(childBlockId), getImportedSequenceReference(child));

                  newFlatTree.push({
                    type: 'block',
                    label: childBlockLabel,
                    indentLevel: excludedIndentLevel,
                    path: childBlockPath,
                    order: child.order,
                    orderPath: child.orderPath,
                    numInterruptions: 0,
                    numComponentsInSequence: 0,
                    numComponentsInStudySequence: countComponentsInSequence(child, participantAnswers),
                    isLibraryImport: isChildBlockImport,
                    importedLibraryName: childBlockImportedLibraryName,
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
      if (item.type === 'block') { // It's a block
        const startIndentLevel = item.indentLevel;
        let endIndex = i + 1;
        while (endIndex < newFlatTree.length && newFlatTree[endIndex].indentLevel > startIndentLevel) {
          endIndex += 1;
        }
        item.childrenRange = { start: i + 1, end: endIndex };
      }
    }

    // Build quick lookup from path -> fullFlatTree index for collapse/expand operations
    fullIndexByPathRef.current.clear();
    newFlatTree.forEach((it, i) => {
      fullIndexByPathRef.current.set(it.path, i);
    });

    // Map over tree and set correctAnswerClampMap and responseClampMap
    const clampMap = Object.fromEntries(newFlatTree.map((item) => {
      if (item.type === 'component' && item.href) {
        return [item.href, INITIAL_CLAMP];
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
      // Prefer using pre-computed childrenRange (from `fullFlatTree`) for O(1)-ish collapse when available.
      // Fallback to the previous indent-level scan when childrenRange is missing.
      const startIndentLevel = startItem.indentLevel;

      if (startItem.type === 'block' && startItem.childrenRange && fullFlatTree.length > 0) {
        const { start, end } = startItem.childrenRange;

        // Build a Set of child paths from the full tree range and remove any
        // contiguous rendered items whose path is in that set. This is simpler
        // and robust when a block only contains other blocks (no components).
        const childPathSet = new Set(fullFlatTree.slice(start, end).map((it) => it.path));

        let endIndex = startIndex + 1;
        while (endIndex < prevRenderedFlatTree.length && childPathSet.has(prevRenderedFlatTree[endIndex].path)) {
          endIndex += 1;
        }

        return [
          ...prevRenderedFlatTree.slice(0, startIndex + 1),
          ...prevRenderedFlatTree.slice(endIndex),
        ];
      }

      // Fallback: dynamically calculate children based on indent level in renderedFlatTree
      let endIndex = startIndex + 1;
      // Find all children (items with greater indent level)
      while (endIndex < prevRenderedFlatTree.length && prevRenderedFlatTree[endIndex].indentLevel > startIndentLevel) {
        endIndex += 1;
      }

      // Remove all children
      return [
        ...prevRenderedFlatTree.slice(0, startIndex + 1),
        ...prevRenderedFlatTree.slice(endIndex),
      ];
    });
  }, [fullFlatTree]);

  const expandBlock = useCallback((startIndex: number, startItem: StepItem) => {
    setRenderedFlatTree((prevRenderedFlatTree) => {
      // Find the items to insert from fullFlatTree based on the block's childrenRange
      const { start, end } = (startItem.type === 'block' ? (startItem.childrenRange ?? { start: 0, end: 0 }) : { start: 0, end: 0 });

      // Only insert direct children (depth = startItem.indentLevel + 1)
      // We need to filter out children of collapsed blocks within the range
      const itemsToInsert: StepItem[] = [];
      const startIndentLevel = startItem.indentLevel;

      // Build a quick lookup of currently rendered item paths so we can
      // determine whether a nested item should be inserted based on whether
      // its immediate parent is visible (rendered) or will be inserted.
      const renderedPathSet = new Set(prevRenderedFlatTree.map((it) => it.path));
      const itemsToInsertSet = new Set<string>();

      for (let i = start; i < end; i += 1) {
        const item = fullFlatTree[i];

        if (item.indentLevel === startIndentLevel + 1) {
          // Direct children of the expanded block are always inserted
          itemsToInsert.push(item);
          itemsToInsertSet.add(item.path);
        } else if (item.indentLevel > startIndentLevel + 1) {
          // For nested descendants, include only if their immediate parent
          // (in the full tree) is either the block being expanded, is
          // currently rendered, or is already scheduled to be inserted.
          const fullIdx = fullIndexByPathRef.current.get(item.path);
          if (fullIdx !== undefined) {
            // Walk backwards in fullFlatTree to find the immediate parent
            let parentIdx = fullIdx - 1;
            while (parentIdx >= 0 && fullFlatTree[parentIdx].indentLevel >= item.indentLevel) {
              parentIdx -= 1;
            }
            if (parentIdx >= 0) {
              const parent = fullFlatTree[parentIdx];
              if (parent) {
                const parentIsExpandedBlock = parent.path === startItem.path;
                const parentIsRendered = renderedPathSet.has(parent.path);
                const parentWillBeInserted = itemsToInsertSet.has(parent.path);

                if (parentIsExpandedBlock || parentIsRendered || parentWillBeInserted) {
                  itemsToInsert.push(item);
                  itemsToInsertSet.add(item.path);
                }
              }
            }
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
    <Box
      ref={parentRef}
      style={{
        height: '100%',
        overflow: 'auto',
        position: 'relative',
      }}
    >
      <Box style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative', width: '100%' }}>
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const idx = virtualRow.index;
          const item = renderedFlatTree[idx];
          const { label, indentLevel, isExcluded } = item;
          const comp = item.type === 'component' ? item : undefined;
          const block = item.type === 'block' ? item : undefined;
          const isComponent = !!comp;
          const {
            href,
            isInterruption,
            component,
            componentAnswer,
            componentName,
            isLibraryImport: isComponentLibraryImport,
            importedLibraryName: componentImportedLibraryName,
          } = (comp ?? {}) as Partial<ComponentStepItem>;
          const {
            order,
            orderPath,
            conditional,
            numInterruptions,
            numComponentsInSequence,
            numComponentsInStudySequence,
            isLibraryImport: isBlockLibraryImport,
            importedLibraryName: blockImportedLibraryName,
          } = (block ?? {}) as Partial<BlockStepItem>;
          const isLibraryImport = isComponent ? isComponentLibraryImport : isBlockLibraryImport;
          const importedLibraryName = isComponent ? componentImportedLibraryName : blockImportedLibraryName;
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
                      if (isAnalysis) {
                        navigate(`/analysis/stats/${studyId}/stats/${encodeURIComponent(String(componentName))}${location.search}`);
                      } else {
                        navigate(`${href}${location.search}`);
                      }
                    } else if (!isComponent) {
                      // Both included and excluded blocks can be collapsed/expanded
                      if (blockIsCollapsed) {
                        expandBlock(idx, renderedFlatTree[idx]);
                      } else {
                        collapseBlock(idx, renderedFlatTree[idx]);
                      }
                    }
                  }}
                  active={!isExcluded && href === location.pathname}
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
                        <Tooltip label={importedLibraryName ? `Imported from ${importedLibraryName}` : 'Package import'} position="right" withArrow>
                          <IconPackageImport size={16} style={{ marginRight: 4, flexShrink: 0 }} color="blue" />
                        </Tooltip>
                      )}
                      {!isComponent && conditional && (
                        <Tooltip label={`Condition: ${label}`} position="right" withArrow>
                          <IconBinaryTree size={16} style={{ marginRight: 4, flexShrink: 0 }} color="green" />
                        </Tooltip>
                      )}
                      {(component?.responseOrder === 'random' || (!participantSequence && componentName && studyConfig.components[componentName]?.responseOrder === 'random')) && (
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
                        title={orderPath ?? label}
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
                          {(numComponentsInSequence || 0) - (numInterruptions || 0)}
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
