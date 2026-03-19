import { useMemo } from 'react';
import { CustomResponse, JsonValue } from '../../parser/types';
import { ResourceNotFound } from '../../ResourceNotFound';
import { CustomResponseField } from '../../store/types';
import { ErrorBoundary } from '../../controllers/ErrorBoundary';
import { useIsAnalysis } from '../../store/hooks/useIsAnalysis';
import { getCustomResponseModule } from './customResponseModules';

export function CustomResponseInput({
  response,
  disabled,
  value,
  error,
  index,
  enumerateQuestions,
  field,
}: {
  response: CustomResponse;
  disabled: boolean;
  value: JsonValue | null;
  error?: string;
  index: number;
  enumerateQuestions: boolean;
  field: CustomResponseField;
}) {
  const isAnalysis = useIsAnalysis();
  const customResponseModule = useMemo(() => getCustomResponseModule(response), [response]);
  const ResponseComponent = customResponseModule?.default || null;

  if (!ResponseComponent) {
    return <ResourceNotFound path={response.path} />;
  }

  return (
    <ErrorBoundary>
      <ResponseComponent
        response={response}
        parameters={response.parameters}
        value={value}
        error={error}
        disabled={disabled}
        isAnalysis={isAnalysis}
        index={index}
        enumerateQuestions={enumerateQuestions}
        field={field}
      />
    </ErrorBoundary>
  );
}
