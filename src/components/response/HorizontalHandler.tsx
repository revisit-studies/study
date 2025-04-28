import { Stack, Group, rem } from '@mantine/core';

export function HorizontalHandler({ horizontal, children, style }: { horizontal: boolean; children: React.ReactNode, style: React.CSSProperties }) {
  if (horizontal) {
    return (
      <Group mt={rem(4)} gap="lg" style={style}>
        {children}
      </Group>
    );
  }
  return (
    <Stack gap="md" style={style}>
      {children}
    </Stack>
  );
}
