import {
  useCallback, useEffect, useMemo, useState, useRef, useId,
} from 'react';
import type { ReactNode } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  Badge,
  Box,
  Code,
  Flex,
  NavLink,
  Text,
  Tooltip,
  Button,
  Collapse,
} from '@mantine/core';
import {
  IconArrowsShuffle, IconBinaryTree, IconBrain, IconCheck, IconChevronUp, IconDice3, IconDice5, IconInfoCircle,
  IconArrowForward,
  IconPackageImport,
  IconUserPlus,
  IconX,
  IconChevronDown,
} from '@tabler/icons-react';
import { useNavigate, useLocation } from 'react-router';
import type { GlobalStoreGraph } from '../../store/globalStoreProvenance';
import type { ParticipantData, Response, StudyConfig } from '../../parser/types';
import type { Sequence, StoredAnswer } from '../../store/types';
import { addPathToComponentBlock } from '../../utils/getSequenceFlatMap';
import { useStudyId } from '../../routes/utils';
import { encryptIndex } from '../../utils/encryptDecryptIndex';
import { isDynamicBlock } from '../../parser/utils';
import { getComponentAnswerStatus } from '../../utils/componentCorrectness';
import { studyComponentToIndividualComponent } from '../../utils/handleComponentInheritance';
import { UnknownAnswerIcon } from './UnknownAnswerIcon';
import {
  getDynamicComponentsForBlock,
  getSkipConditionSummariesForBlock,
  getSkippedTrialOrders,
  formatFactorLevel,
} from './StepsPanel.utils';

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

  if (
    'type' in sequence
    && sequence.type === 'factor-runtime-plan'
    && 'conditionComponents' in sequence
    && sequence.conditionComponents
    && typeof sequence.conditionComponents === 'object'
  ) {
    return Object.values(sequence.conditionComponents as Record<string, string[][]>)
      .reduce((total, components) => total + components.length, 0);
  }

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

type ExclusionReason = 'excluded' | 'skipped';

type StepItemBase = {
  label: string;
  indentLevel: number;
  path: string; // Unique path from root for stable keying
  exclusionReason?: ExclusionReason;
  parentExclusionReason?: ExclusionReason;
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
  parameters?: Sequence['parameters'];
  conditional?: boolean;
  numInterruptions?: number;
  numComponentsInSequence?: number;
  numComponentsInStudySequence?: number;
  isLibraryImport?: boolean;
  importedLibraryName?: string;
  childrenRange?: { start: number; end: number }; // Pre-computed indices of children in fullFlatTree
  isExcluded?: boolean; // Block was excluded from participant sequence
  skipSummaries?: string[];
};

type StepItem = ComponentStepItem | BlockStepItem;

type SequenceWithImportReference = Sequence & {
  __revisitImportedSequenceRef?: string;
};

type InspectorSectionName = 'Parameters' | 'Responses' | 'Correct Answer';

function stringifyObjectFields(value: unknown): string {
  const serialized = JSON.stringify(value, null, 2);
  if (!serialized) return '';
  if (!serialized.startsWith('{\n')) return serialized;
  return serialized
    .split('\n')
    .slice(1, -1)
    .map((line) => {
      if (line.startsWith('  ')) return line.slice(2);
      return line;
    })
    .join('\n');
}

function InspectorSection({
  title, id, expanded, onToggle, children,
}: {
  title: InspectorSectionName;
  id: string;
  expanded: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <Box mb="xs">
      <Button
        fullWidth
        variant="subtle"
        justify="space-between"
        aria-expanded={expanded}
        aria-controls={id}
        onClick={onToggle}
      >
        <Text fw={700} size="sm">{title}</Text>
        {expanded ? <IconChevronDown size={16} /> : <IconChevronUp size={16} />}
      </Button>
      <Collapse id={id} expanded={expanded}>
        <Box px="xs">{children}</Box>
      </Collapse>
    </Box>
  );
}

