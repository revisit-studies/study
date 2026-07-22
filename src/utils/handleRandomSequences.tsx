import latinSquare from '@quentinroy/latin-square';
import isEqual from 'lodash.isequal';
import {
  ComponentBlock,
  DynamicBlock,
  Factor,
  FactorDefinition,
  FactorSequence,
  FactorSequenceReference,
  RandomInterruption,
  StudyConfig,
} from '../parser/types';
import { Sequence } from '../store/types';
import {
  isDynamicBlock, isFactorDefinition, isFactorSequence, isFactorSequenceReference,
} from '../parser/utils';

type SequenceBlock = ComponentBlock | DynamicBlock | FactorSequence | FactorSequenceReference;
export type FactorCombination = [string, Record<string, string>];
type FactorValue = string | FactorCombination;
type FactorCombinationBlock = FactorDefinition & { id: string };
type BetweenSubjectsFactorLevels = { factorName: string; levels: string[] };
type BetweenSubjectsAssignment = Record<string, string>;
type FactorCombinationOptions = {
  expandPossibleSamples?: boolean;
  ignoreNumSamples?: boolean;
  randomizeSamples?: boolean;
};

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

function isFactorCombination(value: FactorValue): value is FactorCombination {
  return Array.isArray(value);
}

function factorValueName(value: FactorValue): string {
  return isFactorCombination(value) ? value[0] : value;
}

function factorCombinationParameterValue(value: FactorCombination): string {
  return value[0].startsWith('_') ? value[0].slice(1) : value[0];
}

function factorValueParameters(
  value: FactorValue,
  depth: number,
  depthToFactorMap: Record<number, string>,
): Record<string, string> {
  const factorName = depthToFactorMap[depth];

  if (isFactorCombination(value)) {
    if (factorName !== undefined) {
      return { [factorName]: factorCombinationParameterValue(value), ...value[1] };
    }

    return value[1];
  }

  return factorName !== undefined ? { [factorName]: value } : {};
}

function appendFactorValueName(currentComponent: string, valueName: string): string {
  const normalizedValueName = valueName.startsWith('_') ? valueName.slice(1) : valueName;
  return `${currentComponent}_${normalizedValueName}`;
}

function factorDefinitionToCombinationBlock(id: string, definition: FactorDefinition): FactorCombinationBlock {
  return {
    id,
    action: definition.action,
    order: definition.order,
    numRepeats: definition.numRepeats,
    factorsToCross: definition.factorsToCross,
    ...(definition.parameters !== undefined ? { parameters: definition.parameters } : {}),
  };
}

