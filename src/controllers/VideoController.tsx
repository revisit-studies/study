import ReactPlayer from 'react-player';
import { useState } from 'react';
import { VideoComponent } from '../parser/types';

export function VideoController({ currentConfig }: { currentConfig: VideoComponent; }) {
  const [_, setEnded] = useState(false);

  const onEnded = () => {
    setEnded(true);
  };

  return (
    <ReactPlayer url={currentConfig.path} onEnded={onEnded} controls={false} />
  );
}
