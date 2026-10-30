import { Radio, Stack } from '@mantine/core';
import type { CustomResponseParams } from '../../../store/types';

export default function BooleanResponse({ response, value, field, disabled, error }: CustomResponseParams<Record<string, unknown>, boolean>) {
  return (
    <Radio.Group
      label={response.prompt}
      value={value === null ? undefined : String(value)}
      onChange={(next) => field.setValue(next === 'true')}
      error={error}
    >
      <Stack gap="sm" mt="xs">
        <Radio value="true" label="True" disabled={disabled} />
        <Radio value="false" label="False" disabled={disabled} />
      </Stack>
    </Radio.Group>
  );
}
