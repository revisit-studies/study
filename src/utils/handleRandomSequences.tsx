// eslint-disable-next-line import/no-unresolved
import latinSquare from '@quentinroy/latin-square';
import { OrderObject, StudyConfig } from '../parser/types';
import { deepCopy } from './deepCopy';

function _orderObjectToList(
  order: OrderObject,
  pathsFromFirebase: Record<string, string[][]>,
  path: string,
) : (string | OrderObject)[] | string {
  // eslint-disable-next-line no-plusplus
  for (let i = 0; i < order.components.length; i++) {
    const curr = order.components[i];
    if (typeof curr !== 'string') {
      order.components[i] = _orderObjectToList(curr, pathsFromFirebase, `${path}-${i}`) as string;
    }
  }

  if (order.order === 'random') {
    const randomArr = order.components.sort(() => 0.5 - Math.random());

    order.components = randomArr;
  } else if (order.order === 'latinSquare' && pathsFromFirebase) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    order.components = pathsFromFirebase[path].pop()!.map((o) => {
      if (o.startsWith('_orderObj')) {
        return order.components[+o.slice(9)];
      }

      return o;
    });
  }

  return order.components.slice(0, order.numSamples ? order.numSamples : undefined).flat();
}

function orderObjectToList(
  order: OrderObject,
  pathsFromFirebase: Record<string, string[][]>,
) : (string | OrderObject)[] {
  const orderCopy = deepCopy(order);

  _orderObjectToList(orderCopy, pathsFromFirebase, 'root');
  return orderCopy.components.slice(0, orderCopy.numSamples ? orderCopy.numSamples : undefined).flat();
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

export function generateSequenceArray(config: StudyConfig) {
  const paths = createRandomOrders(config.sequence);
  const latinSquareObject: Record<string, string[][]> = paths
    .map((p) => ({ [p]: generateLatinSquare(config, p) }))
    .reduce((acc, curr) => ({ ...acc, ...curr }), {});

  const numSequences = config.uiConfig.numSequences || 1000;

  const sequenceArray: string[][] = [];
  Array.from({ length: numSequences }).forEach(() => {
    // Generate a sequence
    const sequence = orderObjectToList(config.sequence, latinSquareObject);
    sequence.push('end');

    // Add the sequence to the array
    sequenceArray.push(sequence as string[]);

    // Refill the latin square if it is empty
    Object.entries(latinSquareObject).forEach(([key, value]) => {
      if (value.length === 0) {
        latinSquareObject[key] = generateLatinSquare(config, key);
      }
    });
  });

  return sequenceArray;
}
