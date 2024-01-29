import { Image } from '@mantine/core';
import { PREFIX } from '../components/GlobalConfigParser';
import { ImageComponent } from '../parser/types';

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
