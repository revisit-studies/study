import React from 'react';

interface ViewerParams {
  websiteLink: string;
  pairNumber: number;
}

interface Props {
  parameters: ViewerParams;
  setAnswer: (args: { status: boolean; answers: Record<string, any> }) => void;
}

const ImageViewer = ({ parameters }: Props) => {
  const { websiteLink, pairNumber } = parameters;

  return (
    <div className="flex flex-col h-screen">
      <div className="flex-1">
        <iframe 
          src={websiteLink}
          className="w-full h-full border-none"
          scrolling="no"
          allowFullScreen
        />
      </div>
      <div className="text-center text-2xl font-medium text-gray-700 py-4">
        Image Pair {pairNumber}
      </div>
    </div>
  );
};

export default ImageViewer;