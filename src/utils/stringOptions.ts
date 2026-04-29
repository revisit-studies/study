import { ParsedStringOption, StringOption } from '../parser/types';

export function parseStringOption(option: StringOption | string): ParsedStringOption {
  if (typeof option === 'string') {
    return { label: option, value: option };
  }

  return { ...option, value: option.value ?? option.label };
}

export function parseStringOptions(options: (StringOption | string)[]): ParsedStringOption[] {
  return options.map((option) => parseStringOption(option));
}

export function parseStringOptionValue(option: StringOption | string): string {
  return typeof option === 'string' ? option : option.value ?? option.label;
}
