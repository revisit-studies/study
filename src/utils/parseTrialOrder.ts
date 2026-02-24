export function parseTrialOrder(trialOrder?: string): { step: number | null; funcIndex: number | null } {
  if (!trialOrder) {
    return { step: null, funcIndex: null };
  }

  const [stepRaw, funcIndexRaw] = trialOrder.split('_');
  const step = Number.parseInt(stepRaw, 10);
  const parsedFuncIndex = funcIndexRaw === undefined ? null : Number.parseInt(funcIndexRaw, 10);

  return {
    step: Number.isFinite(step) ? step : null,
    funcIndex: parsedFuncIndex !== null && Number.isFinite(parsedFuncIndex) ? parsedFuncIndex : null,
  };
}
