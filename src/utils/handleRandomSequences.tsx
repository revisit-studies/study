import latinSquare from '@quentinroy/latin-square';
import isEqual from 'lodash.isequal';
import {
  ComponentBlock, ParserErrorWarning,
  DynamicBlock,
  FactorBlock,
  FactorObject,
  FactorObjectValue,
  FactorPrimitive,
  RandomInterruption,
  StudyConfig,
} from '../parser/types';
import {
  createFactorOrderContext, createFactorConditionId, resolveOrderedFactorConditions,
} from '../parser/libraryParser';
import { Sequence } from '../store/types';
import {
  FactorPlanBlock, FactorRuntimePlanBlock, isDynamicBlock, isFactorBlock, isFactorPlanBlock, isFactorRuntimePlanBlock,
} from '../parser/utils';
import { getComponent } from './handleComponentInheritance';

type SequenceBlock = ComponentBlock | DynamicBlock | FactorBlock | FactorRuntimePlanBlock;
type CompiledSequenceBlock = ComponentBlock | DynamicBlock | FactorBlock | FactorPlanBlock | FactorRuntimePlanBlock;
type BetweenSubjectsFactorLevel = FactorPrimitive | FactorObject;
type BetweenSubjectsFactorLevels = { factorName: string; levels: BetweenSubjectsFactorLevel[] };
type BetweenSubjectsAssignment = Record<string, BetweenSubjectsFactorLevel>;

function isBetweenSubjectsObjectLevel(value: BetweenSubjectsFactorLevel): value is FactorObject {
  return typeof value === 'object' && !Array.isArray(value);
}

function getBetweenSubjectsMatchParameters(
  assignment: BetweenSubjectsAssignment,
): Record<string, FactorObjectValue> {
  return Object.entries(assignment).reduce<Record<string, FactorObjectValue>>(
    (parameters, [factorName, level]) => (
      isBetweenSubjectsObjectLevel(level)
        ? { ...parameters, ...level }
        : { ...parameters, [factorName]: level }
    ),
    {},
  );
}

function getBetweenSubjectsRuntimeParameters(
  assignment: BetweenSubjectsAssignment,
): Record<string, unknown> {
  return {
    ...getBetweenSubjectsMatchParameters(assignment),
    ...assignment,
  };
}

function shuffle<T>(array: T[]) {
  let currentIndex = array.length;

  // While there remain elements to shuffle...
  while (currentIndex !== 0) {
    // Pick a remaining element...
    const randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;

    // And swap it with the current element.
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex], array[currentIndex]];
  }
}

function getBetweenSubjectsFactorLevels(config: StudyConfig): BetweenSubjectsFactorLevels[] {
  return config.betweenSubjects?.flatMap((factorName) => {
    const factor = config.factors?.[factorName];

    if (
      !Array.isArray(factor)
      || factor.length === 0
      || !factor.every((level) => (
        typeof level !== 'object' || (level !== null && !Array.isArray(level))
      ))
    ) {
      return [];
    }

    return [{ factorName, levels: factor as BetweenSubjectsFactorLevel[] }];
  }) || [];
}

function combineBetweenSubjectsAssignments(
  factorLevels: BetweenSubjectsFactorLevels[],
  currentAssignment: BetweenSubjectsAssignment = {},
): BetweenSubjectsAssignment[] {
  const [currentFactor, ...remainingFactors] = factorLevels;

  if (!currentFactor) {
    return [currentAssignment];
  }

  return currentFactor.levels.flatMap((level) => combineBetweenSubjectsAssignments(
    remainingFactors,
    { ...currentAssignment, [currentFactor.factorName]: level },
  ));
}

function getBetweenSubjectsAssignments(config: StudyConfig): BetweenSubjectsAssignment[] {
  const factorLevels = getBetweenSubjectsFactorLevels(config);

  if (factorLevels.length === 0) {
    return [{}];
  }

  return combineBetweenSubjectsAssignments(factorLevels);
}

function getComponentParameters(
  componentName: string,
  config: StudyConfig,
): Record<string, unknown> | undefined {
  const component = getComponent(componentName, config);

  if (component && typeof component === 'object' && 'parameters' in component && component.parameters && typeof component.parameters === 'object' && !Array.isArray(component.parameters)) {
    return component.parameters;
  }

  return undefined;
}

