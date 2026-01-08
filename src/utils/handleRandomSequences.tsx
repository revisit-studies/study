// eslint-disable-next-line import/no-unresolved
import latinSquare from '@quentinroy/latin-square';
import isEqual from 'lodash.isequal';
import { ComponentBlock, DynamicBlock, StudyConfig } from '../parser/types';
import { Sequence } from '../store/types';
import { isDynamicBlock } from '../parser/utils';

function shuffle(array: (string | ComponentBlock | DynamicBlock)[]) {
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

function generateLatinSquare(config: StudyConfig, path: string) {
  const pathArr = path.split('-');

  let locationInSequence: Partial<ComponentBlock> | Partial<DynamicBlock> | string = {};
  pathArr.forEach((p) => {
    if (p === 'root') {
      locationInSequence = config.sequence;
    } else {
      if (isDynamicBlock(locationInSequence as StudyConfig['sequence'])) {
        return;
      }
      locationInSequence = (locationInSequence as ComponentBlock).components[+p];
    }
  });

  const options = (locationInSequence as ComponentBlock).components.map((c: unknown, i: number) => (typeof c === 'string' ? c : `_componentBlock${i}`));
  shuffle(options);
  const newSquare: string[][] = latinSquare<string>(options, true);
  return newSquare;
}

function _componentBlockToSequence(
  order: StudyConfig['sequence'],
  latinSquareObject: Record<string, string[][]>,
  path: string,
  config: StudyConfig,
): Sequence {
  if (isDynamicBlock(order)) {
    return {
      id: order.id,
      orderPath: path,
      order: order.order,
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
  const uniqueComponents: Array<{ component: ComponentBlock | DynamicBlock; indices: number[] }> = [];

  for (let j = 0; j < order.components.length; j += 1) {
    const comp = order.components[j];
    if (typeof comp !== 'string' && !Array.isArray(comp)) {
      // Find if we've already seen this component (by value)
      let found = false;
      for (const unique of uniqueComponents) {
        if (isEqual(unique.component, comp)) {
          unique.indices.push(j);
          found = true;
          break;
        }
      }
      if (!found) {
        uniqueComponents.push({ component: comp, indices: [j] });
      }
    }
  }

  // Track how many times we've seen each unique component
  const seenCounts = new Map<ComponentBlock | DynamicBlock, number>();

  for (let i = 0; i < computedComponents.length; i += 1) {
    const curr = computedComponents[i];
    if (typeof curr !== 'string' && !Array.isArray(curr)) {
      // Find the matching unique component
      let matchedUnique = null;
      for (const unique of uniqueComponents) {
        if (isEqual(unique.component, curr)) {
          matchedUnique = unique;
          break;
        }
      }

      if (matchedUnique) {
        const seenCount = seenCounts.get(matchedUnique.component) || 0;
        const actualIndex = matchedUnique.indices[seenCount] ?? matchedUnique.indices[0];
        seenCounts.set(matchedUnique.component, seenCount + 1);

        computedComponents[i] = _componentBlockToSequence(curr, latinSquareObject, `${path}-${actualIndex}`, config) as unknown as ComponentBlock;
      } else {
        // Fallback: shouldn't happen, but handle it
        const index = order.components.findIndex((c) => isEqual(c, curr));
        computedComponents[i] = _componentBlockToSequence(curr, latinSquareObject, `${path}-${index}`, config) as unknown as ComponentBlock;
      }
    }
  }

  // If we have a break, insert it into the sequence at the correct intervals
  if (order.interruptions) {
    order.interruptions.forEach((interruption) => {
      const newComponents = [];
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
      }

      // Handle random interruptions
      if (interruption.spacing === 'random') {
        // Generate the random locations
        const randomInterruptionLocations = new Set<number>();
        if (interruption.numInterruptions > computedComponents.length - 1) {
          throw new Error('Number of interruptions cannot be greater than the number of components');
        }
        while (randomInterruptionLocations.size < interruption.numInterruptions) {
          const randomLocation = Math.floor(Math.random() * computedComponents.length - 1) + 1;
          randomInterruptionLocations.add(randomLocation);
        }
        const sortedRandomInterruptionLocations = Array.from(randomInterruptionLocations).sort((a, b) => a - b);

        let j = 0;
        for (let i = 0; i < computedComponents.length; i += 1) {
          if (i === sortedRandomInterruptionLocations[j]) {
            newComponents.push(...interruption.components);
            j += 1;
          }
          newComponents.push(computedComponents[i]);
        }
      }
      computedComponents = newComponents;
    });
  }

  return {
    id: order.id,
    orderPath: path,
    order: order.order,
    components: computedComponents.flat() as Sequence['components'],
    skip: order.skip || [],
    interruptions: order.interruptions || [],
  };
}

function componentBlockToSequence(
  order: StudyConfig['sequence'],
  latinSquareObject: Record<string, string[][]>,
  config: StudyConfig,
): Sequence {
  const orderCopy = structuredClone(order);

  return _componentBlockToSequence(orderCopy, latinSquareObject, 'root', config);
}

function _createRandomOrders(order: StudyConfig['sequence'], paths: string[], path: string, index: number) {
  const newPath = path.length > 0 ? `${path}-${index}` : 'root';
  if (order.order === 'latinSquare') {
    paths.push(newPath);
  }

  if (isDynamicBlock(order)) {
    return;
  }

  order.components.forEach((comp, i) => {
    if (typeof comp !== 'string' && !isDynamicBlock(comp)) {
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
  if (isDynamicBlock(order)) {
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
  const uniqueComponents: Array<{ component: ComponentBlock | DynamicBlock; indices: number[] }> = [];

  for (let j = 0; j < order.components.length; j += 1) {
    const comp = order.components[j];
    if (typeof comp !== 'string' && !Array.isArray(comp) && !isDynamicBlock(comp)) {
      // Find if we've already seen this component (by value)
      let found = false;
      for (const unique of uniqueComponents) {
        if (isEqual(unique.component, comp)) {
          unique.indices.push(j);
          found = true;
          break;
        }
      }
      if (!found) {
        uniqueComponents.push({ component: comp, indices: [j] });
      }
    }
  }

  // Track how many times we've seen each unique component
  const seenCounts = new Map<ComponentBlock | DynamicBlock, number>();

  for (let i = 0; i < computedComponents.length; i += 1) {
    const curr = computedComponents[i];
    if (typeof curr !== 'string' && !Array.isArray(curr) && !isDynamicBlock(curr)) {
      // Find the matching unique component
      let matchedUnique = null;
      for (const unique of uniqueComponents) {
        if (isEqual(unique.component, curr)) {
          matchedUnique = unique;
          break;
        }
      }

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

  // Pre-generate enough latin square rows for each path based on usage count
  // We generate enough rows to cover the maximum usage in a single sequence
  const latinSquareObject: Record<string, string[][]> = paths
    .map((p) => {
      const usageCount = pathUsageCounts[p] || 1;
      // Generate multiple latin squares if needed and concatenate them
      const rows: string[][] = [];
      for (let i = 0; i < usageCount; i += 1) {
        rows.push(...generateLatinSquare(config, p));
      }
      return { [p]: rows };
    })
    .reduce((acc, curr) => ({ ...acc, ...curr }), {});

  const numSequences = config.uiConfig.numSequences || 1000;

  const sequenceArray: Sequence[] = [];
  Array.from({ length: numSequences }).forEach(() => {
    // Generate a sequence
    const sequence = componentBlockToSequence(config.sequence, latinSquareObject, config);
    sequence.components.push('end');

    // Add the sequence to the array
    sequenceArray.push(sequence);

    // Refill latin square arrays that are empty
    Object.entries(latinSquareObject).forEach(([key, value]) => {
      if (value.length === 0) {
        const usageCount = pathUsageCounts[key] || 1;
        const rows: string[][] = [];
        for (let i = 0; i < usageCount; i += 1) {
          rows.push(...generateLatinSquare(config, key));
        }
        latinSquareObject[key] = rows;
      }
    });
  });

  return sequenceArray;
}
