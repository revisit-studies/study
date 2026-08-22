import React from 'react';

export default function ClearSelectionButton({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        fontSize: '0.8rem',
        color: 'var(--mantine-color-gray-6)',
        border: '1px solid var(--mantine-color-gray-3)',
        background: 'transparent',
        fontWeight: 400,
        padding: '4px 8px',
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      Clear selection
    </button>
  );
}