function componentMatchesBetweenSubjectsAssignment(
  componentName: string,
  config: StudyConfig,
  assignment: BetweenSubjectsAssignment,
): boolean {
  const parameters = getComponentParameters(componentName, config);
  const matchParameters = getBetweenSubjectsMatchParameters(assignment);

  return Object.entries(matchParameters).every(([factorName, factorLevel]) => (
    parameters?.[factorName] === undefined || isEqual(parameters[factorName], factorLevel)
  ));
}

function parametersMatchBetweenSubjectsAssignment(
  parameters: Record<string, unknown> | undefined,
  assignment: BetweenSubjectsAssignment,
): boolean {
  const matchParameters = getBetweenSubjectsMatchParameters(assignment);
  return Object.entries(matchParameters).every(([factorName, factorLevel]) => (
    parameters?.[factorName] === undefined || isEqual(parameters[factorName], factorLevel)
  ));
}

function filterSequenceByBetweenSubjectsAssignment(
  sequence: Sequence,
  config: StudyConfig,
  assignment: BetweenSubjectsAssignment,
): Sequence {
  if (!parametersMatchBetweenSubjectsAssignment(sequence.parameters, assignment)) {
    return {
      ...sequence,
      components: [],
    };
  }

  const components = sequence.components.flatMap((component): Sequence['components'] => {
    if (typeof component === 'string') {
      return componentMatchesBetweenSubjectsAssignment(component, config, assignment)
        ? [component]
        : [];
    }

    const filteredComponent = filterSequenceByBetweenSubjectsAssignment(component, config, assignment);
    return filteredComponent.order === 'dynamic' || filteredComponent.components.length > 0
      ? [filteredComponent]
      : [];
  });

  const parameters = Object.keys(assignment).length > 0
    ? { ...(sequence.parameters || {}), ...getBetweenSubjectsRuntimeParameters(assignment) }
    : sequence.parameters;

  return {
    ...sequence,
    components,
    ...(parameters ? { parameters } : {}),
  };
}

function filterCompiledSequenceByBetweenSubjectsAssignment(
  order: CompiledSequenceBlock,
  config: StudyConfig,
  assignment: BetweenSubjectsAssignment,
): CompiledSequenceBlock {
  if (isDynamicBlock(order) || isFactorBlock(order) || isFactorRuntimePlanBlock(order)) {
    return order;
  }

  const components = order.components.flatMap((component): (string | CompiledSequenceBlock)[] => {
    if (typeof component === 'string') {
      return componentMatchesBetweenSubjectsAssignment(component, config, assignment)
        ? [component]
        : [];
    }

    const filteredComponent = filterCompiledSequenceByBetweenSubjectsAssignment(
      component,
      config,
      assignment,
    );
    return isDynamicBlock(filteredComponent)
      || isFactorBlock(filteredComponent)
      || isFactorRuntimePlanBlock(filteredComponent)
      || filteredComponent.components.length > 0
      ? [filteredComponent]
      : [];
  });

  return { ...order, components } as CompiledSequenceBlock;
}

type UniqueComponentEntry = { component: SequenceBlock; indices: number[] };

function findMatchingUnique(
  component: SequenceBlock,
  uniqueComponents: UniqueComponentEntry[],
): UniqueComponentEntry | null {
  for (const unique of uniqueComponents) {
    if (isEqual(unique.component, component)) {
      return unique;
    }
  }
  return null;
}

function findUniqueComponents(
  components: (string | SequenceBlock)[],
  includeDynamicBlocks = true,
): UniqueComponentEntry[] {
  const uniqueComponents: UniqueComponentEntry[] = [];

  for (let j = 0; j < components.length; j += 1) {
    const comp = components[j];
    if (typeof comp !== 'string' && !Array.isArray(comp) && (includeDynamicBlocks || !isDynamicBlock(comp))) {
      const existing = findMatchingUnique(comp, uniqueComponents);
      if (existing) {
        existing.indices.push(j);
      } else {
        uniqueComponents.push({ component: comp, indices: [j] });
      }
    }
  }
  return uniqueComponents;
}

function generateLatinSquare(config: StudyConfig, path: string) {
  const pathArr = path.split('-');

  let locationInSequence: StudyConfig['sequence'] | string = config.sequence;
  pathArr.forEach((p) => {
    if (p === 'root') {
      locationInSequence = config.sequence;
    } else {
      if (
        typeof locationInSequence === 'string'
        || isDynamicBlock(locationInSequence)
        || isFactorBlock(locationInSequence)
      ) {
        return;
      }
      locationInSequence = locationInSequence.components[+p];
    }
  });

  if (typeof locationInSequence === 'string' || isDynamicBlock(locationInSequence) || isFactorBlock(locationInSequence)) {
    return [];
  }
  const options = locationInSequence.components.map((c: unknown, i: number) => (typeof c === 'string' ? c : `_componentBlock${i}`));
  shuffle(options);
  const newSquare: string[][] = latinSquare<string>(options, true);
  return newSquare;
}

