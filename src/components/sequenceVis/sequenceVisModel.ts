import type {
  ComponentBlock, Factor, FactorOption, OrderedFactorValues, StudyConfig,
} from '../../parser/types';
import {
  isDynamicBlock, isFactorBlock, isFactorCompiledBlock,
} from '../../parser/utils';
import type { FactorVisualizationMetadata } from '../../parser/utils';
import type { Sequence } from '../../store/types';

export const MAX_VISIBLE_FACTOR_CONDITIONS = 8;

export type SequenceVisualizationMode = 'design' | 'participant';
export type SequenceVisNodeKind = 'component' | 'block' | 'factor' | 'condition' | 'dynamic' | 'overflow';

export type FactorExpressionDetail = {
  label: string;
  summary: string;
  action?: string;
  children: FactorExpressionDetail[];
};

export type SequenceVisNode = {
  key: string;
  path: string;
  kind: SequenceVisNodeKind;
  label: string;
  summary?: string;
  active: boolean;
  order?: ComponentBlock['order'] | 'dynamic';
  numSamples?: number;
  totalConditions?: number;
  selectedConditions?: number;
  factorMetadata?: FactorVisualizationMetadata;
  factorDetails?: FactorExpressionDetail;
  children: SequenceVisNode[];
};

export type PositionedSequenceNode = SequenceVisNode & {
  x: number;
  y: number;
  width: number;
};

