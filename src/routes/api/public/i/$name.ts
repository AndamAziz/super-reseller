import { createFileRoute } from '@tanstack/react-router';
import { handleImageLink } from '@/lib/image-link.server';

export const Route = createFileRoute('/api/public/i/$name')({
  server: { handlers: {
    GET: ({ params }) => handleImageLink(params.name),
    HEAD: ({ params }) => handleImageLink(params.name),
  } },
});
