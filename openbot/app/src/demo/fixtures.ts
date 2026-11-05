/** The answers demo mode gives. Shapes follow what each screen reads; values are made up. */
export type DemoRoute = {
  method?: string;
  path: string | RegExp;
  respond: (request: { url: URL; init?: RequestInit }) => unknown;
};

const now = new Date().toISOString();
const hoursAgo = (hours: number) =>
  new Date(Date.now() - hours * 3_600_000).toISOString();

export const demoUser = {
  id: "demo-user",
  email: "demo@example.com",
  name: "Démo",
  image: null,
  role: "admin" as const,
  onboarding: { step: 99, completedAt: now },
};

const bot = {
  id: "openduet",
  name: "OpenDuet",
  title: "Assistant",
  roleDescription: "Votre assistant proactif (mode démo).",
  avatarSeed: "openduet",
  visibility: "public",
  endpoint: null,
  builtIn: true,
  hasAuth: false,
  hasCallbackToken: false,
  hidden: false,
  pinned: true,
  systemOwned: true,
  canManage: true,
  mine: true,
};

const channel = {
  id: "demo-channel",
  name: "Everything",
  agentIds: ["openduet"],
  threadId: "demo-thread",
  active: true,
  lastMessageAt: hoursAgo(1),
  summary: "Conversation de démo",
  lastMessage: "Bonjour ! Je suis en mode démo.",
  lastMessageAgentId: "openduet",
  createdAt: hoursAgo(24),
  pinned: false,
  lastReadAt: now,
  taskId: null,
  openduetChannel: false,
  busy: false,
};

const task = (
  id: string,
  title: string,
  status: string,
  why: string,
  next: string | null,
) => ({
  id,
  botId: "openduet",
  channelId: `demo-task-${id}`,
  threadId: `demo-task-thread-${id}`,
  title,
  why,
  origin: "suggestion",
  suggestionId: null,
  sourceApp: null,
  sourceLink: null,
  fromChannelId: null,
  status,
  failure: null,
  failedAt: null,
  next,
  resolvedAt: status === "resolved" ? hoursAgo(2) : null,
  createdAt: hoursAgo(5),
  updatedAt: hoursAgo(1),
});

const tasks = [
  task(
    "1",
    "Répondre au devis de Marie",
    "needs_input",
    "Elle attend une réponse depuis hier.",
    "Je propose 1 200 € : on valide ?",
  ),
  task(
    "2",
    "Préparer la réunion de jeudi",
    "working",
    "Réunion client à 10 h.",
    null,
  ),
  task(
    "3",
    "Résumer les emails de la semaine",
    "ready_for_review",
    "Demandé lundi.",
    "Le résumé est prêt.",
  ),
];

