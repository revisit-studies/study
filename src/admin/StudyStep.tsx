export function StudyStep(props: { stepId: string }) {
  return <div>Step {props.stepId}</div>;
}

function RegularStep() {
  return <div>Regular step</div>;
}

function StepWithSubSteps() {
  return <div>Step with substeps</div>;
}
