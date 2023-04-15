// npm install react-router-dom localforage match-sorter sort-by // For offline + misc

import { AppShell } from "@mantine/core";
import { ReactNode } from "react";
import {
  Navigate,
  Outlet,
  RouteObject,
  createBrowserRouter,
  useLocation,
} from "react-router-dom";
import AppAside from "../components/interface/AppAside";
import AppHeader from "../components/interface/AppHeader";
import AppNavBar from "../components/interface/AppNavBar";
import HelpModal from "../components/interface/HelpModal";
import TrialController from "../controllers/TrialController";
import { StudyComponent, StudyConfig, TrialsComponent } from "../parser/types";

export function createRouter(
  config: StudyConfig | null,
  elements: Record<StudyComponent["type"], ReactNode>
) {
  if (!config) return null;
  const { sequence, components } = config;

  const enhancedSequence = [...sequence, "end"];

  const routes: RouteObject[] = [
    {
      path: "/",
      element: <Navigate to={`/${sequence[0]}`} replace />,
    },
  ];

  enhancedSequence.forEach((step) => {
    const component = components[step] || null;

    const comp = elements[component?.type || "end"];

    if (component?.type === "trials") {
      const { order } = component as TrialsComponent;

      const baseTrailRoute: RouteObject = {
        path: step,
        element: <Navigate to={`/${step}/${order[0]}`} replace />,
      };

      const trialRoute: RouteObject = {
        path: `${step}/:trialId`,
        element: <TrialController />,
      };

      routes.push(baseTrailRoute);
      routes.push(trialRoute);
    } else {
      const route: RouteObject = {
        path: step,
        element: comp,
      };

      routes.push(route);
    }
  });

  const rootRoute: RouteObject = {
    path: "/",
    element: (
      <AppShell
        navbarOffsetBreakpoint="sm"
        asideOffsetBreakpoint="sm"
        navbar={<AppNavBar />}
        aside={<AppAside />}
        header={<AppHeader />}
      >
        <HelpModal /> {/* <StudyController /> */}
        <Outlet />
      </AppShell>
    ),
    children: routes,
  };

  return createBrowserRouter([rootRoute]);
}

export function useCurrentStep() {
  const location = useLocation();
  return location.pathname.split("/")[1];
}