export const demoRoutes: DemoRoute[] = [
  { path: "/api/me", respond: () => ({ user: demoUser }) },
  {
    path: "/api/capabilities",
    respond: () => ({
      authProviders: [],
      ssoConfigured: false,
      ssoRequired: false,
    }),
  },
  { path: "/api/agents", respond: () => ({ agents: [bot] }) },
  { path: "/api/agents/openduet", respond: () => ({ agent: bot }) },
  {
    path: "/api/agents/capabilities",
    respond: () => ({ capabilities: { builtInAvailable: true } }),
  },
  {
    path: "/api/channels",
    respond: () => ({ channels: [channel], nextCursor: null }),
  },
  { path: "/api/channels/demo-channel", respond: () => ({ channel }) },
  { path: "/api/openduet/tasks", respond: () => ({ tasks }) },
  {
    path: /^\/api\/openduet\/tasks\/[^/]+$/,
    respond: ({ url }) => ({
      task: tasks.find((t) => url.pathname.endsWith(`/${t.id}`)) ?? tasks[0],
    }),
  },
  {
    path: "/api/approvals",
    respond: () => ({
      enabled: true,
      requests: [],
      questions: [],
      rules: [],
      teamRules: [],
    }),
  },
  {
    path: "/api/settings/preferences",
    respond: () => ({
      preferences: {
        messageListEmphasis: "thread",
        selfHostBannerDismissed: true,
      },
    }),
  },
  { path: "/api/bots/attention", respond: () => ({ bots: [] }) },
  { path: "/api/sandboxed/published", respond: () => ({ components: [] }) },
  { path: "/api/sandboxed", respond: () => ({ components: [] }) },
  {
    path: "/api/admin/enterprise/me",
    respond: () => ({ capabilities: {}, enforced: false }),
  },
  {
    method: "PUT",
    path: "/api/components/catalogue",
    respond: () => ({ ok: true }),
  },
  {
    path: /^\/api\/plugins\/for\/[^/]+$/,
    respond: () => ({ tools: [], skills: [] }),
  },
  { path: "/api/openduet/pages", respond: () => ({ pages: [] }) },
  {
    path: /^\/api\/computers\/[^/]+\/control$/,
    respond: () => ({ holder: "bot" }),
  },
  { path: "/api/proactive/suggestions", respond: () => ({ suggestions: [] }) },
  {
    path: "/api/voice/sessions",
    respond: () => ({ sessions: [], nextCursor: null }),
  },
  { path: /^\/api\/plugins\/for\/[^/]+\/apps$/, respond: () => ({ apps: [] }) },
  {
    path: /^\/api\/components\/for-agent\//,
    respond: () => ({ components: [] }),
  },
  {
    path: "/api/openduet/channels",
    respond: () => ({ everythingId: "demo-channel", channels: [] }),
  },
  {
    path: /^\/api\/bots\/[^/]+\/activity$/,
    respond: () => ({
      activity: { inProgress: [], scheduled: [], completed: [] },
    }),
  },
  {
    path: /^\/api\/copilotkit\/threads\/[^/]+\/messages$/,
    respond: () => ({ messages: demoHistory }),
  },
  {
    method: "POST",
    path: /^\/api\/channels\/[^/]+\/(busy|activity)$/,
    respond: () => ({ ok: true }),
  },
  // The chat runtime, answered as an SSE-mode CopilotKit runtime with one agent.
  {
    path: "/api/copilotkit/info",
    respond: () => ({
      version: "demo",
      mode: "sse",
      agents: { openduet: { description: "OpenDuet (mode démo)" } },
    }),
  },
  {
    method: "POST",
    path: /^\/api\/copilotkit\/agent\/[^/]+\/connect$/,
    respond: () => eventStream([]),
  },
  {
    method: "POST",
    path: /^\/api\/copilotkit\/agent\/[^/]+\/run$/,
    respond: ({ init }) => demoReply(init),
  },
  {
    method: "POST",
    path: /^\/api\/copilotkit\/agent\/[^/]+\/stop/,
    respond: () => ({ stopped: true }),
  },
];

const demoHistory = [
  {
    id: "demo-m1",
    role: "user",
    content: "Bonjour, qu'est-ce que tu sais faire ?",
  },
  {
    id: "demo-m2",
    role: "assistant",
    content:
      "Bonjour ! Je prépare votre briefing du matin, je trie vos emails entre ce qui a besoin de vous et ce qui peut attendre, " +
      "et je travaille sur des tâches pendant votre absence. Ici, je suis en **mode démo** : écrivez-moi, je vous répondrai avec un message d'exemple.",
  },
];

const DEMO_ANSWER =
  "Je suis en **mode démo** : l'interface fonctionne, mais je ne suis pas encore relié à un serveur ni à un modèle d'IA. " +
  "Une fois le serveur branché, je pourrai lire vos emails, préparer votre briefing du matin et travailler sur mes tâches.";

function demoReply(init?: RequestInit): Response {
  let threadId = "demo-thread";
  let runId: string = crypto.randomUUID();
  try {
    const body = JSON.parse(String(init?.body ?? "{}")) as {
      threadId?: string;
      runId?: string;
    };
    threadId = body.threadId ?? threadId;
    runId = body.runId ?? runId;
  } catch {}
  const messageId = crypto.randomUUID();
  const words = DEMO_ANSWER.split(/(?<= )/);
  return eventStream(
    [
      { type: "RUN_STARTED", threadId, runId },
      { type: "TEXT_MESSAGE_START", messageId, role: "assistant" },
      ...words.map((delta) => ({
        type: "TEXT_MESSAGE_CONTENT",
        messageId,
        delta,
      })),
      { type: "TEXT_MESSAGE_END", messageId },
      { type: "RUN_FINISHED", threadId, runId },
    ],
    30,
  );
}

function eventStream(events: unknown[], delayMs = 0): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      for (const event of events) {
        if (delayMs)
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
        );
      }
      controller.close();
    },
  });
  return new Response(stream, {
    headers: { "content-type": "text/event-stream" },
  });
}
