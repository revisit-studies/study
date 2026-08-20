import { PREFIX } from './Prefix';

export async function getStaticAssetByPath(path: string) {
  const res = await fetch(path);
  // If fetch fails, return undefined to indicate that the asset was not found
  if (!res.ok) {
    return undefined;
  }
  const text = await res.text();

  // If returned text contains the ReVISit title, it means the asset was not found
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
