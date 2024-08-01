import React, { useRef, useEffect } from 'react';

interface CustomVideoPlayerProps {
  src: string;
}

const CustomVideoPlayer: React.FC<CustomVideoPlayerProps> = ({ src }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.addEventListener('contextmenu', e => e.preventDefault());
      video.addEventListener('error', (e) => {
        console.error('Video error:', e);
        alert('There was an error loading the video.');
      });
    }
  }, []);

  return (
    <video 
      ref={videoRef}
      src={src} 
      controls 
      className="w-full rounded-lg shadow-md"
      controlsList="nodownload"
    >
      Your browser does not support the video tag.
    </video>
  );
};

export default CustomVideoPlayer;

