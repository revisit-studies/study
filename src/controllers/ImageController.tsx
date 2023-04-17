import { Image } from '@mantine/core';

const defaultStyle = {
  maxWidth: '100%',
};

const ImageController = ({
  path,
  style = {},
}: {
  path?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  style?: { [key: string]: any };
}) => {
  const imageStyle = { ...defaultStyle, ...style };

  return (
    <Image mx="auto" src={`/image-stimuli/${path}`} style={imageStyle} />
  );
};

export default ImageController;
