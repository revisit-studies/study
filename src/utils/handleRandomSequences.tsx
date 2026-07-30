import latinSquare from '@quentinroy/latin-square';
import isEqual from 'lodash.isequal';
import {
  ComponentBlock,
  DynamicBlock,
  FactorBlock,
  FactorValue,
  RandomInterruption,
  StudyConfig,
} from '../parser/types';
import { Sequence } from '../store/types';
import { isDynamicBlock, isFactorBlock } from '../parser/utils';

type SequenceBlock = ComponentBlock | DynamicBlock | FactorBlock;
type BetweenSubjectsFactorLevels = { factorName: string; levels: FactorValue[] };
type BetweenSubjectsAssignment = Record<string, FactorValue>;

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

    if (!Array.isArray(factor) || factor.length === 0) {
      return [];
    }

    return [{ factorName, levels: factor }];
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
  const component = config.components[componentName];

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

  return Object.entries(assignment).every(([factorName, factorLevel]) => (
    parameters?.[factorName] === undefined || parameters[factorName] === factorLevel
  ));
}

function parametersMatchBetweenSubjectsAssignment(
  parameters: Record<string, unknown> | undefined,
  assignment: BetweenSubjectsAssignment,
): boolean {
  return Object.entries(assignment).every(([factorName, factorLevel]) => (
    parameters?.[factorName] === undefined || parameters[factorName] === factorLevel
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
    ? { ...(sequence.parameters || {}), ...assignment }
    : sequence.parameters;

  return {
    ...sequence,
    components,
    ...(parameters ? { parameters } : {}),
  };
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

function insertRandomInterruptions(
  components: (string | SequenceBlock)[],
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

  const newComponents: (string | SequenceBlock)[] = [];
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

  for (let i = 0; i < computedComponents.length; i += 1) {
    const curr = computedComponents[i];
    if (typeof curr !== 'string' && !Array.isArray(curr)) {
      const matchedUnique = findMatchingUnique(curr, uniqueComponents);

      if (matchedUnique) {
        const seenCount = seenCounts.get(matchedUnique.component) || 0;
        const actualIndex = matchedUnique.indices[seenCount] ?? matchedUnique.indices[0];
        seenCounts.set(matchedUnique.component, seenCount + 1);

        computedComponents[i] = _componentBlockToSequence(
          curr,
          latinSquareObject,
          latinSquareRowIndex,
          `${path}-${actualIndex}`,
        ) as unknown as ComponentBlock;
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
      const newComponents: (string | SequenceBlock)[] = [];
      if (interruption.spacing !== 'random') {
        for (let i = 0; i < computedComponents.length; i += 1) {
          if (
            i === interruption.firstLocation
            || (i > interruption.firstLocation && i % interruption.spacing === 0)
          ) {
            newComponents.push(...interruption.components);
          }
          newComponents.push(computedComponents[i]);
        }

        computedComponents = newComponents;
      } else {
        const groupedRandomInterruptions: RandomInterruption[] = [interruption];
        while (
          interruptionIndex + 1 < order.interruptions.length
          && order.interruptions[interruptionIndex + 1].spacing === 'random'
        ) {
          interruptionIndex += 1;
          groupedRandomInterruptions.push(order.interruptions[interruptionIndex] as RandomInterruption);
        }

        computedComponents = insertRandomInterruptions(computedComponents, groupedRandomInterruptions);
      }
    }
  }

  return {
    id: order.id,
    orderPath: path,
    order: order.order,
    components: computedComponents.flat() as Sequence['components'],
    skip: order.skip || [],
    interruptions: order.interruptions || [],
    conditional: order.conditional,
    parameters: order.parameters,
  };
}

function componentBlockToSequence(
  order: StudyConfig['sequence'],
  latinSquareObject: Record<string, string[][]>,
  latinSquareRowIndex: number,
): Sequence {
  return _componentBlockToSequence(order, latinSquareObject, latinSquareRowIndex, 'root');
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
  const paths = createRandomOrders(config.sequence);
  const pathUsageCounts = countPathUsage(config.sequence);
  const betweenSubjectsAssignments = getBetweenSubjectsAssignments(config);
  const numSequences = config.uiConfig.numSequences || 1000;
  const assignmentCount = betweenSubjectsAssignments.length;
  const latinSquareRowCount = Math.ceil(numSequences / assignmentCount);

  // One Latin-square row is shared by every between-subject assignment in a batch.
  // This crosses ordering with the between-subject design instead of balancing only globally.
  const latinSquareObject: Record<string, string[][]> = paths
    .map((p) => {
      const usageCount = pathUsageCounts[p] || 1;
      return { [p]: generateLatinSquareRows(config, p, latinSquareRowCount * usageCount) };
    })
    .reduce((acc, curr) => ({ ...acc, ...curr }), {});

  const sequenceArray: Sequence[] = [];
  Array.from({ length: numSequences }).forEach((_, sequenceIndex) => {
    const betweenSubjectsAssignment = betweenSubjectsAssignments[sequenceIndex % assignmentCount] || {};
    // Advance only after every between-subject assignment has received the current row.
    const latinSquareRowIndex = Math.floor(sequenceIndex / assignmentCount);

    // Generate a sequence
    let sequence = componentBlockToSequence(
      config.sequence,
      latinSquareObject,
      latinSquareRowIndex,
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
