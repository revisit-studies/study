import merge from 'lodash.merge';
import { isInheritedComponent } from '../parser/parser';
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
