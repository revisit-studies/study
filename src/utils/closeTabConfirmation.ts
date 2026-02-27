export function shouldConfirmTabClose(isAnalysis: boolean, currentComponent: string): boolean {
  return !isAnalysis && currentComponent !== 'end';
}

export function handleBeforeUnload(event: BeforeUnloadEvent): void {
  event.preventDefault();
  event.returnValue = '';
}
