import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/api/public/c/')({
  server: { handlers: {
    GET: async ({ request }) => {
      const url = new URL(request.url);
      if (!url.searchParams.has('action') && !url.searchParams.has('type')) {
        return (await import('@/lib/mac-portal-screen')).portalScreen();
      }
      return (await import('@/lib/mac-portal.server')).handleMacPortal(request);
    },
    POST: async ({ request }) => (await import('@/lib/mac-portal.server')).handleMacPortal(request),
    OPTIONS: async ({ request }) => (await import('@/lib/mac-portal.server')).handleMacPortal(request),
  } },
});
