import { createFileRoute } from '@tanstack/react-router';
import { handlePublicVideoLink } from '@/lib/public-video-link.server';

export const Route = createFileRoute('/api/public/v/$name')({
  server: { handlers: {
    GET: ({ params }) => handlePublicVideoLink(params.name),
    HEAD: ({ params }) => handlePublicVideoLink(params.name),
  } },
});
