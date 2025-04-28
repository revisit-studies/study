import merge from 'lodash.merge';
import { isInheritedComponent } from '../parser/utils';
import { InheritedComponent, IndividualComponent, StudyConfig } from '../parser/types';

export function studyComponentToIndividualComponent(stepConfig: InheritedComponent | IndividualComponent, studyConfig: StudyConfig): IndividualComponent {
  return (isInheritedComponent(stepConfig) && studyConfig.baseComponents
    ? (merge(
      {},
      studyConfig.baseComponents?.[stepConfig.baseComponent],
      stepConfig,
    ) as IndividualComponent)
    : (stepConfig as IndividualComponent));
}

export function getComponent(name: string, studyConfig: StudyConfig): IndividualComponent | null {
  // The only way this should happen is if the name we are getting is the name of the func, which is not a component
  if (studyConfig.components[name] === undefined) {
    return null;
  }
  return studyComponentToIndividualComponent(studyConfig.components[name], studyConfig);
}
