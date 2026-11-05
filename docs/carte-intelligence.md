# Carte : où OpenDuet dépend de CopilotKit Intelligence

CopilotKit Intelligence est un service en ligne de CopilotKit (`api.intelligence.copilotkit.ai` et
`realtime.intelligence.copilotkit.ai`). Le code d'OpenDuet est sous licence MIT, mais le serveur
refuse de démarrer sans ce service. Ce document liste ce qu'il fait et à quel endroit du code.

Légende : ✅ déjà indépendant · 🔶 optionnel, désactivable · 🔴 bloquant, à remplacer

## 1. La mémoire ✅ (faite)

Ce que l'agent retient d'une personne (« elle préfère les réunions le matin »…).

| Fichier | Rôle |
|---|---|
| `openbot/server/src/memory/store.ts` | Le magasin de mémoire. Il sait déjà tout ranger dans Postgres (tables `memories`, `memory_sources`). |
| `openbot/server/src/memory/intelligence.ts` | Le pont vers Intelligence. **Il n'est plus branché.** |
| `openbot/server/src/index.ts` | Là où le magasin est créé : il est maintenant créé **sans** Intelligence. |

Conséquence : la mémoire vit uniquement dans ta base Postgres.

## 2. Les fils de conversation 🔴 (le gros morceau)

L'historique des conversations, et le canal en temps réel entre l'interface et l'agent.

| Fichier | Ce qu'il demande à Intelligence |
|---|---|
| `openbot/server/src/config.ts` | Refuse de démarrer sans `INTELLIGENCE_API_URL`, `INTELLIGENCE_GATEWAY_WS_URL` et `INTELLIGENCE_API_KEY`. |
| `openbot/server/src/copilot.ts` | Lance le moteur CopilotKit en « mode Intelligence » : historique, relais temps réel (WebSocket), verrous de fil (`threadLock`), lecture des messages (`getThreadMessages`). |
| `openbot/toolkit/src/run-turn.ts` | Les tours lancés sans navigateur (routines, tâches, briefing du matin) : `getOrCreateThread`, prise et renouvellement de verrou, lecture de l'historique, connexion au « runner » d'Intelligence. |
| `openbot/toolkit/src/copilotkit/thread-lock.ts` | Les verrous qui empêchent deux tours de tourner en même temps sur un même fil. |
| `openbot/server/src/index.ts` | Un client `routineIntelligence` partagé par les routines, les validations, les tâches, les canaux, les passations entre bots. |
| `openbot/server/src/approvals/wiring.ts` | Relit l'historique pour reprendre un tour après une validation. |
| `openbot/server/src/openduet/task-report.ts` | Relit l'historique d'une tâche pour en tirer « la prochaine étape ». |
| `openbot/server/src/channels/thread-status.ts` | Demande si un fil existe encore. |
| `openbot/app/src/lib/copilot/bot-thread.ts` | Côté navigateur : vérifie qu'un fil mémorisé existe encore (en passant par le serveur). |
| Slack / Teams | Le moteur CopilotKit n'accepte les canaux Slack/Teams qu'en mode Intelligence. |

### Comment le remplacer

Le moteur CopilotKit (`@copilotkit/runtime` 1.77) a un **second mode, « SSE »**, qui n'utilise pas
Intelligence. Dans ce mode, c'est un **« runner »** qui garde les fils. CopilotKit en fournit un qui
garde tout en mémoire vive (`InMemoryAgentRunner`), et donc perd tout au redémarrage. Le contrat à
respecter est petit :

- `run`, `connect`, `isRunning`, `stop` (classe `AgentRunner`) ;
- plus `listThreads`, `getThreadMessages`, `getThreadEvents`, `getThreadState` pour l'historique
  (interface `LocalThreadEndpointRunner`).

Le plan :

1. Écrire un **runner Postgres** (une table `threads`, une table `thread_events`) qui respecte ce contrat.
2. Écrire un **service de fils local** qui imite les quelques méthodes utilisées ailleurs
   (`getOrCreateThread`, `getThread`, `getThreadMessages`, verrous). Les verrous peuvent utiliser une
   table avec expiration, ou les « advisory locks » de Postgres.
3. Brancher ce service à la place de `routineIntelligence` et du client de `copilot.ts`.
4. Rendre les variables `INTELLIGENCE_*` facultatives dans `config.ts`.
5. Accepter de perdre Slack/Teams au début, ou les rebrancher plus tard avec un adaptateur à soi.

## 3. L'apprentissage automatique (« Learning ») 🔶

L'agent apprend de ses conversations, dans des « conteneurs » hébergés par Intelligence.

| Fichier | Rôle |
|---|---|
| `openbot/server/src/learning/*` | Attribution et gestion des conteneurs d'apprentissage. |
| `openbot/app/src/routes/_authed/admin/learning.tsx` | La page d'administration. |

Désactivable : `OPENBOT_LEARNING_AUTO_ASSIGN=false` dans `.env`. Sans conteneur attribué, rien n'est
envoyé, et le chat fonctionne quand même.

## 4. Les vérifications de droits 🔶

| Fichier | Rôle |
|---|---|
| `openbot/server/src/intelligence-entitlement-check.ts` | Demande à Intelligence ce que la clé autorise. |
| `openbot/server/src/self-host-banner.ts` | Le bandeau qui propose l'offre auto-hébergée. |

Ils disparaissent naturellement quand l'étape 2 est faite.

## 5. Ce qui n'est pas Intelligence, mais part aussi chez quelqu'un d'autre

| Service | Où | Désactivable ? |
|---|---|---|
| Télémétrie CopilotKit | `openbot/server/src/telemetry.ts`, `telemetryProperties` dans `copilot.ts` | Oui : `COPILOTKIT_TELEMETRY_DISABLED=true` ou `DO_NOT_TRACK=1` dans `.env`. |
| Modèle d'IA (OpenAI par défaut) | `openbot/examples/openduet/model.yaml`, `OPENAI_*` | Remplaçable par Claude, Gemini ou tout service compatible OpenAI. |
| Composio (connecteurs d'apps) | `openbot/server/src/plugins/` | Optionnel : laisser `COMPOSIO_API_KEY` vide. |

## Le mode démo

`openbot/app/src/demo/` contient un mode démo : avec `VITE_DEMO_MODE=true` au moment de la
compilation, l'interface répond elle-même à ses appels `/api` avec des données d'exemple. Ça permet
de la prévisualiser sans serveur. À retirer de la commande de build Vercel (`openbot/vercel.json`)
dès qu'un vrai serveur est branché.
