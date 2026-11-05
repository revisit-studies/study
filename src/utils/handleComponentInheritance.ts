import merge from 'lodash.merge';
import { isInheritedComponent } from '../parser/utils';
import { InheritedComponent, IndividualComponent, StudyConfig } from '../parser/types';

/** Keep existing component merge semantics, but replace a visibility condition as a whole. */
export function mergeComponentConfigs(
  base: Partial<IndividualComponent> | undefined,
  component: InheritedComponent | IndividualComponent,
): IndividualComponent {
  const resolved = merge({}, base, component) as IndividualComponent;
  component.response?.forEach((response, index) => {
    if (response.visibleIf !== undefined && resolved.response?.[index]) {
      resolved.response[index].visibleIf = structuredClone(response.visibleIf);
    }
  });
  return resolved;
}

export function studyComponentToIndividualComponent(stepConfig: InheritedComponent | IndividualComponent, studyConfig: StudyConfig): IndividualComponent {
  return (isInheritedComponent(stepConfig) && studyConfig.baseComponents
    ? mergeComponentConfigs(studyConfig.baseComponents[stepConfig.baseComponent], stepConfig)
    : (stepConfig as IndividualComponent));
}

export function getComponent(name: string, studyConfig: StudyConfig): IndividualComponent | null {
  // The only way this should happen is if the name we are getting is the name of the func, which is not a component
  if (studyConfig.components[name] === undefined) {
    return null;
  }
  return studyComponentToIndividualComponent(studyConfig.components[name], studyConfig);
}
