import { ReactNode, useEffect } from "react";

import { parseStudyConfig } from '../parser/parser';

import { useDispatch, useSelector } from "react-redux";
import { RouterProvider } from "react-router-dom";
import Consent from "../components/Consent";
import { NextButton } from "../components/NextButton";
import { Status } from "../components/Status";
import { StudyComponent } from "../parser/types";
import { createRouter } from "../routes";
import { saveConfig, type RootState } from "../store/";
import TrialController from "./TrialController";

async function fetchStudyConfig(configLocation: string) {
  const config = await (await fetch(configLocation)).text();
  return parseStudyConfig(config);
}

const elements: Record<StudyComponent["type"], ReactNode> = {
  consent: (
    <>
      <Consent />
      <Status />
    </>
  ),
  training: (
    <>
      <div>training component goes here</div>
      <NextButton />
      <Status />
    </>
  ),
  practice: (
    <>
      <div>practice component goes here</div>
      <NextButton />
      <Status />
    </>
  ),
  "attention-test": (
    <>
      <div>attention test component goes here</div>
      <NextButton />
      <Status />
    </>
  ),
  trials: <TrialController />,
  survey: (
    <>
      <div>survey component goes here</div>
      <NextButton />
      <Status />
    </>
  ),
  end: (
    <>
      <div>Fin. Thank you</div>
      <NextButton />
      <Status />
    </>
  ),
};

export default function StudyController() {
  const dispatch = useDispatch();

  // Get the whole study config
  const studyConfig = useSelector((state: RootState) => state.study.config);

  useEffect(() => {
    fetchStudyConfig("/src/configs/config-cleveland.hjson").then((config) => {
      if (!studyConfig) dispatch(saveConfig(config));
    });
  }, [studyConfig]);

  const router = createRouter(studyConfig, elements);

  if (!router) return <div>Loading...</div>;

  return <RouterProvider router={router} />;
}
