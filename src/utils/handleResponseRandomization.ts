import { IndividualComponent, StringOption } from '../parser/types';

export function randomizeForm(componentConfig: IndividualComponent) {
  const response = componentConfig.response.map((r) => r.id);

  if (componentConfig.responseOrder === 'random') {
    const fixedIndices = componentConfig.response.flatMap((r, i) => (r.excludeFromRandomization ? [i] : []));
    const shuffled = componentConfig.response
      .filter((r) => !r.excludeFromRandomization)
      .map((r) => r.id)
      .map((value) => ({ value, sort: Math.random() }))
      .sort((a, b) => a.sort - b.sort)
      .map(({ value }) => value);
    return { response: componentConfig.response.map((r, i) => (fixedIndices.includes(i) ? r.id : shuffled.shift()!)) };
  }

  return { response };
}

export function randomizeOptions(componentConfig: IndividualComponent) {
  return componentConfig.response.reduce((acc, response) => {
    if (response.type === 'radio' || response.type === 'checkbox' || response.type === 'buttons') {
      if (response.optionOrder === 'random') {
        const options = response.options.map((option) => (typeof option === 'string' ? { value: option, label: option } : option));
        const shuffled = [...options]
          .map((value) => ({ value, sort: Math.random() }))
          .sort((a, b) => a.sort - b.sort)
          .map(({ value }) => value);
        acc[response.id] = shuffled;
      } else {
        acc[response.id] = response.options.map((option) => (typeof option === 'string' ? { value: option, label: option } : option));
      }
    }
    return acc;
  }, {} as Record<string, StringOption[]>);
}

export function randomizeQuestionOrder(componentConfig: IndividualComponent) {
  return componentConfig.response.reduce((acc, response) => {
    if (response.type === 'matrix-radio' || response.type === 'matrix-checkbox') {
      if (response.questionOrder === 'random') {
        const questions = response.questionOptions;
        const shuffled = [...questions]
          .map((value) => ({ value, sort: Math.random() }))
          .sort((a, b) => a.sort - b.sort)
          .map(({ value }) => value);
        acc[response.id] = shuffled;
      } else {
        acc[response.id] = response.questionOptions;
      }
    }
    return acc;
  }, {} as Record<string, string[]>);
}
