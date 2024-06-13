import { PREFIX } from './Prefix';

export async function getStaticAssetByPath(path: string) {
  const res = await fetch(`${PREFIX}${path}`);
  const text = await res.text();

  if (text.includes('<title>reVISit</title>')) {
    return undefined;
  }
  return text;
}
