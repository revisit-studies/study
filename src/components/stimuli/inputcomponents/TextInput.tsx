import { TextInput } from "@mantine/core";
import { forwardRef, type Ref } from "react";

// ? @Jack - I am not sure of the purpose of this component? If it is just to use the inputRef, we don't need it.

type inputProps = {
  placeholder: string;
  label: string;
  required: boolean;
  id:string;
  answer:object;
};

export default function StringInput(
  { placeholder = "", label = "", required ,answer,id}: inputProps
) {
  return (
    <>
      <TextInput
        placeholder={placeholder}
        label={label}
        radius={"lg"}
        size={"md"}
        withAsterisk={required}
        {...answer}
      />
    </>
  );
};
