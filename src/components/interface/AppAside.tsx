import { Aside } from "@mantine/core";
import { StepsPanel } from "../../admin/StepsPanel";
import { useFlagsSelector } from "../../store/flags";

export default function AppAside() {
  const showAdmin = useFlagsSelector((state: any) => state.showAdmin);

  return showAdmin ? (
    <Aside p="md" width={{ lg: 300 }} style={{ zIndex: 0 }}>
      <StepsPanel />
    </Aside>
  ) : null;
}
