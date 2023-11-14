import { StorageEngineProvider } from './store/contexts/storage';
import { GlobalInitializer } from './components/GlobalInitializer';

export default function App() {
  return (
    <StorageEngineProvider>
      <GlobalInitializer />
    </StorageEngineProvider>
  );
}
