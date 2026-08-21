import { MatrixResponse, ParsedStringOption } from '../parser/types';
import { parseStringOptions } from './stringOptions';

const MATRIX_CHOICE_STRING_TO_COLUMNS: Record<string, string[]> = {
  likely5: ['Highly Unlikely', 'Unlikely', 'Neutral', 'Likely', 'Highly Likely'],
  likely7: ['Highly Unlikely', 'Unlikely', 'Slightly Unlikely', 'Neutral', 'Slightly Likely', 'Likely', 'Highly Likely'],
  satisfaction5: ['Highly Unsatisfied', 'Unsatisfied', 'Neutral', 'Satisfied', 'Highly Satisfied'],
  satisfaction7: ['Highly Unsatisfied', 'Unsatisfied', 'Slightly Unsatisfied', 'Neutral', 'Slightly Satisfied', 'Satisfied', 'Highly Satisfied'],
};

export const MATRIX_DONT_KNOW_OPTION: ParsedStringOption = {
  label: "I don't know",
  value: "I don't know",
};

export function getMatrixAnswerOptions(response: MatrixResponse): ParsedStringOption[] {
  const parsedOptions = typeof response.answerOptions === 'string'
    ? parseStringOptions(MATRIX_CHOICE_STRING_TO_COLUMNS[response.answerOptions])
    : parseStringOptions(response.answerOptions);

  return response.withDontKnow ? [...parsedOptions, MATRIX_DONT_KNOW_OPTION] : parsedOptions;
}

export function isMatrixDontKnowValue(value: string) {
  return value.toLowerCase() === MATRIX_DONT_KNOW_OPTION.value.toLowerCase();
}
