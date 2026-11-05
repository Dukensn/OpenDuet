/**
 * Demo mode: the browser answers its own `/api` calls, so the app can be looked at with no server.
 *
 * Only built when `VITE_DEMO_MODE=true` (see main.tsx). Nothing here is real data and nothing is
 * stored: every answer is a fixture, and anything the demo does not know is answered with an empty
 * success or a plain refusal the screens already know how to show.
 */
import { demoRoutes, type DemoRoute } from "./fixtures";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

function match(method: string, path: string): DemoRoute | undefined {
  return demoRoutes.find(
    (route) =>
      (route.method ?? "GET") === method &&
      (typeof route.path === "string"
        ? route.path === path
        : route.path.test(path)),
  );
}

export function installDemoApi() {
  const realFetch = window.fetch.bind(window);
  const demoFetch = async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const url = new URL(
      typeof input === "string" || input instanceof URL ? input : input.url,
      window.location.href,
    );
    if (
      url.origin !== window.location.origin ||
      !url.pathname.startsWith("/api")
    )
      return realFetch(input, init);

    const method = (
      init?.method ?? (input instanceof Request ? input.method : "GET")
    ).toUpperCase();
    const route = match(method, url.pathname);
    if (route) {
      const answer = await route.respond({ url, init });
      return answer instanceof Response ? answer : json(answer);
    }
    console.info("[demo] no fixture for", method, url.pathname);
    // Reads get "nothing yet"; writes get a refusal that names the demo.
    return method === "GET"
      ? json({ error: "Mode démo : pas encore connecté au serveur." }, 404)
      : json({ error: "Mode démo : cette action a besoin du serveur." }, 503);
  };
  window.fetch = Object.assign(demoFetch, {
    preconnect: () => {},
  }) as typeof fetch;
}
