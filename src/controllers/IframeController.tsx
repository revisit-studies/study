import { useRef } from "react";

const IframeController = ({ path }: { path?: string }) => {
  const ref = useRef<HTMLIFrameElement>(null);
  return (
    <div>
      <iframe
        ref={ref}
        src={`html-stimuli/${path}`}
        style={{ height: "60vh", width: "100%" }}
      ></iframe>
    </div>
  );
};

export default IframeController;
