import { Alert } from '@mantine/core';
import { useStudyId } from '../../routes/utils';
import { useDesignerPreview } from '../../store/hooks/useDesignerPreview';

export function RestorationWarning({ component, visible, website = false }: { component: string; visible: boolean; website?: boolean }) {
  const preview = useDesignerPreview(useStudyId());
  if (!preview || !visible) return null;
  return (
    <Alert color="yellow" role="alert" title={`State restoration: ${component}`} mb="sm">
      This component has saved participant data but has not registered state restoration.
      Returning with Previous may reset its interface or overwrite responses.
      {' '}
      {website ? 'Use Revisit.onRestore and Revisit.completeRegistration.' : 'Use useStudyState or useStatelessStudyComponent for a stateless component.'}
    </Alert>
  );
}
