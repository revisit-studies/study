import countryNames from 'countries-list/minimal/countries.en.min.json';
import type { DropdownResponse, ParsedStringOption } from '../parser/types';
import { parseStringOptions } from './stringOptions';

function getEmojiFlag(countryCode: string) {
  // Get emoji flag for a given country code using Unicode regional indicator symbols
  return String.fromCodePoint(
    ...countryCode.split('').map((character) => 127397 + character.charCodeAt(0)),
  );
}

const COUNTRY_OPTIONS: ParsedStringOption[] = Object.entries(countryNames)
  .sort(([, firstName], [, secondName]) => firstName.localeCompare(secondName))
  .map(([countryCode, countryName]) => ({
    label: `${getEmojiFlag(countryCode)} ${countryName}`,
    value: countryCode,
  }));

export function getDropdownOptions(response: DropdownResponse): ParsedStringOption[] {
  if (response.options === 'countries') {
    return COUNTRY_OPTIONS;
  }

  return parseStringOptions(response.options ?? []);
}