function getBetweenSubjectsFactorLevels(config: StudyConfig): BetweenSubjectsFactorLevels[] {
  return config.betweenSubjectsFactors?.flatMap((factorName) => {
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

function getFactorsForBetweenSubjectsAssignment(
  factors: NonNullable<StudyConfig['factors']>,
  assignment: BetweenSubjectsAssignment,
): NonNullable<StudyConfig['factors']> {
  const assignedFactors = { ...factors };

  Object.entries(assignment).forEach(([factorName, factorLevel]) => {
    if (Array.isArray(assignedFactors[factorName])) {
      assignedFactors[factorName] = [factorLevel];
    }
  });

  return assignedFactors;
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

function applyFactorNumSamples(
  values: FactorValue[],
  numSamples?: number,
  order?: FactorDefinition['order'],
  options: FactorCombinationOptions = {},
): FactorValue[] {
  if (options.ignoreNumSamples || numSamples === undefined) {
    return values;
  }

  if (values.length === 0) {
    return [];
  }

  const sampleValues = numSamples > values.length
    ? Array.from({ length: numSamples }, (_, index) => values[index % values.length])
    : values;
  const orderedValues = order === 'random' && options.randomizeSamples
    ? structuredClone(sampleValues)
    : sampleValues;
  if (order === 'random' && options.randomizeSamples) {
    shuffle(orderedValues);
  }

  return orderedValues.slice(0, numSamples);
}

export function combineFactors(depth: number, factors: FactorValue[][], currentComponent: string, depthToFactorMap: Record<number, string>, currentParams: Record<string, string>): FactorCombination[] {
  const newComponents: FactorCombination[] = factors[depth].map((f) => [
    appendFactorValueName(currentComponent, factorValueName(f)),
    { ...currentParams, ...factorValueParameters(f, depth, depthToFactorMap) },
  ]);

  if (factors.length - 1 > depth) {
    const nextComponents = newComponents.map((c) => combineFactors(depth + 1, factors, c[0], depthToFactorMap, c[1])).flat();

    return nextComponents;
  }

  return newComponents;
}

function combineIndexDimensions(lengths: number[]): number[][] {
  if (lengths.length === 0) {
    return [[]];
  }

  return Array.from({ length: lengths[0] }, (_, index) => (
    combineIndexDimensions(lengths.slice(1)).map((rest) => [index, ...rest])
  )).flat();
}

function factorCombinationFromIndices(
  factors: FactorValue[][],
  indices: number[],
  depthToFactorMap: Record<number, string>,
): FactorCombination {
  const values = indices.map((index, depth) => factors[depth][index]);
  const params = values.reduce<Record<string, string>>((acc, value, depth) => ({
    ...acc,
    ...factorValueParameters(value, depth, depthToFactorMap),
  }), {});

  return [
    values.reduce<string>((componentName, value) => (
      appendFactorValueName(componentName, factorValueName(value))
    ), ''),
    params,
  ];
}

function factorCombinationFromValue(
  value: FactorValue,
  depth: number,
  depthToFactorMap: Record<number, string>,
): FactorCombination {
  return [
    appendFactorValueName('', factorValueName(value)),
    factorValueParameters(value, depth, depthToFactorMap),
  ];
}

export function combineCrossFactors(
  factors: FactorValue[][],
  depthToFactorMap: Record<number, string>,
): FactorCombination[] {
  if (factors.length === 0 || factors.some((factor) => factor.length === 0)) {
    return [];
  }

  const firstFactorIndices = Array.from({ length: factors[0].length }, (_, index) => index);
  const offsets = combineIndexDimensions(factors.slice(1).map((factor) => factor.length));

  return offsets.flatMap((offset, offsetIndex) => {
    const orderedFirstFactorIndices = offsetIndex % 2 === 0
      ? firstFactorIndices
      : [...firstFactorIndices].reverse();

    return orderedFirstFactorIndices.map((firstFactorIndex) => {
      const indices = [
        firstFactorIndex,
        ...offset.map((factorOffset, index) => (
          (firstFactorIndex + factorOffset) % factors[index + 1].length
        )),
      ];

      return factorCombinationFromIndices(factors, indices, depthToFactorMap);
    });
  });
}

export function combineZipFactors(
  factors: FactorValue[][],
  depthToFactorMap: Record<number, string>,
): FactorCombination[] {
  if (factors.length === 0 || factors.some((factor) => factor.length === 0)) {
    return [];
  }

  const zipLength = Math.min(...factors.map((factor) => factor.length));
  return Array.from({ length: zipLength }, (_, index) => (
    factorCombinationFromIndices(
      factors,
      factors.map(() => index),
      depthToFactorMap,
    )
  ));
}

export function combineConcatFactors(
  factors: FactorValue[][],
  depthToFactorMap: Record<number, string>,
): FactorCombination[] {
  return factors.flatMap((factorValues, depth) => (
    factorValues.map((value) => factorCombinationFromValue(value, depth, depthToFactorMap))
  ));
}

export function combineRepeatFactors(
  factors: FactorValue[][],
  depthToFactorMap: Record<number, string>,
  numRepeats = 1,
): FactorCombination[] {
  const repeatedFactors = combineConcatFactors(factors, depthToFactorMap);

  return Array.from({ length: numRepeats }, () => repeatedFactors).flat();
}

export function combineFactorsByAction(
  action: FactorDefinition['action'],
  factors: FactorValue[][],
  depthToFactorMap: Record<number, string>,
  numRepeats?: number,
): FactorCombination[] {
  if (factors.length === 0 || factors.some((factor) => factor.length === 0)) {
    return [];
  }

  if (action === 'cross') {
    return combineCrossFactors(factors, depthToFactorMap);
  }

  if (action === 'zip') {
    return combineZipFactors(factors, depthToFactorMap);
  }

  if (action === 'concat') {
    return combineConcatFactors(factors, depthToFactorMap);
  }

  if (action === 'repeat') {
    return combineRepeatFactors(factors, depthToFactorMap, numRepeats);
  }

  return combineFactors(0, factors, '', depthToFactorMap, {});
}

export function getFactorCombinations(
  block: FactorCombinationBlock,
  factors: Record<string, Factor>,
  onError?: (message: string) => void,
  stack: string[] = [],
  options: FactorCombinationOptions = {},
): FactorCombination[] {
  if (stack.includes(block.id)) {
    onError?.(`Circular factor reference: ${[...stack, block.id].join(' -> ')}`);
    return [];
  }

  const depthToFactorMap: Record<number, string> = {};
  const nextStack = [...stack, block.id];
  const factorValues = block.factorsToCross.map((factorReference, depth): FactorValue[] => {
    const factor = factors[factorReference.factor];
    depthToFactorMap[depth] = factorReference.factor;

    if (!factor) {
      onError?.(`Factor \`${factorReference.factor}\` is not defined in factors`);
      return [];
    }

    if (isFactorDefinition(factor)) {
      return applyFactorNumSamples(getFactorCombinations(
        factorDefinitionToCombinationBlock(factorReference.factor, factor),
        factors,
        onError,
        nextStack,
        options,
      ), factorReference.numSamples, block.order, options);
    }

    return applyFactorNumSamples(factor, factorReference.numSamples, block.order, options);
  });

  const action = options.expandPossibleSamples
    && block.action === 'zip'
    && block.order === 'random'
    && block.factorsToCross.some((factorReference) => factorReference.numSamples !== undefined)
    ? 'nest'
    : block.action;

  return combineFactorsByAction(action, factorValues, depthToFactorMap, block.numRepeats);
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
        || isFactorSequence(locationInSequence)
        || isFactorSequenceReference(locationInSequence)
      ) {
        return;
      }
      locationInSequence = locationInSequence.components[+p];
    }
  });

  const options = isFactorSequence(locationInSequence)
    ? getFactorCombinations(
      locationInSequence,
      config.factors || {},
    ).map((combination) => combination[0])
    : (locationInSequence as ComponentBlock).components.map((c: unknown, i: number) => (typeof c === 'string' ? c : `_componentBlock${i}`));
  shuffle(options);
  const newSquare: string[][] = latinSquare<string>(options, true);
  return newSquare;
}

