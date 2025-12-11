// eslint-disable-next-line import/no-unresolved
import latinSquare from '@quentinroy/latin-square';
import isEqual from 'lodash.isequal';
import {
  ComponentBlock, DynamicBlock, FactorBlock, StudyConfig,
} from '../parser/types';
import { Sequence } from '../store/types';
import { isDynamicBlock, isFactorBlock } from '../parser/utils';

function shuffle(array: (string | ComponentBlock | DynamicBlock | FactorBlock)[]) {
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

export function combineFactors(depth: number, factors: string[][], currentComponent: string, depthToFactorMap: Record<number, string>, currentParams: Record<string, string>): [string, Record<string, string>][] {
  const newComponents: [string, Record<string, string>][] = factors[depth].map((f) => [`${currentComponent}_${f}`, { ...currentParams, [depthToFactorMap[depth]]: f }]);

  if (factors.length - 1 > depth) {
    const nextComponents = newComponents.map((c) => combineFactors(depth + 1, factors, c[0], depthToFactorMap, c[1])).flat();

    return nextComponents;
  }

  return newComponents;
}

function _componentBlockToSequence(
  order: StudyConfig['sequence'],
  latinSquareObject: Record<string, string[][]>,
  path: string,
  factors: Record<string, string[]>,
): Sequence {
  if (isDynamicBlock(order)) {
    return {
      id: order.id,
      orderPath: path,
      order: order.order,
      components: [],
      skip: [],
    };
  }

  if (isFactorBlock(order)) {
    const depthMap = {};
    const newComponents = order.factorsToCross.map((c) => factors[c.factor]);
    const componentsToCross = combineFactors(0, newComponents, '', depthMap, {});

    return {
      id: order.id,
      orderPath: path,
      order: order.order,
      components: componentsToCross.map((c) => c[0]),
      skip: [],
    };
  }

  let computedComponents = order.components;

  if (order.order === 'random') {
    const randomArr = structuredClone(order.components);

    shuffle(randomArr);

    computedComponents = randomArr;
  } else if (order.order === 'latinSquare' && latinSquareObject) {
    computedComponents = latinSquareObject[path].pop()!.map((o) => {
      if (o.startsWith('_componentBlock')) {
        return order.components[+o.slice('_componentBlock'.length)];
      }

      return o;
    });
  }

  computedComponents = computedComponents.slice(0, order.numSamples);

  for (let i = 0; i < computedComponents.length; i += 1) {
    const curr = computedComponents[i];
    if (typeof curr !== 'string' && !Array.isArray(curr)) {
      const index = order.components.findIndex((c) => isEqual(c, curr));
      computedComponents[i] = _componentBlockToSequence(curr, latinSquareObject, `${path}-${index}`, factors) as unknown as ComponentBlock;
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
    skip: order.skip,
  };
}

function componentBlockToSequence(
  order: StudyConfig['sequence'],
  latinSquareObject: Record<string, string[][]>,
  factors: Record<string, string[]>,
): Sequence {
  const orderCopy = structuredClone(order);

  return _componentBlockToSequence(orderCopy, latinSquareObject, 'root', factors);
}

function _createRandomOrders(order: StudyConfig['sequence'], paths: string[], path: string, index: number) {
  const newPath = path.length > 0 ? `${path}-${index}` : 'root';
  if (order.order === 'latinSquare') {
    paths.push(newPath);
  }

  if (isDynamicBlock(order) || isFactorBlock(order)) {
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

export function generateSequenceArray(config: StudyConfig): Sequence[] {
  const paths = createRandomOrders(config.sequence);
  const latinSquareObject: Record<string, string[][]> = paths
    .map((p) => ({ [p]: generateLatinSquare(config, p) }))
    .reduce((acc, curr) => ({ ...acc, ...curr }), {});

  const numSequences = config.uiConfig.numSequences || 1000;

  const sequenceArray: Sequence[] = [];
  Array.from({ length: numSequences }).forEach(() => {
    // Generate a sequence
    const sequence = componentBlockToSequence(config.sequence, latinSquareObject, config.factors || {});
    sequence.components.push('end');

    // Add the sequence to the array
    sequenceArray.push(sequence);

    // Refill the latin square if it is empty
    Object.entries(latinSquareObject).forEach(([key, value]) => {
      if (value.length === 0) {
        latinSquareObject[key] = generateLatinSquare(config, key);
      }
    });
  });

  return sequenceArray;
}