function generateLatinSquareRows(config: StudyConfig, path: string, minimumRowCount: number): string[][] {
  const rows: string[][] = [];
  while (rows.length < minimumRowCount) {
    const square = generateLatinSquare(config, path);
    if (square.length === 0) {
      return rows;
    }
    rows.push(...square);
  }
  return rows;
}

function insertRandomInterruptions<T>(
  components: (string | T)[],
  randomInterruptions: RandomInterruption[],
) {
  const totalInterruptions = randomInterruptions
    .reduce((count, interruption) => count + interruption.numInterruptions, 0);

  if (totalInterruptions > components.length - 1) {
    throw new Error('Number of interruptions cannot be greater than the number of available interruption slots');
  }

  const availableLocations = Array.from(
    { length: components.length - 1 },
    (_, index) => index + 1,
  );
  shuffle(availableLocations);

  const interruptionsByLocation = new Map<number, string[][]>();
  randomInterruptions.forEach((interruption) => {
    for (let i = 0; i < interruption.numInterruptions; i += 1) {
      const randomLocation = availableLocations.pop();

      if (randomLocation === undefined) {
        throw new Error('Number of interruptions cannot be greater than the number of available interruption slots');
      }

      const interruptionsAtLocation = interruptionsByLocation.get(randomLocation) || [];
      interruptionsAtLocation.push(interruption.components);
      interruptionsByLocation.set(randomLocation, interruptionsAtLocation);
    }
  });

  const newComponents: (string | T)[] = [];
  for (let i = 0; i < components.length; i += 1) {
    interruptionsByLocation.get(i)?.forEach((interruptionComponents) => {
      newComponents.push(...interruptionComponents);
    });
    newComponents.push(components[i]);
  }

  return newComponents;
}

