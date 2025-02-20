import { PREFIX } from './Prefix';

export async function getStaticAssetByPath(path: string) {
  const res = await fetch(path);
  const text = await res.text();

  if (text.includes('<title>ReVISit</title>')) {
    return undefined;
  }
  return text;
}

export async function getJsonAssetByPath(path: string) {
  const res = await fetch(`${PREFIX}${path}`);

  let data;
  try {
    data = await res.json();
  } catch (error) {
    console.error('Invalid JSON:', error);
  }

  return data;
}
