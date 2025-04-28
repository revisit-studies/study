import { Upset } from '@visdesignlab/upset2-react';
import movies from './movies.json' assert { type: 'json' };

export default function App() {
  return <Upset data={movies} parentHasHeight />;
}
