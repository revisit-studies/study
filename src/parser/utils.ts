import { Sequence } from '../store/types';
import {
  DynamicBlock, FactorBlock, IndividualComponent, InheritedComponent, StudyConfig,
} from './types';

export function isInheritedComponent(comp: IndividualComponent | InheritedComponent) : comp is InheritedComponent {
  return (<InheritedComponent>comp).baseComponent !== undefined;
}

export function isDynamicBlock(comp: StudyConfig['sequence'] | Sequence) : comp is DynamicBlock {
  return (<DynamicBlock>comp).order === 'dynamic';
}

export function isFactorBlock(comp: StudyConfig['sequence'] | Sequence) : comp is FactorBlock {
  return (<FactorBlock>comp).factorsToCross !== undefined;
}