function _componentBlockToSequence(
  order: StudyConfig['sequence'],
  latinSquareObject: Record<string, string[][]>,
  latinSquareRowIndex: number,
  path: string,
  factorOrderContext = createFactorOrderContext(latinSquareRowIndex),
  assignmentParameters?: Record<string, unknown>,
): Sequence {
  if (isDynamicBlock(order)) {
    return {
      id: order.id,
      orderPath: path,
      order: order.order,
      components: [],
      skip: [],
      interruptions: [],
      conditional: order.conditional,
    };
  }

  if (isFactorBlock(order)) {
    return {
      id: order.id,
      orderPath: path,
      order: order.order ?? 'fixed',
      components: [],
      skip: [],
      interruptions: [],
    };
  }

  if (isFactorRuntimePlanBlock(order)) {
    const errors: ParserErrorWarning[] = [];
    const conditions = resolveOrderedFactorConditions(
      order.factor,
      order.factors,
      factorOrderContext,
      errors,
      order.id,
      assignmentParameters,
    );
    if (errors.length > 0) {
      throw new Error(errors.map((error) => error.message).join('\n'));
    }
    const components = conditions.flatMap((condition) => (
      order.conditionComponents[createFactorConditionId(order.id, condition)] || []
    ));
    const resolvedOrder: ComponentBlock = {
      id: order.id,
      order: 'fixed',
      components,
      skip: order.skip || [],
      interruptions: order.interruptions || [],
      conditional: order.conditional,
    };
    return _componentBlockToSequence(
      resolvedOrder,
      latinSquareObject,
      latinSquareRowIndex,
      path,
      factorOrderContext,
      assignmentParameters,
    );
  }

  let computedComponents = order.components;

  if (order.order === 'random') {
    const randomArr = structuredClone(order.components);

    shuffle(randomArr);

    computedComponents = randomArr;
  } else if (order.order === 'latinSquare' && latinSquareObject) {
    const latinSquareRows = latinSquareObject[path];
    const latinSquareRow = latinSquareRows?.[latinSquareRowIndex % latinSquareRows.length];

    if (!latinSquareRow) {
      throw new Error(
        `Latin square is unavailable for path: ${path}.`,
      );
    }

    computedComponents = latinSquareRow.map((o) => {
      if (o.startsWith('_componentBlock')) {
        return order.components[+o.slice('_componentBlock'.length)];
      }

      return o;
    });
  }

  computedComponents = computedComponents.slice(0, order.numSamples);

  // Pre-build a list of unique components with their indices to avoid O(n²) isEqual comparisons
  // Since structuredClone breaks reference equality, we need to use value equality
  const uniqueComponents = findUniqueComponents(order.components);

  // Track how many times we've seen each unique component
  const seenCounts = new Map<SequenceBlock, number>();
  let sequenceComponents: Sequence['components'] = [];

  for (let i = 0; i < computedComponents.length; i += 1) {
    const curr = computedComponents[i];
    if (typeof curr === 'string') {
      sequenceComponents.push(curr);
    } else if (!Array.isArray(curr)) {
      const matchedUnique = findMatchingUnique(curr, uniqueComponents);

      if (matchedUnique) {
        const seenCount = seenCounts.get(matchedUnique.component) || 0;
        const actualIndex = matchedUnique.indices[seenCount] ?? matchedUnique.indices[0];
        seenCounts.set(matchedUnique.component, seenCount + 1);

        const childSequence = _componentBlockToSequence(
          curr,
          latinSquareObject,
          latinSquareRowIndex,
          `${path}-${actualIndex}`,
          factorOrderContext,
          assignmentParameters,
        );
        if (isFactorPlanBlock(curr)) {
          sequenceComponents.push(...childSequence.components);
        } else {
          sequenceComponents.push(childSequence);
        }
      } else {
        // This should never happen - all component blocks should be in uniqueComponents
        throw new Error(`Unexpected: component block not found in uniqueComponents map at path ${path}`);
      }
    }
  }

  // If we have a break, insert it into the sequence at the correct intervals
  if (order.interruptions) {
    for (let interruptionIndex = 0; interruptionIndex < order.interruptions.length; interruptionIndex += 1) {
      const interruption = order.interruptions[interruptionIndex];
      const newComponents: Sequence['components'] = [];
      if (interruption.spacing !== 'random') {
        for (let i = 0; i < sequenceComponents.length; i += 1) {
          if (
            i === interruption.firstLocation
            || (i > interruption.firstLocation && i % interruption.spacing === 0)
          ) {
            newComponents.push(...interruption.components);
          }
          newComponents.push(sequenceComponents[i]);
        }

        sequenceComponents = newComponents;
      } else {
        const groupedRandomInterruptions: RandomInterruption[] = [interruption];
        while (
          interruptionIndex + 1 < order.interruptions.length
          && order.interruptions[interruptionIndex + 1].spacing === 'random'
        ) {
          interruptionIndex += 1;
          groupedRandomInterruptions.push(order.interruptions[interruptionIndex] as RandomInterruption);
        }

        sequenceComponents = insertRandomInterruptions(sequenceComponents, groupedRandomInterruptions);
      }
    }
  }

  return {
    id: order.id,
    orderPath: path,
    order: order.order,
    components: sequenceComponents,
    skip: order.skip || [],
    interruptions: order.interruptions || [],
    conditional: order.conditional,
  };
}

function componentBlockToSequence(
  order: StudyConfig['sequence'],
  latinSquareObject: Record<string, string[][]>,
  latinSquareRowIndex: number,
  assignmentParameters?: Record<string, unknown>,
): Sequence {
  return _componentBlockToSequence(
    order,
    latinSquareObject,
    latinSquareRowIndex,
    'root',
    createFactorOrderContext(latinSquareRowIndex),
    assignmentParameters,
  );
}

function _createRandomOrders(order: StudyConfig['sequence'], paths: string[], path: string, index: number) {
  const newPath = path.length > 0 ? `${path}-${index}` : 'root';
  if (isDynamicBlock(order) || isFactorBlock(order)) {
    return;
  }

  if (order.order === 'latinSquare') {
    paths.push(newPath);
  }

  order.components.forEach((comp, i) => {
    if (typeof comp !== 'string' && !isDynamicBlock(comp) && !isFactorBlock(comp)) {
      _createRandomOrders(comp, paths, newPath, i);
    }
  });
}

function createRandomOrders(order: StudyConfig['sequence']) {
  const paths: string[] = [];
  _createRandomOrders(order, paths, '', 0);

  return paths;
}

/**
 * Count how many times each latin square path will be accessed during a single sequence generation.
 * This is needed to pre-generate enough latin square rows to avoid refilling mid-sequence.
 *
 * This mirrors the logic in _componentBlockToSequence to ensure accurate counting.
 */
