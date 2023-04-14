import { Button } from "@mantine/core";
import { To, useNavigate } from "react-router-dom";
import { useCurrentStep } from "../routes";
import { useNextStep } from "../store";

type Props = {
  label?: string;
  disabled?: boolean;
  process?: null | (() => void | Promise<void>);
  to?: To | "auto";
  replace?: boolean;
};

export function NextButton({
  label = "Next",
  process = null,
  to = "auto",
  disabled = false,
  replace = false,
}: Props) {
  const navigate = useNavigate();
  const computedTo = useNextStep();
  const current = useCurrentStep();

  return (
    <Button
      disabled={disabled || (to === "auto" && !computedTo)}
      onClick={async () => {
        if (process) process();
        if (to === "auto" && computedTo) {
          navigate(`/${computedTo}`, { replace });
        }
        if (to !== "auto") {
          navigate(to, { replace });
        }
      }}
    >
      {label}
    </Button>
  );
}
