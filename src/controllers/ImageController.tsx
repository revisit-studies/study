const defaultStyle = {
  maxWidth: "100%",
};

const ImageController = ({
  path,
  style = {},
}: {
  path?: string;
  style?: { [key: string]: any };
}) => {
  const imageStyle = { ...defaultStyle, ...style };

  return (
    <div>
      <img src={`/image-stimuli/${path}`} style={imageStyle} />
    </div>
  );
};

export default ImageController;
