import { Response } from "../../../parser/types";
import {saveTrialAnswer, TrialResult, useAppDispatch, useNextStep, useTrialStatus} from "../../../store";
import ResponseSwitcher from "./ResponseSwitcher";
import {NextButton} from "../../NextButton";
import {Group} from "@mantine/core";
import {useCurrentStep} from "../../../routes";
import {useParams} from "react-router-dom";
import {createTrialProvenance} from "../../../store/trialProvenance";
import {useNextTrialId, useTrialsConfig} from "../../../controllers/TrialController";
import {useForm} from "@mantine/form";
import {useEffect} from "react";



type Props = {
    response: Response;
};

export default function ResponseBlock({ response }: Props) {
    const { type, desc, prompt, options, required, preset,max,min } = response;

    const dispatch = useAppDispatch();
    const currentStep = useCurrentStep();
    const nextStep = useNextStep();
    const { trialId = null } = useParams<{ trialId: string }>();
    const config = useTrialsConfig();
    const nextTrailId = useNextTrialId(trialId);
    const trialStatus = useTrialStatus(trialId);
    const trialProvenance = createTrialProvenance();
    console.log(trialId,"trialId")
    if (!type || !trialStatus || !trialId) return <></>;


    const answerField = useForm({
        initialValues: {
            input: trialStatus.answer || "",
        },
        transformValues(values) {
            return {
                answer: parseFloat(values.input),
            };
        },
        validate: {
            input: (value) => {
                if (value.length === 0) return null;
                const ans = parseFloat(value);
                if (isNaN(ans)) return "Please enter a number";
                return ans < 0 || ans > 100 ? "The answer is range from 0 - 100" : null;
            },
        },
        validateInputOnChange: ["input"],
    });

    useEffect(() => {
        answerField.setFieldValue("input", trialStatus.answer || "");
    }, [trialStatus.answer]);

    return (
        <>
            <ResponseSwitcher status={trialStatus} response={response} />
            <Group position="right" spacing="xs" mt="xl">
                {nextTrailId ? (
                    <NextButton
                        // disabled={
                        //   !trialStatus.complete &&
                        //   (answerField.values.input.length === 0 ||
                        //     !answerField.isValid("input"))
                        // }
                        to={`/${currentStep}/${nextTrailId}`}
                        process={() => {
                            if (trialStatus.complete) {
                                answerField.setFieldValue("input", "");
                            }

                            const answer = answerField.getTransformedValues().answer;

                            dispatch(
                                saveTrialAnswer({
                                    trialName: currentStep,
                                    trialId,
                                    answer: answer.toString(),
                                })
                            );

                            answerField.setFieldValue("input", "");
                        }}
                    />
                ) : (
                    <NextButton
                        to={`/${nextStep}`}
                        process={() => {
                            // complete trials
                        }}
                    />
                )}
            </Group>
        </>
    );
}
