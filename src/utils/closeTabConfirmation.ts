export function shouldConfirmTabClose(
  isAnalysis: boolean,
  currentComponent: string,
  developmentModeEnabled: boolean,
  isCompleted: boolean,
  dataCollectionEnabled: boolean,
): boolean {
  if (isAnalysis || developmentModeEnabled) {
    return false;
  }

  if (currentComponent === 'end') {
    return dataCollectionEnabled && !isCompleted;
  }

  return true;
}

export function handleBeforeUnload(event: BeforeUnloadEvent): void {
  event.preventDefault();
  event.returnValue = '';
}
