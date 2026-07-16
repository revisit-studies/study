import { Tooltip } from '@mantine/core';
import { IconSquareFilled } from '@tabler/icons-react';
import type { CSSProperties } from 'react';

export const UNKNOWN_ANSWER_LABEL = 'Response recorded; correctness not configured.';

export function UnknownAnswerIcon({
  size,
  style,
}: {
  size: number;
  style?: CSSProperties;
}) {
  return (
    <Tooltip label={UNKNOWN_ANSWER_LABEL} withArrow>
      <IconSquareFilled
        aria-label={UNKNOWN_ANSWER_LABEL}
        color="var(--mantine-color-blue-6)"
        size={size}
        style={style}
      />
    </Tooltip>
  );
}
