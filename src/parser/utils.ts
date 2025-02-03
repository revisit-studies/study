import { Sequence } from '../store/types';
import {
  ComponentBlock, FuncComponentBlock, IndividualComponent, InheritedComponent,
} from './types';

export function isInheritedComponent(comp: IndividualComponent | InheritedComponent) : comp is InheritedComponent {
  return (<InheritedComponent>comp).baseComponent !== undefined;
}

export function isFuncComponentBlock(comp: ComponentBlock | FuncComponentBlock | Sequence) : comp is FuncComponentBlock {
  return (<FuncComponentBlock>comp).order === 'func';
}
