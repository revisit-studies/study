import { IndividualComponent, ParsedStringOption } from '../parser/types';
import { parseStringOptions, parseStringOptionValue } from './stringOptions';

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
      const options = parseStringOptions(response.options);
      if (response.optionOrder === 'random') {
        const shuffled = [...options]
          .map((value) => ({ value, sort: Math.random() }))
          .sort((a, b) => a.sort - b.sort)
          .map(({ value }) => value);
        acc[response.id] = shuffled;
      } else {
        acc[response.id] = options;
      }
    }
    return acc;
  }, {} as Record<string, ParsedStringOption[]>);
}

export function randomizeQuestionOrder(componentConfig: IndividualComponent) {
  return componentConfig.response.reduce((acc, response) => {
    if (response.type === 'matrix-radio' || response.type === 'matrix-checkbox') {
      const questions = response.questionOptions
        .map((question) => parseStringOptionValue(question));
      if (response.questionOrder === 'random') {
        const shuffled = [...questions]
          .map((value) => ({ value, sort: Math.random() }))
          .sort((a, b) => a.sort - b.sort)
          .map(({ value }) => value);
        acc[response.id] = shuffled;
      } else {
        acc[response.id] = questions;
      }
    }
    return acc;
  }, {} as Record<string, string[]>);
}
