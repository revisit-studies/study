// npm install react-router-dom localforage match-sorter sort-by // For offline + misc

import { ReactNode } from 'react';
import {
  RouteObject,
  createBrowserRouter,
  useLocation,
} from 'react-router-dom';
import { Shell } from '../components/Shell';
import TrialController from '../controllers/TrialController';
import { StudyComponent, StudyConfig, TrialsComponent} from '../parser/types';
import { NavigateWithParams } from '../utils/NavigateWithParams';

export function createRouter(
  config: StudyConfig | null,
  elements: Record<StudyComponent['type'], ReactNode>
) {
  if (!config) return null;
  const { sequence, components } = config;

  const enhancedSequence = [...sequence, 'end'];

  const routes: RouteObject[] = [
    {
      path: '/',
      element: <NavigateWithParams to={`/${sequence[0]}`} replace />,
    },
  ];

  enhancedSequence.forEach((step) => {
    const component = components[step] || null;

    const comp = elements[component?.type || 'end'];
    
    if (component?.type === 'trials' || component?.type === 'practice') {
      const { order } = component as TrialsComponent;

      const baseTrailRoute: RouteObject = {
        path: step,
        element: <NavigateWithParams to={`/${step}/${order[0]}`} replace />,
      };
      const trialRoute: RouteObject = {
        path: `${step}/:trialId`,
        element: <TrialController />,
      };
     
      routes.push(baseTrailRoute);
      routes.push(trialRoute);
    }  
    else {
      const route: RouteObject = {
        path: step,
        element: comp,
      };

      routes.push(route);
    }
  });

  const rootRoute: RouteObject = {
    path: '/',
    element: <Shell />,
    children: routes,
  };

  return createBrowserRouter([rootRoute]);
}

export function useCurrentStep() {
  const location = useLocation();
  return location.pathname.split('/')[1];
}
