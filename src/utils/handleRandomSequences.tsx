import latinSquare from '@quentinroy/latin-square';
import { OrderObject, StudyConfig } from '../parser/types';
import { deepCopy } from './deepCopy';


function _orderObjectToList(
  order: OrderObject, 
  pathsFromFirebase: Record<string, string[][]>,
  path: string
 ) : string[] {
  
  for(let i = 0; i < order.components.length; i ++) {
    const curr = order.components[i];
    if(typeof curr !== 'string') {
      order.components[i] = _orderObjectToList(curr, pathsFromFirebase, path + '-' + i) as any;
    }
  }

  if(order.order === 'random') {
    const randomArr = order.components.sort((a, b) => 0.5 - Math.random());

    order.components = randomArr;
  }

  else if(order.order === 'latinSquare' && pathsFromFirebase) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    order.components = pathsFromFirebase[path].pop()!.map((o) => {
      if(o.startsWith('_orderObj')) {
        return order.components[+o.slice(9)];
      }
      
      return o;
    });
  }

  return order.components.flat().slice(0, order.numSamples ? order.numSamples : undefined) as any;
}

function orderObjectToList(
  order: OrderObject, 
  pathsFromFirebase: Record<string, string[][]>,
 ) : string[] {
  const orderCopy = deepCopy(order);

  _orderObjectToList(orderCopy, pathsFromFirebase, 'root');
  return orderCopy.components.flat().slice(0, orderCopy.numSamples ? orderCopy.numSamples : undefined) as any;
}

function _createRandomOrders(order: OrderObject, paths: string[], path: string, index = 0) {
  const newPath = path.length > 0 ? `${path}-${index}` : 'root';
  if(order.order === 'latinSquare') {
    paths.push(newPath);
  }

  order.components.forEach((comp, i) => {
    if(typeof comp !== 'string') {
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

  let locationInSequence: any;
  pathArr.forEach((p) => {
    if (p === 'root') {
      locationInSequence = config.sequence;
    }
    else {
      locationInSequence = locationInSequence.components[+p];
    }
  });

  const options = locationInSequence.components.map((c: unknown, i: number) => typeof c === 'string' ? c : `_orderObj${i}`);
  const newSquare: string[][] = latinSquare<string>(options.sort(() => 0.5 - Math.random()), true);
  return newSquare;
}

export function generateSequenceArray(config: StudyConfig, numSequences = 10000) {
  const paths = createRandomOrders(config.sequence);
  const latinSquareObject: Record<string, string[][]> = paths
    .map((p) => ({ [p]: generateLatinSquare(config, p) }))
    .reduce((acc, curr) => ({ ...acc, ...curr }), {});

  const sequenceArray: string[][] = [];
  Array.from({ length: numSequences }).forEach(() => {
    // Generate a sequence
    const sequence = orderObjectToList(config.sequence, latinSquareObject);
    sequence.push('end');

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