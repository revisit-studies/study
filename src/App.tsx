import {
  AppShell,
  Aside,
  Burger,
  Footer,
  Header,
  MediaQuery,
  Navbar,
  Text,
  useMantineTheme,
} from "@mantine/core";
import { ProvVis } from "@trrack/vis-react";
import { createContext, useEffect, useState } from "react";

import { TrrackStoreType } from "@trrack/redux";
import { createSelectorHook, Provider } from "react-redux";
import { store, trrack, trrackStore } from "./store";

import { StepsPanel } from "./admin/StepsPanel";
import StudyController from "./controllers/StudyController";

const trrackContext = createContext<TrrackStoreType>(undefined!);
export const useTrrackSelector = createSelectorHook(trrackContext as any);

export default function AppShellDemo() {
  const theme = useMantineTheme();
  const [opened, setOpened] = useState(false);
  const [current, setCurrent] = useState(trrackStore.getState().current);

  useEffect(() => {
    return trrackStore.subscribe(() => {
      const curr = trrackStore.getState().current;
      setCurrent(curr);
    });
  }, []);

  return (
    <Provider store={trrackStore} context={trrackContext as any}>
      <Provider store={store}>
        <AppShell
          styles={{
            main: {
              background:
                theme.colorScheme === "dark"
                  ? theme.colors.dark[8]
                  : theme.colors.gray[0],
            },
          }}
          navbarOffsetBreakpoint="sm"
          asideOffsetBreakpoint="sm"
          navbar={
            <Navbar
              p="md"
              hiddenBreakpoint="sm"
              hidden={!opened}
              width={{ sm: 200, lg: 300 }}
            >
              <Text>Application navbar</Text>
            </Navbar>
          }
          aside={
            <MediaQuery smallerThan="sm" styles={{ display: "none" }}>
              <Aside p="md" hiddenBreakpoint="sm" width={{ sm: 200, lg: 300 }}>
                <Text>Application sidebar</Text>

                <StepsPanel />

                <ProvVis
                  root={trrack.root.id}
                  currentNode={current}
                  nodeMap={trrack.graph.backend.nodes}
                />
              </Aside>
            </MediaQuery>
          }
          footer={
            <Footer height={60} p="md">
              Application footer
            </Footer>
          }
          header={
            <Header height={{ base: 50, md: 70 }} p="md">
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  height: "100%",
                }}
              >
                <MediaQuery largerThan="sm" styles={{ display: "none" }}>
                  <Burger
                    opened={opened}
                    onClick={() => setOpened((o) => !o)}
                    size="sm"
                    color={theme.colors.gray[6]}
                    mr="xl"
                  />
                </MediaQuery>

                <Text>Application header</Text>
              </div>
            </Header>
          }
        >
          <StudyController />
        </AppShell>
      </Provider>
    </Provider>
  );
}
