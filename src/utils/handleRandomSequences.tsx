// eslint-disable-next-line import/no-unresolved
import latinSquare from '@quentinroy/latin-square';
import { OrderObject, StudyConfig } from '../parser/types';
import { deepCopy } from './deepCopy';
import { Sequence } from '../store/types';

function _orderObjectToSequence(
  order: OrderObject,
  latinSquareObject: Record<string, string[][]>,
  path: string,
): Sequence {
  // eslint-disable-next-line no-plusplus
  for (let i = 0; i < order.components.length; i++) {
    const curr = order.components[i];
    if (typeof curr !== 'string') {
      order.components[i] = _orderObjectToSequence(curr, latinSquareObject, `${path}-${i}`) as unknown as OrderObject;
    }
  }

  if (order.order === 'random') {
    const randomArr = order.components.sort(() => 0.5 - Math.random());

    order.components = randomArr;
  } else if (order.order === 'latinSquare' && latinSquareObject) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    order.components = latinSquareObject[path].pop()!.map((o) => {
      if (o.startsWith('_orderObj')) {
        return order.components[+o.slice(9)];
      }

      return o;
    });
  }

  let computedComponents = order.components.slice(0, order.numSamples ? order.numSamples : undefined).flat();

  // If we have a break, insert it into the sequence at the correct intervals
  if (order.break) {
    const newComponents = [];
    // eslint-disable-next-line no-plusplus
    for (let i = 0; i < computedComponents.length; i++) {
      if (i % order.break.after === 0 && i !== 0) {
        newComponents.push(...order.break.components);
      }
      newComponents.push(computedComponents[i]);
    }
    computedComponents = newComponents;
  }

  return {
    orderPath: path,
    components: computedComponents as Sequence['components'],
  };
}

function orderObjectToSequence(
  order: OrderObject,
  latinSquareObject: Record<string, string[][]>,
): Sequence {
  const orderCopy = deepCopy(order);

  return _orderObjectToSequence(orderCopy, latinSquareObject, 'root');
}

function _createRandomOrders(order: OrderObject, paths: string[], path: string, index = 0) {
  const newPath = path.length > 0 ? `${path}-${index}` : 'root';
  if (order.order === 'latinSquare') {
    paths.push(newPath);
  }

  order.components.forEach((comp, i) => {
    if (typeof comp !== 'string') {
      _createRandomOrders(comp, paths, newPath, i);
    }
  });
}

function createRandomOrders(order: OrderObject) {
  const paths: string[] = [];
  _createRandomOrders(order, paths, '', 0);

  return paths;
}

function generateLatinSquare(config: StudyConfig, path: string) {
  const pathArr = path.split('-');

  let locationInSequence: Partial<OrderObject> | string = {};
  pathArr.forEach((p) => {
    if (p === 'root') {
      locationInSequence = config.sequence;
    } else {
      locationInSequence = (locationInSequence as OrderObject).components[+p];
    }
  });

  const options = (locationInSequence as OrderObject).components.map((c: unknown, i: number) => (typeof c === 'string' ? c : `_orderObj${i}`));
  const newSquare: string[][] = latinSquare<string>(options.sort(() => 0.5 - Math.random()), true);
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
    const sequence = orderObjectToSequence(config.sequence, latinSquareObject);
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