function parseLibraryComponentReference(componentName: string, factorLabels: Map<string, string>) {
  const separator = componentName.includes('.components.')
    ? '.components.'
    : (componentName.includes('.co.') ? '.co.' : false);
  const isLibraryImport = separator !== false && componentName.startsWith('$');
  const label = isLibraryImport ? componentName.split(separator).at(-1)! : factorLabels.get(componentName) ?? componentName;
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
  globalGraph,
  participantSequence,
  participantAnswers,
  studyConfig,
  isAnalysis,
}: {
  globalGraph?: GlobalStoreGraph;
  participantSequence?: Sequence;
  participantAnswers: ParticipantData['answers'];
  studyConfig: StudyConfig;
  isAnalysis?: boolean;
}) {
  // Constants
  const ROW_HEIGHT = 32; // px, fixed height for each row
  const INDENT_SIZE = 24; // px, indentation per level
  const BASE_PADDING = 12; // px, base left padding
  const VIRTUALIZER_OVERSCAN = 10; // number of items to render outside viewport

  // Per-row clamp state, keyed by idx
  const [fullFlatTree, setFullFlatTree] = useState<StepItem[]>([]);
  const [renderedFlatTree, setRenderedFlatTree] = useState<StepItem[]>([]);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [collapsedSections, setCollapsedSections] = useState<Partial<Record<InspectorSectionName, boolean>>>({});
  const highlightedResponseRef = useRef<{ element: HTMLElement; outline: string; outlineOffset: string } | null>(null);
  // Map from item.path -> index in `fullFlatTree` for O(1) range checks
  const fullIndexByPathRef = useRef<Map<string, number>>(new Map());

  const studyId = useStudyId();
  const navigate = useNavigate();
  const location = useLocation();
  const inspectorId = useId();

  const clearResponseHighlight = useCallback(() => {
    if (highlightedResponseRef.current) {
      const { element, outline, outlineOffset } = highlightedResponseRef.current;
      element.style.outline = outline;
      element.style.outlineOffset = outlineOffset;
      highlightedResponseRef.current = null;
    }
  }, []);

  const highlightResponse = useCallback((responseId: string) => {
    clearResponseHighlight();
    const responseElement = document.getElementById(responseId);
    const questionElement = responseElement?.closest<HTMLElement>('[data-question-id]') ?? responseElement;
    if (questionElement) {
      highlightedResponseRef.current = {
        element: questionElement,
        outline: questionElement.style.outline,
        outlineOffset: questionElement.style.outlineOffset,
      };
      questionElement.style.outline = '3px solid var(--mantine-color-blue-5)';
      questionElement.style.outlineOffset = '2px';
    }
  }, [clearResponseHighlight]);

  const fullOrder = useMemo(() => {
    let r = structuredClone(studyConfig.sequence) as Sequence;
    r = addPathToComponentBlock(r, 'root') as Sequence;
    r.components.push('end');
    return r;
  }, [studyConfig.sequence]);

  const factorLabels = useMemo(() => {
    const labels = new Map<string, string>();
    const visit = (block: Sequence & { __revisitFactorLabels?: Record<string, string> }) => {
      if (isDynamicBlock(block)) return;
      Object.entries(block.__revisitFactorLabels ?? {}).forEach(([id, label]) => labels.set(id, label));
      block.components.forEach((child) => {
        if (typeof child !== 'string') visit(child);
      });
    };
    visit(studyConfig.sequence as Sequence);
    return labels;
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

  const skippedTrialOrders = useMemo(() => (participantSequence
    ? getSkippedTrialOrders(participantSequence, participantAnswers, studyConfig, globalGraph)
    : new Set<number>()), [participantAnswers, participantSequence, studyConfig, globalGraph]);

  useEffect(() => {
    let newFlatTree: StepItem[] = [];
    if (participantSequence === undefined) {
      // Browse Components
      newFlatTree = Object.keys(studyConfig.components).map((key) => {
        const {
          label,
          isLibraryImport,
          importedLibraryName,
        } = parseLibraryComponentReference(key, factorLabels);
        const component = studyComponentToIndividualComponent(studyConfig.components[key], studyConfig);

        return {
          type: 'component',
          label,
          indentLevel: 0,
          path: `browse.${key}`,
          href: `/${studyId}/reviewer-${encodeURIComponent(key)}`,
          isLibraryImport,
          importedLibraryName,
          component,
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

      const traverse = (
        node: string | Sequence,
        indentLevel: number,
        parentNode: Sequence,
        parentPath: string,
        dynamic = false,
        parentExclusionReason?: ExclusionReason,
      ) => {
        if (typeof node === 'string') {
          // Check to see if the component is from imported library
          const {
            label,
            isLibraryImport,
            importedLibraryName,
          } = parseLibraryComponentReference(node, factorLabels);
          const component = studyConfig.components[node]
            ? studyComponentToIndividualComponent(studyConfig.components[node], studyConfig)
            : undefined;

          // Generate component identifier for participantAnswers lookup
          const componentIdentifier = dynamic ? `${parentNode.id}_${idx}_${node}_${dynamicIdx}` : `${node}_${idx}`;
          const componentPath = `${parentPath}.${node}_${dynamic ? dynamicIdx : idx}`;
          const isSkipped = !dynamic && skippedTrialOrders.has(idx);

          newFlatTree.push({
            type: 'component',
            label,
            indentLevel,
            path: componentPath,
            isExcluded: isSkipped,
            exclusionReason: isSkipped ? 'skipped' : undefined,
            parentExclusionReason,
            isLibraryImport,
            importedLibraryName,

            // Component Attributes
            href: dynamic ? `/${studyId}/${encryptIndex(idx)}/${encryptIndex(dynamicIdx)}` : `/${studyId}/${encryptIndex(idx)}`,
            isInterruption: (parentNode.interruptions || []).flatMap((intr) => intr.components).includes(node),
            component,
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

        const blockStartIndex = idx;
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
        const isSkippedBlock = numComponentsInSequence > 0
          && Array.from({ length: numComponentsInSequence }, (_, offset) => blockStartIndex + offset)
            .every((trialOrder) => skippedTrialOrders.has(trialOrder));
        const exclusionReason = isSkippedBlock ? 'skipped' : undefined;
        const skipSummaries = getSkipConditionSummariesForBlock(node);

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
          isExcluded: isSkippedBlock,
          exclusionReason,
          parentExclusionReason,

          // Block Attributes
          order: node.order,
          orderPath: node.orderPath,
          parameters: node.parameters,
          conditional: node.conditional,
          numInterruptions: node.components.filter((comp) => typeof comp === 'string' && blockInterruptions.includes(comp)).length,
          numComponentsInSequence,
          numComponentsInStudySequence,
          isLibraryImport: isLibraryBlockImport,
          importedLibraryName: blockImportedLibraryName,
          skipSummaries,
        });

        // Reset dynamicIdx when entering a new dynamic block
        if (node.order === 'dynamic') {
          dynamicIdx = 0;
        }

        // Loop through components, including any dynamic components added via participantAnswers
        const dynamicComponents = getDynamicComponentsForBlock(node, participantAnswers, idx);
        const blockComponents = [...node.components, ...dynamicComponents];
        if (blockComponents.length > 0) {
          blockComponents.forEach((child) => {
            traverse(child, indentLevel + 1, node, blockPath, node.order === 'dynamic', exclusionReason);
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
            } = parseLibraryComponentReference(excludedComponent, factorLabels);
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
              exclusionReason: 'excluded',
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
              exclusionReason: 'excluded',
            });

            // Recursively add excluded block's children as excluded
            const traverseExcluded = (excludedNode: Sequence, excludedIndentLevel: number, excludedParentPath: string) => {
              excludedNode.components.forEach((child) => {
                if (typeof child === 'string') {
                  const {
                    label,
                    isLibraryImport,
                    importedLibraryName,
                  } = parseLibraryComponentReference(child, factorLabels);
                  const childPath = `${excludedParentPath}.${child}_excluded`;

                  newFlatTree.push({
                    type: 'component',
                    label,
                    indentLevel: excludedIndentLevel,
                    path: childPath,
                    parentExclusionReason: 'excluded',
                    isLibraryImport,
                    importedLibraryName,
                    component: studyConfig.components[child],
                    componentName: child,
                    isExcluded: true,
                    exclusionReason: 'excluded',
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
                    parentExclusionReason: 'excluded',
                    order: child.order,
                    orderPath: child.orderPath,
                    numInterruptions: 0,
                    numComponentsInSequence: 0,
                    numComponentsInStudySequence: countComponentsInSequence(child, participantAnswers),
                    isLibraryImport: isChildBlockImport,
                    importedLibraryName: childBlockImportedLibraryName,
                    isExcluded: true,
                    exclusionReason: 'excluded',
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

    // Set full and rendered flat tree
    setFullFlatTree(newFlatTree);
    setRenderedFlatTree(newFlatTree);
  }, [factorLabels, fullOrder, participantAnswers, participantSequence, skippedTrialOrders, studyConfig, studyId]);

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

  const selectedComponent = useMemo(() => {
    const getSelection = (name: string, answer?: StoredAnswer) => {
      const sourceConfig = studyConfig.components[name];
      return sourceConfig
        ? {
          name,
          config: studyComponentToIndividualComponent(sourceConfig, studyConfig),
          answer,
        }
        : undefined;
    };
    if (isAnalysis) {
      const name = decodeURIComponent(location.pathname.split('/').at(-1) ?? '');
      return getSelection(name);
    }
    const activeItem = fullFlatTree.find((item): item is ComponentStepItem => item.type === 'component' && item.href === location.pathname);
    if (activeItem) return getSelection(activeItem.componentName, activeItem.componentAnswer);
    const routeName = decodeURIComponent(location.pathname.split('/').at(-1) ?? '').replace(/^reviewer-/, '');
    return getSelection(routeName);
  }, [fullFlatTree, isAnalysis, location.pathname, studyConfig]);
  const selectedCorrectAnswers = selectedComponent?.answer?.correctAnswer
    ?? selectedComponent?.config.correctAnswer
    ?? [];

  useEffect(() => {
    setCollapsedSections({});
    clearResponseHighlight();
  }, [selectedComponent?.name, clearResponseHighlight]);

  useEffect(() => () => clearResponseHighlight(), [clearResponseHighlight]);

  return (
    <Box
      style={{
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Box
        ref={parentRef}
        style={{
          flex: 1, minHeight: 0, overflow: 'auto', position: 'relative',
        }}
      >
        <Box style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative', width: '100%' }}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const idx = virtualRow.index;
            const item = renderedFlatTree[idx];
            const {
              label,
              indentLevel,
              isExcluded,
              exclusionReason,
              parentExclusionReason,
            } = item;
            const comp = item.type === 'component' ? item : undefined;
            const block = item.type === 'block' ? item : undefined;
            const isComponent = !!comp;
            const isSkipped = exclusionReason === 'skipped';
            const showExclusionBadge = isExcluded && exclusionReason && exclusionReason !== parentExclusionReason;
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
              parameters: blockParameters,
              conditional,
              numInterruptions,
              numComponentsInSequence,
              numComponentsInStudySequence,
              isLibraryImport: isBlockLibraryImport,
              importedLibraryName: blockImportedLibraryName,
              skipSummaries,
            } = (block ?? {}) as Partial<BlockStepItem>;
            const isLibraryImport = isComponent ? isComponentLibraryImport : isBlockLibraryImport;
            const importedLibraryName = isComponent ? componentImportedLibraryName : blockImportedLibraryName;
            const betweenSubjectsEntries = !isComponent && blockParameters
              ? Object.entries(blockParameters)
              : [];
            const betweenSubjectsLabel = betweenSubjectsEntries
              .map(([factorName, factorLevel]) => `${factorName}=${formatFactorLevel(factorLevel)}`)
              .join(', ');
            const resolvedComponent = component
              ? studyComponentToIndividualComponent(component, studyConfig)
              : undefined;
            const correctAnswer = componentAnswer?.correctAnswer ?? resolvedComponent?.correctAnswer;
            const answerStatus = getComponentAnswerStatus(
              componentAnswer,
              correctAnswer,
              resolvedComponent?.response,
            );
            const answerStatusIcon = answerStatus === 'correct'
              ? <IconCheck size={16} style={{ marginRight: 4, flexShrink: 0 }} color="var(--mantine-color-green-text)" />
              : answerStatus === 'incorrect'
                ? <IconX size={16} style={{ marginRight: 4, flexShrink: 0 }} color="var(--mantine-color-red-text)" />
                : answerStatus === 'unknown'
                  ? <UnknownAnswerIcon size={16} style={{ marginRight: 4, flexShrink: 0 }} />
                  : null;
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
                    opacity: isSkipped ? 0.65 : isExcluded ? 0.5 : 1,
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
                        <IconBrain size={16} style={{ marginRight: 4, flexShrink: 0 }} color="var(--mantine-color-orange-text)" />
                      </Tooltip>
                      )}
                      {isLibraryImport && (
                      <Tooltip label={importedLibraryName ? `Imported from ${importedLibraryName}` : 'Package import'} position="right" withArrow>
                        <IconPackageImport size={16} style={{ marginRight: 4, flexShrink: 0 }} color="var(--mantine-color-blue-text)" />
                      </Tooltip>
                      )}
                      {!isComponent && conditional && (
                      <Tooltip label={`Condition: ${label}`} position="right" withArrow>
                        <IconBinaryTree size={16} style={{ marginRight: 4, flexShrink: 0 }} color="var(--mantine-color-green-text)" />
                      </Tooltip>
                      )}
                      {!isComponent && skipSummaries && skipSummaries.length > 0 && (
                      <Tooltip
                        label={skipSummaries.join(' ')}
                        multiline
                        position="right"
                        withArrow
                      >
                        <IconArrowForward size={16} style={{ marginRight: 4, flexShrink: 0 }} color="var(--mantine-color-violet-text)" />
                      </Tooltip>
                      )}
                      {betweenSubjectsEntries.length > 0 && (
                      <Tooltip label={`Between Subjects: ${betweenSubjectsLabel}`} position="right" withArrow>
                        <IconUserPlus size={16} style={{ marginRight: 4, flexShrink: 0 }} color="var(--mantine-color-teal-text)" />
                      </Tooltip>
                      )}
                      {(resolvedComponent?.responseOrder === 'random' || (!participantSequence && componentName && studyConfig.components[componentName]?.responseOrder === 'random')) && (
                      <Tooltip label="Random responses" position="right" withArrow>
                        <IconDice3 size={16} opacity={0.8} style={{ marginRight: 4, flexShrink: 0 }} />
                      </Tooltip>
                      )}
                      {(componentName && componentHasRandomization.get(componentName)) && (
                      <Tooltip label="Random options" position="right" withArrow>
                        <IconDice5 size={16} opacity={0.8} style={{ marginRight: 4, flexShrink: 0 }} />
                      </Tooltip>
                      )}
                      {answerStatusIcon}
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
                      {isComponent && showExclusionBadge && (
                      <Badge ml={5} color="gray" variant="light">
                        {isSkipped ? 'Skipped' : 'Excluded'}
                      </Badge>
                      )}
                      {order === 'random' || order === 'latinSquare' ? (
                        <Tooltip label={order} position="right" withArrow>
                          <IconArrowsShuffle size="15" opacity={0.5} style={{ marginLeft: '5px', verticalAlign: 'middle' }} />
                        </Tooltip>
                      ) : null}
                      {betweenSubjectsEntries.map(([factorName, factorLevel]) => (
                        <Tooltip
                          key={factorName}
                          label={`Between-subjects factor: ${factorName} = ${formatFactorLevel(factorLevel)}`}
                          position="right"
                          withArrow
                        >
                          <Badge ml={5} color="teal" variant="light">
                            {factorName}
                            =
                            {formatFactorLevel(factorLevel)}
                          </Badge>
                        </Tooltip>
                      ))}
                      {!isComponent && !isExcluded && (
                        <Badge ml={5} variant="light">
                          {(numComponentsInSequence || 0) - (numInterruptions || 0)}
                          /
                          {numComponentsInStudySequence}
                        </Badge>
                      )}
                      {!isComponent && showExclusionBadge && (
                        <Badge ml={5} color="gray" variant="light">
                          {isSkipped ? 'Skipped' : 'Excluded'}
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
              </Box>
            );
          })}
        </Box>
      </Box>
      <Box
        data-testid="component-inspector"
        style={{
          flex: `0 1 ${inspectorOpen ? '50%' : 'auto'}`, maxHeight: '50%', minHeight: 0, overflow: 'hidden', borderTop: '1px solid var(--mantine-color-default-border)',
        }}
      >
        <Button
          fullWidth
          variant="subtle"
          justify="space-between"
          aria-label="Component details"
          aria-expanded={inspectorOpen}
          aria-controls={inspectorId}
          onClick={() => {
            setInspectorOpen((open) => !open);
            if (inspectorOpen) clearResponseHighlight();
          }}
        >
          <span>
            Component details
            <Tooltip
              label="Component details allows you to inspect the details of the currently selected component, like responses, parameters and the resolved study configuration. You can expand or collapse this panel to view or hide these details."
              multiline
              w={240}
              withinPortal
              position="top"
            >
              <IconInfoCircle size={16} style={{ marginBottom: -3, marginLeft: 4 }} />
            </Tooltip>
          </span>
          {inspectorOpen ? <IconChevronDown size={16} /> : <IconChevronUp size={16} />}
        </Button>
        <Collapse id={inspectorId} expanded={inspectorOpen} style={{ height: 'calc(100% - 36px)', overflow: 'auto' }}>
          <Box p="xs" style={{ overflow: 'auto', userSelect: 'text' }}>
            {selectedComponent ? (
              <>
                <InspectorSection
                  title="Parameters"
                  id={`${inspectorId}-parameters`}
                  expanded={!collapsedSections.Parameters}
                  onToggle={() => setCollapsedSections((previous) => ({ ...previous, Parameters: !previous.Parameters }))}
                >
                  <Code block>
                    {JSON.stringify(
                      selectedComponent.answer?.parameters ?? selectedComponent.config.parameters ?? {},
                      null,
                      2,
                    )}
                  </Code>
                </InspectorSection>
                <InspectorSection
                  title="Responses"
                  id={`${inspectorId}-responses`}
                  expanded={!collapsedSections.Responses}
                  onToggle={() => setCollapsedSections((previous) => ({ ...previous, Responses: !previous.Responses }))}
                >
                  {selectedComponent.config.response.length > 0
                    ? selectedComponent.config.response.map((response) => (
                      <Box
                        key={response.id}
                        mb={8}
                        onMouseEnter={() => highlightResponse(response.id)}
                        onMouseLeave={clearResponseHighlight}
                      >
                        <Code block>
                          {stringifyObjectFields(response)}
                        </Code>
                      </Box>
                    ))
                    : <Text size="sm" c="dimmed">No responses configured.</Text>}
                </InspectorSection>
                <InspectorSection
                  title="Correct Answer"
                  id={`${inspectorId}-correct-answer`}
                  expanded={!collapsedSections['Correct Answer']}
                  onToggle={() => setCollapsedSections((previous) => ({ ...previous, 'Correct Answer': !previous['Correct Answer'] }))}
                >
                  {selectedCorrectAnswers.length > 0
                    ? selectedCorrectAnswers.map((answer, index) => (
                      <Box key={index} mb={8}>
                        <Code block>{stringifyObjectFields(answer)}</Code>
                      </Box>
                    ))
                    : <Text size="sm" c="dimmed">No correct answer configured.</Text>}
                </InspectorSection>
              </>
            ) : <Text size="sm" c="dimmed">No component is selected.</Text>}
          </Box>
        </Collapse>
      </Box>
    </Box>
  );
}
