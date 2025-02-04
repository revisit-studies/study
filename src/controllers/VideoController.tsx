import ReactPlayer from 'react-player';
import { VideoComponent } from '../parser/types';

export function VideoController({ currentConfig }: { currentConfig: VideoComponent; }) {
  return (
    <ReactPlayer url={currentConfig.path} />
  );
}
