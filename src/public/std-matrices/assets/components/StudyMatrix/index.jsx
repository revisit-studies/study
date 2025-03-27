import { Provider } from "react-redux";
import store from "../../features/store";
import StudyMatrixComponent from "./StudyMatrixComponent";

const Matrix = ({ parameters, setAnswer, provenanceState }) => (
  <Provider store={store}>
    <StudyMatrixComponent
      parameters={parameters}
      setAnswer={setAnswer}
      provenanceState={provenanceState}
    />
  </Provider>
);

export default Matrix;
