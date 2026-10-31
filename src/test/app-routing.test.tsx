import { QueryClient } from "@tanstack/react-query";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { routeTree } from "@/routeTree.gen";
import { supabase } from "@/integrations/supabase/client";

const documentShell = routeTree.options.shellComponent;
const clients: QueryClient[] = [];

async function renderAt(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.push(queryClient);
  const router = createRouter({
    routeTree,
    context: { queryClient },
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  await router.load();
  render(<RouterProvider router={router} />);
  return router;
}

beforeAll(() => {
  // React 19 document shells belong at document level, not RTL's div container.
  // Exercise the real route components without nesting html inside that div.
  routeTree.options.shellComponent = undefined;
});

afterAll(() => { routeTree.options.shellComponent = documentShell; });

beforeEach(() => {
  // Keep the signed-out redirect deterministic and avoid a hosted auth request.
  vi.spyOn(supabase.auth, "getUser").mockResolvedValue({ data: { user: null }, error: null });
});

afterEach(() => {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
  vi.restoreAllMocks();
});

// Assert route outcomes rather than copy, styling or markup.
describe("App routing", () => {
  it("renders the index route", async () => {
    const router = await renderAt("/");

    await waitFor(() => expect(router.state.location.pathname).toBe("/auth"));
    expect(router.state.matches.at(-1)?.routeId).toBe("/auth");
    expect(router.state.matches.every((match) => match.status === "success")).toBe(true);
  });

  it("renders the not-found route", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const router = await renderAt("/this-route-does-not-exist");

    await waitFor(() => expect(router.state.status).toBe("idle"));
    expect(router.state.location.pathname).toBe("/this-route-does-not-exist");
    expect(router.state.matches.some((match) => match.globalNotFound || match.status === "notFound")).toBe(true);
  });
});
