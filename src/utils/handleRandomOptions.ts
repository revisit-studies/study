import { IndividualComponent, StringOption } from '../parser/types';

export function randomizeOptions(componentConfig: IndividualComponent) {
  return componentConfig.response.reduce((acc, response) => {
    if (
      (response.type === 'radio' || response.type === 'checkbox' || response.type === 'buttons')
          && response.optionOrder === 'random'
    ) {
      const options = response.options.map((option) => (typeof option === 'string' ? { value: option, label: option } : option));
      const shuffled = [...options]
        .map((value) => ({ value, sort: Math.random() }))
        .sort((a, b) => a.sort - b.sort)
        .map(({ value }) => value);
      acc[response.id] = shuffled;
    }
    return acc;
  }, {} as Record<string, StringOption[]>);
}