function generateLatinSquareRows(config: StudyConfig, path: string, count: number): string[][] {
  const rows: string[][] = [];
  for (let i = 0; i < count; i += 1) {
    rows.push(...generateLatinSquare(config, path));
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
  path: string,
  factors: NonNullable<StudyConfig['factors']>,
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

  if (isFactorSequence(order)) {
    const componentsToCross = getFactorCombinations(
      order,
      factors,
      undefined,
      [],
      { randomizeSamples: true },
    );
    const factorOrder = order.order ?? 'fixed';
    let computedComponents = componentsToCross.map((c) => c[0]);

    if (factorOrder === 'random') {
      computedComponents = structuredClone(computedComponents);
      shuffle(computedComponents);
    } else if (factorOrder === 'latinSquare') {
      const latinSquareRow = latinSquareObject[path]?.pop();

      if (!latinSquareRow) {
        throw new Error(
          `Latin square exhausted for path: ${path}. `
          + 'This should not happen as we pre-generate enough rows. Please report this issue.',
        );
      }

      computedComponents = latinSquareRow;
    }

    return {
      id: order.id,
      orderPath: path,
      order: factorOrder,
      components: computedComponents,
      skip: [],
    };
  }

  if (isFactorSequenceReference(order)) {
    return {
      id: order.id ?? order.factor,
      orderPath: path,
      order: 'fixed',
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
    const latinSquareRow = latinSquareObject[path]?.pop();

    if (!latinSquareRow) {
      throw new Error(
        `Latin square exhausted for path: ${path}. `
        + 'This should not happen as we pre-generate enough rows. Please report this issue.',
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

        computedComponents[i] = _componentBlockToSequence(curr, latinSquareObject, `${path}-${actualIndex}`, factors) as unknown as ComponentBlock;
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
  factors: NonNullable<StudyConfig['factors']>,
): Sequence {
  const orderCopy = structuredClone(order);

  return _componentBlockToSequence(orderCopy, latinSquareObject, 'root', factors);
}

function _createRandomOrders(order: StudyConfig['sequence'], paths: string[], path: string, index: number) {
  const newPath = path.length > 0 ? `${path}-${index}` : 'root';
  if (isDynamicBlock(order) || isFactorSequenceReference(order)) {
    return;
  }

  if (isFactorSequence(order)) {
    if (order.order === 'latinSquare') {
      paths.push(newPath);
    }
    return;
  }

  if (order.order === 'latinSquare') {
    paths.push(newPath);
  }

  order.components.forEach((comp, i) => {
    if (typeof comp !== 'string' && !isDynamicBlock(comp) && !isFactorSequence(comp) && !isFactorSequenceReference(comp)) {
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
  if (isDynamicBlock(order) || isFactorSequenceReference(order)) {
    return;
  }

  if (isFactorSequence(order)) {
    if (order.order === 'latinSquare') {
      pathCounts[path] = (pathCounts[path] || 0) + 1;
    }
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
      && !isFactorSequence(curr)
      && !isFactorSequenceReference(curr)
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

  // Pre-generate enough latin square rows for each path based on usage count
  // We generate enough rows to cover the maximum usage in a single sequence
  const latinSquareObject: Record<string, string[][]> = paths
    .map((p) => {
      const usageCount = pathUsageCounts[p] || 1;
      return { [p]: generateLatinSquareRows(config, p, usageCount) };
    })
    .reduce((acc, curr) => ({ ...acc, ...curr }), {});

  const numSequences = config.uiConfig.numSequences || 1000;

  const sequenceArray: Sequence[] = [];
  Array.from({ length: numSequences }).forEach((_, sequenceIndex) => {
    const betweenSubjectsAssignment = betweenSubjectsAssignments[sequenceIndex % betweenSubjectsAssignments.length] || {};
    const assignedFactors = getFactorsForBetweenSubjectsAssignment(
      config.factors || {},
      betweenSubjectsAssignment,
    );

    // Generate a sequence
    let sequence = componentBlockToSequence(
      config.sequence,
      latinSquareObject,
      assignedFactors,
    );
    sequence = filterSequenceByBetweenSubjectsAssignment(
      sequence,
      config,
      betweenSubjectsAssignment,
    );
    sequence.components.push('end');

    // Add the sequence to the array
    sequenceArray.push(sequence);

    // Refill latin square arrays that are empty
    Object.entries(latinSquareObject).forEach(([key, value]) => {
      if (value.length === 0) {
        const usageCount = pathUsageCounts[key] || 1;
        latinSquareObject[key] = generateLatinSquareRows(config, key, usageCount);
      }
    });
  });

  return sequenceArray;
}
