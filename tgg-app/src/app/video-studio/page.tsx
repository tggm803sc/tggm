import VideoStudioClient from './VideoStudioClient';

export default function VideoStudioPage() {
  const baseUrl = '/video-ai';
  return <VideoStudioClient baseUrl={baseUrl} />;
}
