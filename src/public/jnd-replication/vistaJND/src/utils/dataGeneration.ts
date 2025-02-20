import seedrandom from 'seedrandom';
import * as math from 'mathjs';

const mu = 0;
const sigma = 1;
const rng = seedrandom('thisisjndexperimentseed');
const twoPi = 2.0 * Math.PI;

export function shuffle<T>(array: T[]) {
  let currentIndex = array.length; let
    randomIndex;

  // While there remain elements to shuffle.
  while (currentIndex > 0) {
    // Pick a remaining element.
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;

    // And swap it with the current element.
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex], array[currentIndex]];
  }

  return array;
}

function getSTDNormalDistriNumberFixed(randomNumber: () => number) {
  const u1 = randomNumber();
  const u2 = randomNumber();
  // console.log(u1)
  // console.log(u2)
  // Box-Muller
  const z0 = Math.sqrt(-2 * Number(math.log(Number(u1)))) * Math.cos(twoPi * u2);
  return z0 * sigma + mu;
}

function getSTDNormalDistriNumber() {
  const u1 = rng();
  const u2 = rng();
  // console.log(u1)
  // console.log(u2)
  // Box-Muller
  const z0 = Math.sqrt(-2 * Number(math.log(Number(u1)))) * Math.cos(twoPi * u2);
  return z0 * sigma + mu;
}

function getCorrelation(xAry: number[], yAry: number[]) {
  if (xAry.length === yAry.length) {
    const xMean = math.mean(xAry);
    const yMean = math.mean(yAry);
    const xSTD = Number(math.std(xAry));
    const ySTD = Number(math.std(yAry));
    let sumOfDiff = 0;
    // eslint-disable-next-line no-plusplus
    for (let i = 0; i < xAry.length; i++) {
      sumOfDiff += (xAry[i] - xMean) + (yAry[i] - yMean);
    }
    const covariance = sumOfDiff / (xAry.length - 1);
    return covariance / (xSTD * ySTD);
  }
  // Invalid Correlation Calculation
  return NaN;
}

function getLambda(r: number, rz: number) {
  const rSquare = r ** 2;
  const rZSquare = rz ** 2;
  return ((rz - 1) * (rSquare + rz) + Math.sqrt(rSquare * (rZSquare - 1) * (rSquare - 1))) / ((rz - 1) * (2 * rSquare + rz - 1));
}

function yTransform(xAry: number[], yAry: number[], lam: number) {
  const lamSquare = lam ** 2;
  return yAry.map((d, i) => (lam * xAry[i] + (1 - lam) * d) / Math.sqrt(lamSquare + (1 - lam) ** 2));
}

function getSTDNormalDistriArray(dataSize: number) {
  const res = [];
  while (res.length < dataSize) {
    const rnumber = getSTDNormalDistriNumber();
    if (rnumber >= -2 * sigma && rnumber <= sigma * 2) {
      res.push(rnumber);
    }
  }
  return res;
}

function getSTDNormalDistriArrayFixed(randomNumber: () => number, dataSize: number) {
  const res = [];
  while (res.length < dataSize) {
    const rnumber = getSTDNormalDistriNumberFixed(randomNumber);
    if (rnumber >= -2 * sigma && rnumber <= sigma * 2) {
      res.push(rnumber);
    }
  }
  return res;
}

// with outside u1, u2. garuantee same array
export function generateDataSetFixed(r: number, seed: string, dataSize: number = 100) {
  const randomNumber = seedrandom(seed);

  const xAry = getSTDNormalDistriArrayFixed(randomNumber, dataSize);
  let yAry = getSTDNormalDistriArrayFixed(randomNumber, dataSize);

  const rz = getCorrelation(xAry, yAry);

  const lam = getLambda(r, rz);
  yAry = yTransform(xAry, yAry, lam);
  return xAry.map((d, i) => (r < 0 ? [d, -yAry[i]] : [d, yAry[i]]));
}

export function generateDataSet(r: number, dataSize: number = 100) {
  const xAry = getSTDNormalDistriArray(dataSize);
  let yAry = getSTDNormalDistriArray(dataSize);
  const rz = getCorrelation(xAry, yAry);
  const lam = getLambda(r, rz);
  yAry = yTransform(xAry, yAry, lam);
  return xAry.map((d, i) => [d, yAry[i]]);
}

export function generateCorrelatedDataset(xSorted: number[], r: number, seed: string): number[] {
  const randomNumber = seedrandom(seed);

  let yAry = getSTDNormalDistriArrayFixed(randomNumber, xSorted.length);
  const rz = getCorrelation(xSorted, yAry);
  const lam = getLambda(r, rz);

  yAry = yTransform(xSorted, yAry, lam);

  return yAry;
}
