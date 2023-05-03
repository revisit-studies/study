// npm install react-router-dom localforage match-sorter sort-by // For offline + misc

import { useLocation } from 'react-router-dom';

export type StudyIdParam = {
  studyId: string;
};

export function useStudyId(): string {
  const location = useLocation();

  return location.pathname.split('/')[1];
}

export function useCurrentStep(): string {
  const location = useLocation();

  return location.pathname.split('/')[2];
}
