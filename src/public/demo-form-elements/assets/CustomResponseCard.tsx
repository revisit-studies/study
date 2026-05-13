import {
  Badge, Button, Code, Group, NumberInput, Paper, Stack, Text, Textarea,
} from '@mantine/core';
import { CustomResponseParams, CustomResponseValidate } from '../../../store/types';
import { JsonValue } from '../../../parser/types';

interface CustomResponseParameters {
  chartOptions?: string[];
  minimumConfidence?: number;
}

interface CustomResponseValue {
  chartType?: string;
  confidence?: number | null;
  rationale?: string;
}

const EMPTY_VALUE: CustomResponseValue = {
  chartType: '',
  confidence: null,
  rationale: '',
};

export function normalizeConfidenceValue(value: string | number): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  const trimmedValue = value.trim();
  if (trimmedValue.length === 0) {
    return null;
  }

  const parsedValue = Number(trimmedValue);
  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function getStructuredValue(value: JsonValue | null): CustomResponseValue {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return {
      chartType: typeof value.chartType === 'string' ? value.chartType : '',
      confidence: typeof value.confidence === 'number' ? value.confidence : null,
      rationale: typeof value.rationale === 'string' ? value.rationale : '',
    };
  }

  return EMPTY_VALUE;
}

export const validate: CustomResponseValidate = (value, _values, response) => {
  const structuredValue = getStructuredValue(value);
  const minimumConfidence = typeof response.parameters?.minimumConfidence === 'number'
    ? response.parameters.minimumConfidence
    : 70;

  if (!structuredValue.chartType) {
    return 'Select a chart type to continue.';
  }

  if (structuredValue.confidence == null || structuredValue.confidence < minimumConfidence) {
    return `Set confidence to at least ${minimumConfidence} to continue.`;
  }

  return null;
};

export default function CustomResponseCard({
  response,
  parameters,
  value,
  error,
  disabled,
  field,
}: CustomResponseParams<CustomResponseParameters>) {
  const structuredValue = getStructuredValue(value);
  const chartOptions = parameters?.chartOptions || ['Bar', 'Line', 'Scatter'];
  const minimumConfidence = parameters?.minimumConfidence ?? 70;

  const updateValue = (partial: Partial<CustomResponseValue>) => {
    field.setValue({
      ...structuredValue,
      ...partial,
    });
  };

  return (
    <Paper withBorder p="md" radius="md">
      <Stack gap="md">
        <Stack gap={4}>
          <Text fw={600}>
            {response.prompt}
          </Text>
          {response.secondaryText && (
          <Text c="dimmed" size="sm">
            {response.secondaryText}
          </Text>
          )}
        </Stack>

        <Group gap="sm">
          {chartOptions.map((option) => (
            <Button
              key={option}
              variant={structuredValue.chartType === option ? 'filled' : 'default'}
              onClick={() => updateValue({ chartType: option })}
              disabled={disabled}
            >
              {option}
            </Button>
          ))}
        </Group>

        <NumberInput
          label="Confidence"
          description={`Choose a confidence of at least ${minimumConfidence}.`}
          min={0}
          max={100}
          value={structuredValue.confidence ?? undefined}
          onChange={(nextValue) => updateValue({ confidence: normalizeConfidenceValue(nextValue) })}
          onBlur={() => field.onBlur()}
          disabled={disabled}
        />

        <Textarea
          label="Rationale"
          placeholder="Optional notes about your choice"
          value={structuredValue.rationale}
          onChange={(event) => updateValue({ rationale: event.currentTarget.value })}
          onBlur={() => field.onBlur()}
          disabled={disabled}
        />

        <Group gap="xs">
          <Badge variant="light">Structured answer</Badge>
          <Code>{JSON.stringify(structuredValue)}</Code>
        </Group>

        {error && (
        <Text c="red" size="sm">
          {error}
        </Text>
        )}
      </Stack>
    </Paper>
  );
}
