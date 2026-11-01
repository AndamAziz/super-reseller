import { createFileRoute } from '@tanstack/react-router';
import { handleContentApi } from '@/lib/content-api.server';

export const Route = createFileRoute('/api/public/content')({
  server: { handlers: { GET: ({ request }) => handleContentApi(request), POST: ({ request }) => handleContentApi(request) } },
});