import { useEffect, useRef, useState } from "react";

const defaultStyle = {
  minHeight: "300px",
  width: "100%",
  border: 0,
};

const IframeController = ({ path, style={} }: { path?: string; style?: { [key: string]: any } }) => {
  const iframeStyle = { ...defaultStyle, ...style };

  return (
    <div>
      <iframe
        src={`/html-stimuli/${path}`}
        style={iframeStyle}
      ></iframe>
    </div>
  );
};

export default IframeController;
