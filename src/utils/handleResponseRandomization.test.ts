import { describe, it, expect } from 'vitest';
import { randomizeForm, randomizeOptions, randomizeQuestionOrder } from './handleResponseRandomization';
import { IndividualComponent } from '../parser/types';

describe('handleResponseRandomization', () => {
  // ============================================
  // randomizeForm tests
  // ============================================

  describe('randomizeForm', () => {
    describe('fixed order', () => {
      it('returns response IDs in original order when responseOrder is not random', () => {
        const component = {
          response: [
            { id: 'q1', type: 'shortText' as const, prompt: 'Q1' },
            { id: 'q2', type: 'shortText' as const, prompt: 'Q2' },
            { id: 'q3', type: 'shortText' as const, prompt: 'Q3' },
          ],
          responseOrder: 'fixed' as const,
        } as IndividualComponent;

        const result = randomizeForm(component);
        expect(result.response).toEqual(['q1', 'q2', 'q3']);
      });

      it('returns response IDs in original order when responseOrder is undefined', () => {
        const component = {
          response: [
            { id: 'q1', type: 'shortText' as const, prompt: 'Q1' },
            { id: 'q2', type: 'shortText' as const, prompt: 'Q2' },
            { id: 'q3', type: 'shortText' as const, prompt: 'Q3' },
          ],
        } as IndividualComponent;

        const result = randomizeForm(component);
        expect(result.response).toEqual(['q1', 'q2', 'q3']);
      });

      it('handles single response', () => {
        const component = {
          response: [
            { id: 'q1', type: 'shortText' as const, prompt: 'Q1' },
          ],
          responseOrder: 'fixed' as const,
        } as IndividualComponent;

        const result = randomizeForm(component);
        expect(result.response).toEqual(['q1']);
      });

      it('handles empty response array', () => {
        const component = {
          type: 'questionnaire' as const,
          response: [],
          responseOrder: 'fixed' as const,
        } as IndividualComponent;

        const result = randomizeForm(component);
        expect(result.response).toEqual([]);
      });
    });

    describe('random order', () => {
      it('returns all response IDs when randomized', () => {
        const component = {
          response: [
            { id: 'q1', type: 'shortText' as const, prompt: 'Q1' },
            { id: 'q2', type: 'shortText' as const, prompt: 'Q2' },
            { id: 'q3', type: 'shortText' as const, prompt: 'Q3' },
            { id: 'q4', type: 'shortText' as const, prompt: 'Q4' },
          ],
          responseOrder: 'random' as const,
        } as IndividualComponent;

        const result = randomizeForm(component);

        // Check all IDs are present
        expect(result.response).toHaveLength(4);
        expect(result.response).toContain('q1');
        expect(result.response).toContain('q2');
        expect(result.response).toContain('q3');
        expect(result.response).toContain('q4');
      });

      it('does not have duplicate IDs', () => {
        const component = {
          response: [
            { id: 'q1', type: 'shortText' as const, prompt: 'Q1' },
            { id: 'q2', type: 'shortText' as const, prompt: 'Q2' },
            { id: 'q3', type: 'shortText' as const, prompt: 'Q3' },
          ],
          responseOrder: 'random' as const,
        } as IndividualComponent;

        const result = randomizeForm(component);
        const uniqueIds = new Set(result.response);
        expect(uniqueIds.size).toBe(3);
      });

      it('produces varied orderings over multiple runs', () => {
        const component = {
          response: [
            { id: 'q1', type: 'shortText' as const, prompt: 'Q1' },
            { id: 'q2', type: 'shortText' as const, prompt: 'Q2' },
            { id: 'q3', type: 'shortText' as const, prompt: 'Q3' },
            { id: 'q4', type: 'shortText' as const, prompt: 'Q4' },
          ],
          responseOrder: 'random' as const,
        } as IndividualComponent;

        const orders = new Set<string>();
        for (let i = 0; i < 50; i += 1) {
          const result = randomizeForm(component);
          orders.add(JSON.stringify(result.response));
        }

        // With 4 items, there are 24 possible orderings
        // We should see at least 5 different orderings in 50 runs
        expect(orders.size).toBeGreaterThan(5);
      });

      it('handles single response (no randomization possible)', () => {
        const component = {
          response: [
            { id: 'q1', type: 'shortText' as const, prompt: 'Q1' },
          ],
          responseOrder: 'random' as const,
        } as IndividualComponent;

        const result = randomizeForm(component);
        expect(result.response).toEqual(['q1']);
      });
    });

    describe('excludeFromRandomization', () => {
      it('keeps fixed items in their original positions', () => {
        const component = {
          response: [
            {
              id: 'q1', type: 'shortText' as const, prompt: 'Q1', excludeFromRandomization: true,
            },
            { id: 'q2', type: 'shortText' as const, prompt: 'Q2' },
            { id: 'q3', type: 'shortText' as const, prompt: 'Q3' },
            {
              id: 'q4', type: 'shortText' as const, prompt: 'Q4', excludeFromRandomization: true,
            },
          ],
          responseOrder: 'random' as const,
        } as IndividualComponent;

        const result = randomizeForm(component);

        // Fixed items should remain in their positions
        expect(result.response[0]).toBe('q1');
        expect(result.response[3]).toBe('q4');

        // Middle items should be q2 and q3 in some order
        expect(result.response.slice(1, 3).sort()).toEqual(['q2', 'q3']);
      });

      it('handles all items excluded from randomization', () => {
        const component = {
          response: [
            {
              id: 'q1', type: 'shortText' as const, prompt: 'Q1', excludeFromRandomization: true,
            },
            {
              id: 'q2', type: 'shortText' as const, prompt: 'Q2', excludeFromRandomization: true,
            },
            {
              id: 'q3', type: 'shortText' as const, prompt: 'Q3', excludeFromRandomization: true,
            },
          ],
          responseOrder: 'random' as const,
        } as IndividualComponent;

        const result = randomizeForm(component);
        expect(result.response).toEqual(['q1', 'q2', 'q3']);
      });

      it('handles only middle items randomizable', () => {
        const component = {
          response: [
            {
              id: 'q1', type: 'shortText' as const, prompt: 'Q1', excludeFromRandomization: true,
            },
            { id: 'q2', type: 'shortText' as const, prompt: 'Q2' },
            { id: 'q3', type: 'shortText' as const, prompt: 'Q3' },
            { id: 'q4', type: 'shortText' as const, prompt: 'Q4' },
            {
              id: 'q5', type: 'shortText' as const, prompt: 'Q5', excludeFromRandomization: true,
            },
          ],
          responseOrder: 'random' as const,
        } as IndividualComponent;

        const result = randomizeForm(component);

        expect(result.response[0]).toBe('q1');
        expect(result.response[4]).toBe('q5');

        const middle = result.response.slice(1, 4);
        expect(middle).toHaveLength(3);
        expect(middle.sort()).toEqual(['q2', 'q3', 'q4']);
      });

      it('produces varied orderings for non-fixed items', () => {
        const component = {
          response: [
            {
              id: 'q1', type: 'shortText' as const, prompt: 'Q1', excludeFromRandomization: true,
            },
            { id: 'q2', type: 'shortText' as const, prompt: 'Q2' },
            { id: 'q3', type: 'shortText' as const, prompt: 'Q3' },
            { id: 'q4', type: 'shortText' as const, prompt: 'Q4' },
          ],
          responseOrder: 'random' as const,
        } as IndividualComponent;

        const orders = new Set<string>();
        for (let i = 0; i < 30; i += 1) {
          const result = randomizeForm(component);
          orders.add(JSON.stringify(result.response.slice(1)));
        }

        // Should see multiple orderings of q2, q3, q4
        expect(orders.size).toBeGreaterThan(3);
      });
    });
  });

  // ============================================
  // randomizeOptions tests
  // ============================================

  describe('randomizeOptions', () => {
    describe('fixed option order', () => {
      it('returns options in original order for radio responses', () => {
        const component = {
          response: [
            {
              id: 'q1',
              type: 'radio' as const,
              prompt: 'Q1',
              options: ['Option A', 'Option B', 'Option C'],
              optionOrder: 'fixed' as const,
            },
          ],
        } as IndividualComponent;

        const result = randomizeOptions(component);
        expect(result.q1).toEqual([
          { value: 'Option A', label: 'Option A' },
          { value: 'Option B', label: 'Option B' },
          { value: 'Option C', label: 'Option C' },
        ]);
      });

      it('returns options in original order when optionOrder is undefined', () => {
        const component = {
          response: [
            {
              id: 'q1',
              type: 'checkbox' as const,
              prompt: 'Q1',
              options: ['A', 'B', 'C'],
            },
          ],
        } as IndividualComponent;

        const result = randomizeOptions(component);
        expect(result.q1).toEqual([
          { value: 'A', label: 'A' },
          { value: 'B', label: 'B' },
          { value: 'C', label: 'C' },
        ]);
      });

      it('handles options already in object format', () => {
        const component = {
          response: [
            {
              id: 'q1',
              type: 'radio' as const,
              prompt: 'Q1',
              options: [
                { value: 'a', label: 'Option A' },
                { value: 'b', label: 'Option B' },
              ],
              optionOrder: 'fixed' as const,
            },
          ],
        } as IndividualComponent;

        const result = randomizeOptions(component);
        expect(result.q1).toEqual([
          { value: 'a', label: 'Option A' },
          { value: 'b', label: 'Option B' },
        ]);
      });
    });

    describe('random option order', () => {
      it('returns all options when randomized', () => {
        const component = {
          response: [
            {
              id: 'q1',
              type: 'radio' as const,
              prompt: 'Q1',
              options: ['A', 'B', 'C', 'D'],
              optionOrder: 'random' as const,
            },
          ],
        } as IndividualComponent;

        const result = randomizeOptions(component);

        expect(result.q1).toHaveLength(4);
        const values = result.q1.map((opt) => opt.value);
        expect(values.sort()).toEqual(['A', 'B', 'C', 'D']);
      });

      it('produces varied orderings over multiple runs', () => {
        const component = {
          response: [
            {
              id: 'q1',
              type: 'checkbox' as const,
              prompt: 'Q1',
              options: ['A', 'B', 'C', 'D'],
              optionOrder: 'random' as const,
            },
          ],
        } as IndividualComponent;

        const orders = new Set<string>();
        for (let i = 0; i < 50; i += 1) {
          const result = randomizeOptions(component);
          const values = result.q1.map((opt) => opt.value);
          orders.add(JSON.stringify(values));
        }

        expect(orders.size).toBeGreaterThan(5);
      });

      it('converts string options to object format', () => {
        const component = {
          response: [
            {
              id: 'q1',
              type: 'radio' as const,
              prompt: 'Q1',
              options: ['A', 'B', 'C'],
              optionOrder: 'random' as const,
            },
          ],
        } as IndividualComponent;

        const result = randomizeOptions(component);

        // All options should be objects with value and label
        result.q1.forEach((opt) => {
          expect(opt).toHaveProperty('value');
          expect(opt).toHaveProperty('label');
          expect(typeof opt.value).toBe('string');
          expect(typeof opt.label).toBe('string');
        });
      });

      it('handles buttons type', () => {
        const component = {
          response: [
            {
              id: 'q1',
              type: 'buttons' as const,
              prompt: 'Q1',
              options: ['Yes', 'No', 'Maybe'],
              optionOrder: 'random' as const,
            },
          ],
        } as IndividualComponent;

        const result = randomizeOptions(component);
        const values = result.q1.map((opt) => opt.value);
        expect(values.sort()).toEqual(['Maybe', 'No', 'Yes']);
      });
    });

    describe('multiple responses', () => {
      it('handles multiple responses with different randomization settings', () => {
        const component = {
          response: [
            {
              id: 'q1',
              type: 'radio' as const,
              prompt: 'Q1',
              options: ['A', 'B'],
              optionOrder: 'fixed' as const,
            },
            {
              id: 'q2',
              type: 'checkbox' as const,
              prompt: 'Q2',
              options: ['X', 'Y', 'Z'],
              optionOrder: 'random' as const,
            },
          ],
        } as IndividualComponent;

        const result = randomizeOptions(component);

        // q1 should be fixed
        expect(result.q1).toEqual([
          { value: 'A', label: 'A' },
          { value: 'B', label: 'B' },
        ]);

        // q2 should have all options
        expect(result.q2).toHaveLength(3);
        const values = result.q2.map((opt) => opt.value);
        expect(values.sort()).toEqual(['X', 'Y', 'Z']);
      });

      it('ignores non-randomizable response types', () => {
        const component = {
          response: [
            {
              id: 'q1',
              type: 'shortText' as const,
              prompt: 'Q1',
            },
            {
              id: 'q2',
              type: 'radio' as const,
              prompt: 'Q2',
              options: ['A', 'B'],
            },
            {
              id: 'q3',
              type: 'numerical' as const,
              prompt: 'Q3',
            },
          ],
        } as IndividualComponent;

        const result = randomizeOptions(component);

        // Only q2 should be in the result
        expect(result).toHaveProperty('q2');
        expect(result).not.toHaveProperty('q1');
        expect(result).not.toHaveProperty('q3');
      });

      it('handles empty component response array', () => {
        const component = {
          type: 'questionnaire' as const,
          response: [],
        } as IndividualComponent;

        const result = randomizeOptions(component);
        expect(result).toEqual({});
      });
    });
  });

  // ============================================
  // randomizeQuestionOrder tests
  // ============================================

  describe('randomizeQuestionOrder', () => {
    describe('fixed question order', () => {
      it('returns questions in original order for matrix-radio', () => {
        const component = {
          type: 'questionnaire' as const,
          response: [
            {
              id: 'matrix1',
              type: 'matrix-radio' as const,
              prompt: 'Matrix',
              questionOptions: ['Q1', 'Q2', 'Q3'],
              answerOptions: ['A', 'B', 'C'],
              questionOrder: 'fixed' as const,
            },
          ],
        } as IndividualComponent;

        const result = randomizeQuestionOrder(component);
        expect(result.matrix1).toEqual(['Q1', 'Q2', 'Q3']);
      });

      it('returns questions in original order when questionOrder is undefined', () => {
        const component = {
          response: [
            {
              id: 'matrix1',
              type: 'matrix-checkbox' as const,
              prompt: 'Matrix',
              questionOptions: ['Q1', 'Q2', 'Q3'],
              answerOptions: ['A', 'B'],
            },
          ],
        } as IndividualComponent;

        const result = randomizeQuestionOrder(component);
        expect(result.matrix1).toEqual(['Q1', 'Q2', 'Q3']);
      });
    });

    describe('random question order', () => {
      it('returns all questions when randomized', () => {
        const component = {
          response: [
            {
              id: 'matrix1',
              type: 'matrix-radio' as const,
              prompt: 'Matrix',
              questionOptions: ['Q1', 'Q2', 'Q3', 'Q4'],
              answerOptions: ['A', 'B', 'C'],
              questionOrder: 'random' as const,
            },
          ],
        } as IndividualComponent;

        const result = randomizeQuestionOrder(component);

        expect(result.matrix1).toHaveLength(4);
        expect(result.matrix1.sort()).toEqual(['Q1', 'Q2', 'Q3', 'Q4']);
      });

      it('produces varied orderings over multiple runs', () => {
        const component = {
          response: [
            {
              id: 'matrix1',
              type: 'matrix-checkbox' as const,
              prompt: 'Matrix',
              questionOptions: ['Q1', 'Q2', 'Q3', 'Q4'],
              answerOptions: ['A', 'B'],
              questionOrder: 'random' as const,
            },
          ],
        } as IndividualComponent;

        const orders = new Set<string>();
        for (let i = 0; i < 50; i += 1) {
          const result = randomizeQuestionOrder(component);
          orders.add(JSON.stringify(result.matrix1));
        }

        expect(orders.size).toBeGreaterThan(5);
      });

      it('handles matrix-checkbox type', () => {
        const component = {
          response: [
            {
              id: 'matrix1',
              type: 'matrix-checkbox' as const,
              prompt: 'Matrix',
              questionOptions: ['A', 'B', 'C'],
              answerOptions: ['1', '2'],
              questionOrder: 'random' as const,
            },
          ],
        } as IndividualComponent;

        const result = randomizeQuestionOrder(component);
        expect(result.matrix1).toHaveLength(3);
        expect(result.matrix1.sort()).toEqual(['A', 'B', 'C']);
      });
    });

    describe('multiple matrix responses', () => {
      it('handles multiple matrices with different settings', () => {
        const component = {
          response: [
            {
              id: 'matrix1',
              type: 'matrix-radio' as const,
              prompt: 'Matrix 1',
              questionOptions: ['Q1', 'Q2'],
              answerOptions: ['A', 'B'],
              questionOrder: 'fixed' as const,
            },
            {
              id: 'matrix2',
              type: 'matrix-checkbox' as const,
              prompt: 'Matrix 2',
              questionOptions: ['X', 'Y', 'Z'],
              answerOptions: ['1', '2'],
              questionOrder: 'random' as const,
            },
          ],
        } as IndividualComponent;

        const result = randomizeQuestionOrder(component);

        // matrix1 should be fixed
        expect(result.matrix1).toEqual(['Q1', 'Q2']);

        // matrix2 should have all questions
        expect(result.matrix2).toHaveLength(3);
        expect(result.matrix2.sort()).toEqual(['X', 'Y', 'Z']);
      });

      it('ignores non-matrix response types', () => {
        const component = {
          response: [
            {
              id: 'q1',
              type: 'radio' as const,
              prompt: 'Q1',
              options: ['A', 'B'],
            },
            {
              id: 'matrix1',
              type: 'matrix-radio' as const,
              prompt: 'Matrix',
              questionOptions: ['Q1', 'Q2'],
              answerOptions: ['A', 'B'],
            },
          ],
        } as IndividualComponent;

        const result = randomizeQuestionOrder(component);

        // Only matrix1 should be in the result
        expect(result).toHaveProperty('matrix1');
        expect(result).not.toHaveProperty('q1');
      });

      it('handles empty component response array', () => {
        const component = {
          type: 'questionnaire' as const,
          response: [],
        } as IndividualComponent;

        const result = randomizeQuestionOrder(component);
        expect(result).toEqual({});
      });
    });
  });
});