export type PositionedSequenceEdge = {
  key: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export type SequenceVisLayout = {
  nodes: PositionedSequenceNode[];
  edges: PositionedSequenceEdge[];
  width: number;
  height: number;
};

const COMPONENT_SPAN = 14;
const NODE_SPAN = 104;
const NODE_GAP = 5;
const VERTICAL_GAP = 48;
const TOP_PADDING = 18;
const SIDE_PADDING = 8;

function isOrderedFactorValues(factor: Factor): factor is OrderedFactorValues {
  return !Array.isArray(factor) && 'values' in factor;
}

function valuePreview(value: unknown): string {
  const serialized = typeof value === 'string' ? value : JSON.stringify(value);
  return serialized.length > 44 ? `${serialized.slice(0, 41)}…` : serialized;
}

function factorValueSummary(values: unknown[]): string {
  const preview = values.slice(0, 3).map(valuePreview).join(', ');
  return `${values.length} level${values.length === 1 ? '' : 's'}${preview ? `: ${preview}${values.length > 3 ? ', …' : ''}` : ''}`;
}

function buildFactorDetails(
  factorOption: FactorOption,
  factors: Record<string, Factor>,
  seen: Set<string>,
  label?: string,
): FactorExpressionDetail {
  if (typeof factorOption === 'string') {
    if (seen.has(factorOption)) {
      return {
        label: label ?? factorOption,
        summary: `Reference to ${factorOption} (recursive)`,
        children: [],
      };
    }
    const definition = factors[factorOption];
    if (!definition) {
      return { label: label ?? factorOption, summary: 'Unknown factor reference', children: [] };
    }
    const nextSeen = new Set(seen);
    nextSeen.add(factorOption);
    if (Array.isArray(definition)) {
      return { label: label ?? factorOption, summary: factorValueSummary(definition), children: [] };
    }
    if (isOrderedFactorValues(definition)) {
      const options: string[] = [definition.order ?? 'fixed'];
      if (definition.numSamples !== undefined) {
        options.push(`${definition.numSamples} sampled`);
      }
      return {
        label: label ?? factorOption,
        summary: `${factorValueSummary(definition.values)} · ${options.join(' · ')}`,
        children: [],
      };
    }
    return buildFactorDetails(definition, factors, nextSeen, label ?? factorOption);
  }

  const { action } = factorOption;
  const expression = factorOption;
  let summary: string = action;
  if (expression.action === 'sample') {
    summary = `${expression.numSamples} ${expression.samplingStrategy === 'withReplacement' ? 'with replacement' : 'without replacement'}`;
  } else if (expression.action === 'repeat') {
    summary = `${expression.numRepeats} repetitions`;
  } else if (expression.action === 'cross' || expression.action === 'zip') {
    summary = expression.as?.length ? `parameters: ${expression.as.join(', ')}` : `${expression.factors.length} inputs`;
  } else if (expression.action === 'keep' || expression.action === 'remove') {
    summary = expression.condition
      ? `where ${Object.entries(expression.condition).map(([key, value]) => `${key}=${valuePreview(value)}`).join(', ')}`
      : 'selected items';
  }

  let childOptions: FactorOption[] = [];
  if ('factors' in expression) {
    childOptions = expression.factors;
  } else {
    childOptions = [expression.factor];
    if (expression.items && !Array.isArray(expression.items)) {
      childOptions.push(expression.items);
    }
  }

  return {
    label: label ?? action,
    action,
    summary,
    children: childOptions.map((child, index) => (
      buildFactorDetails(child, factors, seen, `input ${index + 1}`)
    )),
  };
}

export function getFactorExpressionDetails(
  factor: FactorOption,
  factors: Record<string, Factor>,
): FactorExpressionDetail {
  return buildFactorDetails(factor, factors, new Set());
}

function sequenceByPath(sequence?: Sequence): Map<string, Sequence> {
  const result = new Map<string, Sequence>();
  const visit = (current: Sequence) => {
    result.set(current.orderPath, current);
    current.components.forEach((component) => {
      if (typeof component !== 'string') {
        visit(component);
      }
    });
  };
  if (sequence) {
    visit(sequence);
  }
  return result;
}

function configuredBlocksByPath(sequence: StudyConfig['sequence']): Map<string, StudyConfig['sequence']> {
  const result = new Map<string, StudyConfig['sequence']>();
  const visit = (current: StudyConfig['sequence'], path: string) => {
    result.set(path, current);
    if (isDynamicBlock(current) || isFactorBlock(current)) {
      return;
    }
    current.components.forEach((component, index) => {
      if (typeof component !== 'string') {
        visit(component, `${path}-${index}`);
      }
    });
  };
  visit(sequence, 'root');
  return result;
}

function flattenComponentIds(sequence?: Sequence): string[] {
  if (!sequence) {
    return [];
  }
  return sequence.components.flatMap((component) => (
    typeof component === 'string' ? [component] : flattenComponentIds(component)
  ));
}

function formatConditionId(conditionId: string): string {
  const [, ...parts] = conditionId.split('__');
  if (parts.length === 0) {
    return decodeURIComponent(conditionId);
  }
  return parts.map((part) => {
    const [name, value] = part.split('=');
    return value === undefined
      ? decodeURIComponent(name)
      : `${decodeURIComponent(name)} = ${decodeURIComponent(value)}`;
  }).join(', ');
}

function componentNode(component: string, path: string, active = true): SequenceVisNode {
  return {
    key: path,
    path,
    kind: 'component',
    label: component,
    active,
    children: [],
  };
}

function conditionNodes(
  metadata: FactorVisualizationMetadata,
  participantBlock: Sequence | undefined,
  mode: SequenceVisualizationMode,
  expanded: boolean,
  blockActive: boolean,
): { nodes: SequenceVisNode[], selectedCount: number | undefined } {
  const participantComponents = flattenComponentIds(participantBlock);
  const participantSet = new Set(participantComponents);
  const entries = Object.entries(metadata.conditionComponents);
  const candidateComponents = new Set(entries.flatMap(([, componentIds]) => componentIds));
  const selectedEntries = entries.filter(([, componentIds]) => (
    componentIds.length > 0 && componentIds.every((id) => participantSet.has(id))
  ));
  const displayEntries = mode === 'participant' ? selectedEntries : entries;
  const visibleLimit = expanded ? displayEntries.length : MAX_VISIBLE_FACTOR_CONDITIONS;
  const visibleEntries = displayEntries.slice(0, visibleLimit);
  const nodes = visibleEntries.map(([conditionId, componentIds], index): SequenceVisNode => {
    const selected = componentIds.length > 0 && componentIds.every((id) => participantSet.has(id));
    return {
      key: `${participantBlock?.orderPath ?? 'design'}-${conditionId}-${index}`,
      path: conditionId,
      kind: 'condition',
      label: formatConditionId(conditionId),
      summary: `${componentIds.length} component${componentIds.length === 1 ? '' : 's'}`,
      active: blockActive && (participantBlock ? selected : true),
      children: expanded
        ? componentIds.map((component, componentIndex) => componentNode(
          component,
          `${conditionId}-component-${componentIndex}`,
          participantBlock ? participantSet.has(component) : true,
        ))
        : [],
    };
  });
  if (displayEntries.length > visibleEntries.length) {
    nodes.push({
      key: `${participantBlock?.orderPath ?? 'design'}-factor-overflow`,
      path: `${participantBlock?.orderPath ?? 'design'}-factor-overflow`,
      kind: 'overflow',
      label: `+${displayEntries.length - visibleEntries.length} more`,
      active: true,
      children: [],
    });
  }

  const matchedParticipantComponents = participantComponents.filter((component) => (
    candidateComponents.has(component)
  ));
  const inferredSelectedCount = participantBlock && metadata.baseComponents.length > 0
    ? Math.ceil(matchedParticipantComponents.length / metadata.baseComponents.length)
    : undefined;
  return { nodes, selectedCount: inferredSelectedCount };
}

function factorNode(
  block: ComponentBlock,
  metadata: FactorVisualizationMetadata,
  path: string,
  participantBlock: Sequence | undefined,
  factors: Record<string, Factor>,
  mode: SequenceVisualizationMode,
  expanded: boolean,
  active = true,
): SequenceVisNode {
  const conditions = conditionNodes(metadata, participantBlock, mode, expanded, active);
  const totalConditions = Object.keys(metadata.conditionComponents).length;
  const shouldShowConditions = mode === 'participant' || expanded;
  return {
    key: path,
    path,
    kind: 'factor',
    label: block.id || 'Factor block',
    summary: `${totalConditions} condition${totalConditions === 1 ? '' : 's'}`,
    active,
    order: metadata.order,
    numSamples: metadata.numSamples,
    totalConditions,
    selectedConditions: conditions.selectedCount,
    factorMetadata: metadata,
    factorDetails: getFactorExpressionDetails(metadata.factor, factors),
    children: shouldShowConditions ? conditions.nodes : [],
  };
}

function designNode(
  block: StudyConfig['sequence'],
  path: string,
  participants: Map<string, Sequence>,
  factors: Record<string, Factor>,
  expanded: boolean,
  active = true,
): SequenceVisNode {
  if (isDynamicBlock(block)) {
    return {
      key: path,
      path,
      kind: 'dynamic',
      label: block.id || 'Dynamic block',
      summary: 'Resolved while the participant is running the study',
      active,
      order: 'dynamic',
      children: [],
    };
  }
  if (isFactorBlock(block)) {
    return {
      key: path,
      path,
      kind: 'factor',
      label: block.id,
      summary: 'Uncompiled factor block',
      active,
      children: [],
      factorDetails: getFactorExpressionDetails(block.factor, factors),
    };
  }
  if (isFactorCompiledBlock(block)) {
    return factorNode(
      block,
      block.__revisitFactor,
      path,
      participants.get(path),
      factors,
      'design',
      expanded,
      active,
    );
  }
  const participantBlock = participants.get(path);
  return {
    key: path,
    path,
    kind: 'block',
    label: block.id || (path === 'root' ? 'Study sequence' : 'Sequence block'),
    summary: `${block.components.length} item${block.components.length === 1 ? '' : 's'}`,
    active,
    order: block.order,
    numSamples: block.numSamples,
    children: block.components.map((component, index) => {
      const componentPath = `${path}-${index}`;
      const fallbackActive = block.numSamples === undefined || index < block.numSamples;
      const childActive = active && (participantBlock
        ? (typeof component === 'string'
          ? participantBlock.components.includes(component)
          : participants.has(componentPath))
        : fallbackActive);
      return typeof component === 'string'
        ? componentNode(component, componentPath, childActive)
        : designNode(component, componentPath, participants, factors, expanded, childActive);
    }),
  };
}

function participantNode(
  block: Sequence,
  configured: Map<string, StudyConfig['sequence']>,
  factors: Record<string, Factor>,
  expanded: boolean,
): SequenceVisNode {
  const source = configured.get(block.orderPath);
  if (source && !isDynamicBlock(source) && !isFactorBlock(source) && isFactorCompiledBlock(source)) {
    return factorNode(source, source.__revisitFactor, block.orderPath, block, factors, 'participant', expanded);
  }
  if (block.order === 'dynamic') {
    return {
      key: block.orderPath,
      path: block.orderPath,
      kind: 'dynamic',
      label: block.id || 'Dynamic block',
      summary: block.components.length > 0 ? 'Resolved participant block' : 'Waiting for runtime resolution',
      active: true,
      order: 'dynamic',
      children: block.components.map((component, index) => (
        typeof component === 'string'
          ? componentNode(component, `${block.orderPath}-${index}`)
          : participantNode(component, configured, factors, expanded)
      )),
    };
  }
  return {
    key: block.orderPath,
    path: block.orderPath,
    kind: 'block',
    label: block.id || (block.orderPath === 'root' ? 'Participant sequence' : 'Sequence block'),
    summary: `${block.components.length} realized item${block.components.length === 1 ? '' : 's'}`,
    active: true,
    order: block.order,
    children: block.components.map((component, index) => (
      typeof component === 'string'
        ? componentNode(component, `${block.orderPath}-realized-${index}`)
        : participantNode(component, configured, factors, expanded)
    )),
  };
}

export function buildSequenceVisualization(
  configuredSequence: StudyConfig['sequence'],
  participantSequence: Sequence | undefined,
  factors: Record<string, Factor>,
  mode: SequenceVisualizationMode,
  expandedFactors: boolean,
): SequenceVisNode {
  if (mode === 'participant' && participantSequence) {
    return participantNode(
      participantSequence,
      configuredBlocksByPath(configuredSequence),
      factors,
      expandedFactors,
    );
  }
  return designNode(
    configuredSequence,
    'root',
    sequenceByPath(participantSequence),
    factors,
    expandedFactors,
  );
}

function nodeWidth(node: SequenceVisNode): number {
  return node.kind === 'component' ? COMPONENT_SPAN : NODE_SPAN;
}

export function layoutSequenceVisualization(
  root: SequenceVisNode,
  minimumWidth: number,
): SequenceVisLayout {
  const subtreeWidths = new Map<SequenceVisNode, number>();
  const getSubtreeWidth = (node: SequenceVisNode): number => {
    const cached = subtreeWidths.get(node);
    if (cached !== undefined) {
      return cached;
    }
    const childrenWidth = node.children.length === 0
      ? 0
      : node.children.reduce((total, child) => total + getSubtreeWidth(child), 0)
        + (NODE_GAP * (node.children.length - 1));
    const result = Math.max(nodeWidth(node), childrenWidth);
    subtreeWidths.set(node, result);
    return result;
  };
  const contentWidth = getSubtreeWidth(root);
  const width = Math.max(minimumWidth, contentWidth + (SIDE_PADDING * 2));
  const nodes: PositionedSequenceNode[] = [];
  const edges: PositionedSequenceEdge[] = [];
  let maxDepth = 0;

  const place = (node: SequenceVisNode, left: number, depth: number, parent?: PositionedSequenceNode) => {
    maxDepth = Math.max(maxDepth, depth);
    const span = getSubtreeWidth(node);
    const positioned: PositionedSequenceNode = {
      ...node,
      x: left + (span / 2),
      y: TOP_PADDING + (depth * VERTICAL_GAP),
      width: nodeWidth(node),
    };
    nodes.push(positioned);
    if (parent) {
      edges.push({
        key: `${parent.key}->${node.key}`,
        x1: parent.x,
        y1: parent.y,
        x2: positioned.x,
        y2: positioned.y,
      });
    }
    let childLeft = left;
    node.children.forEach((child) => {
      place(child, childLeft, depth + 1, positioned);
      childLeft += getSubtreeWidth(child) + NODE_GAP;
    });
  };

  place(root, (width - contentWidth) / 2, 0);
  return {
    nodes,
    edges,
    width,
    height: TOP_PADDING + (maxDepth * VERTICAL_GAP) + 24,
  };
}
