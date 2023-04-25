import {useAppSelector} from '../index';

export function useIdentifiers() {
    const {studyIdentifiers} = useAppSelector((state) => state.study);
    return studyIdentifiers;
}