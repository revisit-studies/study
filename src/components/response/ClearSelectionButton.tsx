import React from 'react';

export default function ClearSelectionButton({
  onClick,
  disabled,
  visible = true,
}: {
  onClick: () => void;
  disabled?: boolean;
  visible?: boolean;
}) {
  const isDisabled = !!disabled || !visible;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isDisabled}
      aria-hidden={!visible}
      style={{
        fontSize: '0.7rem',
        color: 'var(--mantine-color-gray-6)',
        border: '1px solid var(--mantine-color-gray-3)',
        background: 'transparent',
        fontWeight: 400,
        padding: '0px 2px',
        borderRadius: 4,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        visibility: visible ? 'visible' : 'hidden',
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
        whiteSpace: 'nowrap',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      Clear selection
    </button>
  );
}