function _countPathUsage(
  order: StudyConfig['sequence'],
  pathCounts: Record<string, number>,
  path: string,
): void {
  if (isDynamicBlock(order) || isFactorBlock(order)) {
    return;
  }

  if (order.order === 'latinSquare') {
    pathCounts[path] = (pathCounts[path] || 0) + 1;
  }

  // Get the components that will actually be processed
  let computedComponents = order.components;

  // Apply numSamples if present
  if (order.numSamples !== undefined) {
    computedComponents = computedComponents.slice(0, order.numSamples);
  }

  // Count recursively for nested blocks
  // Pre-build a list of unique components with their indices (same approach as _componentBlockToSequence)
  const uniqueComponents = findUniqueComponents(order.components, false);

  // Track how many times we've seen each unique component
  const seenCounts = new Map<SequenceBlock, number>();

  for (let i = 0; i < computedComponents.length; i += 1) {
    const curr = computedComponents[i];
    if (
      typeof curr !== 'string'
      && !Array.isArray(curr)
      && !isDynamicBlock(curr)
      && !isFactorBlock(curr)
    ) {
      const matchedUnique = findMatchingUnique(curr, uniqueComponents);

      if (matchedUnique) {
        const seenCount = seenCounts.get(matchedUnique.component) || 0;
        const actualIndex = matchedUnique.indices[seenCount] ?? matchedUnique.indices[0];
        seenCounts.set(matchedUnique.component, seenCount + 1);

        _countPathUsage(curr, pathCounts, `${path}-${actualIndex}`);
      } else {
        // Fallback: shouldn't happen, but handle it
        _countPathUsage(curr, pathCounts, `${path}-0`);
      }
    }
  }
}

function countPathUsage(order: StudyConfig['sequence']): Record<string, number> {
  const pathCounts: Record<string, number> = {};
  _countPathUsage(order, pathCounts, 'root');
  return pathCounts;
}

export function generateSequenceArray(config: StudyConfig): Sequence[] {
  const betweenSubjectsAssignments = getBetweenSubjectsAssignments(config);
  const numSequences = config.uiConfig.numSequences || 1000;
  const assignmentCount = betweenSubjectsAssignments.length;
  const latinSquareRowCount = Math.ceil(numSequences / assignmentCount);
  const assignedSequences = betweenSubjectsAssignments.map((assignment) => (
    filterCompiledSequenceByBetweenSubjectsAssignment(
      config.sequence as CompiledSequenceBlock,
      config,
      assignment,
    ) as StudyConfig['sequence']
  ));
  const latinSquareCache = new Map<string, Record<string, string[][]>>();
  const latinSquareObjects = assignedSequences.map((assignedSequence) => {
    const cacheKey = JSON.stringify(assignedSequence);
    const cached = latinSquareCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const assignedConfig = { ...config, sequence: assignedSequence };
    const paths = createRandomOrders(assignedSequence);
    const pathUsageCounts = countPathUsage(assignedSequence);
    // One Latin-square row is shared by assignments with the same eligible sequence shape.
    const latinSquareObject: Record<string, string[][]> = paths
      .map((p) => {
        const usageCount = pathUsageCounts[p] || 1;
        return { [p]: generateLatinSquareRows(assignedConfig, p, latinSquareRowCount * usageCount) };
      })
      .reduce((acc, curr) => ({ ...acc, ...curr }), {});
    latinSquareCache.set(cacheKey, latinSquareObject);
    return latinSquareObject;
  });

  const sequenceArray: Sequence[] = [];
  Array.from({ length: numSequences }).forEach((_, sequenceIndex) => {
    const assignmentIndex = sequenceIndex % assignmentCount;
    const betweenSubjectsAssignment = betweenSubjectsAssignments[assignmentIndex] || {};
    // Advance only after every between-subject assignment has received the current row.
    const latinSquareRowIndex = Math.floor(sequenceIndex / assignmentCount);
    const assignedSequence = assignedSequences[assignmentIndex];
    const latinSquareObject = latinSquareObjects[assignmentIndex];

    // Generate a sequence
    let sequence = componentBlockToSequence(
      assignedSequence,
      latinSquareObject,
      latinSquareRowIndex,
      getBetweenSubjectsRuntimeParameters(betweenSubjectsAssignment),
    );
    if (Object.keys(betweenSubjectsAssignment).length > 0) {
      sequence = filterSequenceByBetweenSubjectsAssignment(
        sequence,
        config,
        betweenSubjectsAssignment,
      );
    }
    sequence.components.push('end');

    // Add the sequence to the array
    sequenceArray.push(sequence);
  });

  return sequenceArray;
}
