import { Image } from '@mantine/core';
import { ImageComponent } from '../parser/types';
import { PREFIX } from '../components/Prefix';

const defaultStyle = {
  maxWidth: '100%',
};

function ImageController({ currentConfig }: { currentConfig: ImageComponent; }) {
  const imageStyle = { ...defaultStyle, ...currentConfig.style };

  return (
    <Image mx="auto" src={`${PREFIX}${currentConfig.path}`} style={imageStyle} />
  );
}

export default ImageController;
