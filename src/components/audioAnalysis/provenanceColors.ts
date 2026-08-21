/* eslint-disable no-bitwise */
import { TrrackedProvenance } from '../../store/types';

export const PROVENANCE_COLOR_PALETTE = ['#4269d0', '#ff725c', '#6cc5b0', '#3ca951', '#ff8ab7', '#a463f2', '#97bbf5', '#9c6b4e'];
export const ROOT_COLOR = '#efb118';
export const UNKNOWN_COLOR = '#9498a0';
export const FORM_UPDATE_COLOR = '#9498a0';

export const ROOT_KEY = '__root__';
export const UNKNOWN_KEY = '__unknown__';
export const FORM_UPDATE_KEY = 'update';

type ProvenanceNode = TrrackedProvenance['nodes'][string];
type ProvenanceGraph = TrrackedProvenance | undefined;

function normalizeKeyText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeActionName(name: string): string {
  return normalizeKeyText(name);
}

function getNodeActionType(node: ProvenanceNode, normalize = false): string | null {
  if ('sideEffects' in node && node.sideEffects?.do?.length > 0) {
    const firstType = node.sideEffects.do.find((action) => typeof action?.type === 'string')?.type;
    if (firstType) {
      return normalize ? normalizeKeyText(firstType) : firstType.trim();
    }
  }
  return null;
}

export function getNodeColorKey(node: ProvenanceNode): string {
  if (node.event === 'Root') {
    return ROOT_KEY;
  }

  const actionType = getNodeActionType(node, true);
  if (actionType) {
    return actionType;
  }

  if ('event' in node && typeof node.event === 'string' && node.event !== 'Root') {
    const normalizedEvent = normalizeKeyText(node.event);
    if (normalizedEvent) {
      return normalizedEvent;
    }
  }

  if (typeof node.label === 'string') {
    const normalizedLabel = normalizeActionName(node.label);
    if (normalizedLabel) {
      return normalizedLabel;
    }
  }

  return UNKNOWN_KEY;
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function isFormUpdateKey(key: string): boolean {
  return key === FORM_UPDATE_KEY || key === normalizeKeyText('Update form field');
}

export function getColorForKey(key: string): string {
  if (key === ROOT_KEY) {
    return ROOT_COLOR;
  }
  if (!key || key === UNKNOWN_KEY) {
    return UNKNOWN_COLOR;
  }

  if (isFormUpdateKey(key)) {
    return FORM_UPDATE_COLOR;
  }

  // Use deterministic HSL from a 32-bit hash to greatly reduce collisions
  // compared to a fixed-size palette while keeping colors readable.
  const hash = hashString(key);
  const hue = hash % 360;
  const saturation = 60 + ((hash >>> 9) % 21); // 60-80
  const lightness = 35 + ((hash >>> 17) % 21); // 35-55

  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

export function getNodeColor(node: ProvenanceNode): string {
  return getColorForKey(getNodeColorKey(node));
}

export function getNodeDisplayLabel(node: ProvenanceNode): string {
  const label = typeof node.label === 'string' ? node.label.trim() : '';
  if (label) {
    return label;
  }

  const actionType = getNodeActionType(node, false);
  if (actionType) {
    return actionType;
  }

  if ('event' in node && typeof node.event === 'string') {
    const eventName = node.event.trim();
    if (eventName) {
      return eventName;
    }
  }

  return UNKNOWN_KEY;
}

export function buildProvenanceLegendEntries(graphs: ProvenanceGraph[]): Map<string, { label: string; color: string }> {
  const entries = new Map<string, { label: string; color: string }>();

  graphs.forEach((graph) => {
    if (!graph?.nodes) {
      return;
    }

    Object.values(graph.nodes).forEach((node) => {
      const key = getNodeColorKey(node);
      if (!entries.has(key)) {
        entries.set(key, {
          label: getNodeDisplayLabel(node),
          color: getColorForKey(key),
        });
      }
    });
  });

  return entries;
}
