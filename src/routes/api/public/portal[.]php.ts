import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/api/public/portal.php')({
  server: { handlers: {
    GET: async ({ request }) => (await import('@/lib/mac-portal.server')).handleMacPortal(request),
    POST: async ({ request }) => (await import('@/lib/mac-portal.server')).handleMacPortal(request),
    OPTIONS: async ({ request }) => (await import('@/lib/mac-portal.server')).handleMacPortal(request),
  } },
});
