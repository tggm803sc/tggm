import VideoStudioClient from './VideoStudioClient';

export default function VideoStudioPage() {
  const baseUrl = process.env.TGG_VIDEO_AI_PUBLIC_BASE_URL ?? 'http://127.0.0.1:10050';
  return <VideoStudioClient baseUrl={baseUrl} />;
}
