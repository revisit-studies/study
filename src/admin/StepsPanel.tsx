import { Badge, Group } from "@mantine/core";
import { useAppSelector } from "../store";

export function StepsPanel() {
  // const currentStep = useCurrentStep();
  // const navigate = useNavigate();
  const currentStep = "consent";

  const { config = null } = useAppSelector((state) => state.study);

  const sequence = config?.sequence || [];

  return (
    <Group spacing="xs">
      {sequence.map((step) => (
        <Badge
          key={step}
          style={{
            cursor: "pointer",
          }}
          color={step === currentStep ? "red" : "blue"}
          // onClick={() => navigate(`/${step}`)}
          size="xs"
        >
          {step}
        </Badge>
      ))}
    </Group>
  );
}
