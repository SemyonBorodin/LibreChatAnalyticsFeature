# LibreChat Interaction Analytics

Fork of [LibreChat](https://github.com/danny-avila/LibreChat) with an added interaction analytics feature.

## Scope

Implemented feature:

- recording user/AI interactions from the existing chat flow
- separate deterministic mock interaction endpoint for local development and feature demonstration
- analytics API for summary and recent interaction logs
- `/analytics` page with summary cards, day chart, and recent interactions table
- React Query integration through the existing data-provider layer

This repository is intended as a technical feature fork, not as a replacement for the upstream LibreChat project documentation.

## Screenshots

### Chat flow with recorded mock AI response

![Chat mock flow](docs/screenshots/chat-mock-flow.png)

### Analytics page

![Analytics page](docs/screenshots/analytics-page.png)

## Technical solution

### 1. Data model

Added a dedicated `Interaction` entity for analytics storage.

Stored fields:

- `user`
- `userMessageId`
- `assistantMessageId`
- `conversationId`
- `endpoint`
- `model`
- `userMessage`
- `assistantMessage`
- `status`
- `latencyMs`
- `createdAt`

Key implementation details:

- TypeScript-only data layer in `packages/data-schemas`
- user-scoped reads and writes
- indexes on `user + createdAt` and `user + model`
- index on `conversationId`
- idempotency by unique `assistantMessageId`
- cursor pagination for recent logs
- aggregation-based summary

Relevant files:

- `packages/data-schemas/src/types/interaction.ts`
- `packages/data-schemas/src/schema/interaction.ts`
- `packages/data-schemas/src/models/interaction.ts`
- `packages/data-schemas/src/methods/interaction.ts`

### 2. Backend API

Added analytics service and handlers in `packages/api`:

- `GET /api/analytics/summary`
- `GET /api/analytics/interactions`
- `POST /api/analytics/mock-interaction`

Implementation rules followed:

- handlers are written in TypeScript
- handlers use dependency injection
- handlers do not import Mongoose models directly
- legacy JS backend only contains thin Express route wiring

Relevant files:

- `packages/api/src/analytics/service.ts`
- `packages/api/src/analytics/handlers.ts`
- `packages/api/src/analytics/index.ts`
- `api/server/routes/analytics.js`

### 3. Existing flow integration

Analytics is implemented as a passive recorder.

The normal LibreChat provider flow is not replaced. OpenAI, Agents, Assistants, Anthropic, and other providers remain responsible for generating responses through the existing code paths.

Integration seam:

- assistant replies are recorded only after the existing message persistence path succeeds;
- the JS route layer does not contain analytics business logic;
- a small server-side orchestration wrapper bridges the legacy Express route to the typed analytics service;
- the TypeScript analytics service owns normalization, success-only rules, and idempotent write payload construction.
- recorder hooks are attached to existing message persistence points, not provider request construction.

Current behavior:

- the user sends a normal chat message;
- LibreChat handles the provider request normally;
- when a successful assistant message is persisted through `POST /api/messages/:conversationId`, analytics records the user/assistant exchange;
- if the provider fails because of key, quota, model, network, or any other provider error, no successful interaction is recorded;
- if analytics recording fails, the chat response is not broken and the analytics error is logged.

This keeps analytics decoupled from provider request contracts and avoids requirements such as `agent_id` unless the original flow itself requires them.

Relevant files:

- `api/server/routes/messages.js`
- `api/server/services/Analytics/recordSavedInteraction.js`
- `api/app/clients/BaseClient.js`
- `api/server/controllers/agents/request.js`
- `api/server/services/Threads/manage.js`
- `packages/api/src/analytics/service.ts`

### 4. Frontend

Added a new page:

- `/analytics`

Page content:

- total interactions
- models used
- latest activity
- average request length
- average response length
- interactions by day chart
- recent interactions table
- loading and empty states

Frontend integration details:

- TypeScript React page
- React Query hooks use `dataService`, not direct `fetch`
- route is integrated into existing client routing
- analytics button added in chat UI for quick access

Relevant files:

- `client/src/routes/Analytics.tsx`
- `client/src/routes/index.tsx`
- `client/src/data-provider/Analytics/queries.ts`
- `client/src/components/Chat/AnalyticsButton.tsx`

### 5. Shared contract

Added typed frontend/backend contract in `packages/data-provider`.

Main types:

- `InteractionAnalyticsListParams`
- `TInteractionLog`
- `TInteractionAnalyticsSummary`
- `TInteractionLogsResponse`
- `TCreateMockInteractionRequest`
- `TCreateMockInteractionResponse`

Relevant files:

- `packages/data-provider/src/types/queries.ts`
- `packages/data-provider/src/api-endpoints.ts`
- `packages/data-provider/src/data-service.ts`
- `packages/data-provider/src/keys.ts`

## Current analytics behavior

The analytics page currently reads from the `Interaction` collection.

Summary currently includes:

- total interactions
- distinct model count
- latest activity time
- average request length
- average response length

Recent logs include:

- interaction day
- user message
- assistant response
- model

The chart is currently based on recorded interaction volume by day.

## Mock/demo mode

The task explicitly allows replacing real AI interaction with a mock.

This fork keeps mock support as a separate analytics endpoint:

- `POST /api/analytics/mock-interaction`

The mock endpoint creates demo `Interaction` records directly. It does not fake chat responses and does not hijack provider-specific agents/assistants/OpenAI flows.

This keeps the feature:

- easy to verify locally
- stable in tests
- independent from external provider credentials
- safe to use without changing normal chat behavior

## Real provider keys and fallback behavior

Normal chat requests still use LibreChat's existing provider configuration. This feature does not add a new provider setup mechanism and does not change how LibreChat resolves API keys.

In upstream LibreChat, OpenAI can be configured server-side with `OPENAI_API_KEY` from the environment. LibreChat also supports user-provided key mode with `OPENAI_API_KEY=user_provided`, where the user supplies the key through the normal UI flow.

For example, if a real `OPENAI_API_KEY` is present in `.env`, LibreChat may use it server-side even when the user does not manually paste a key in the UI. In that case:

- a successful provider response is recorded as a real interaction;
- `429 quota exceeded` means the provider key was found, but the account/project has no available quota;
- missing key, invalid key, quota, billing, model, or network errors are not recorded as successful interactions;
- analytics mock mode does not automatically replace failed provider calls.

The mock endpoint is intentionally explicit. It is for local/demo analytics data only, not a fallback that hides provider setup or billing problems.

## What is counted

Counted:

- successful completed interactions;
- a user message exists;
- an assistant message exists;
- assistant text/content exists;
- conversation id exists where available.

Not counted in this MVP:

- missing API key errors;
- quota or billing errors;
- invalid model errors;
- provider/network failures;
- cancelled or incomplete responses.

Production can later add a separate `failed_attempt` status for failed provider calls.

## Tests and verification

Implemented targeted tests for:

- data layer methods
- analytics API handlers
- passive message-save interaction recording
- analytics error isolation in chat message saving
- frontend analytics page

Verified locally:

- analytics API handler tests pass
- frontend analytics page test passes
- passive message-save interaction tests pass for the route-level mocked cases
- `build:data-provider`
- `build:data-schemas`
- `build:api`

Notes:

- `mongodb-memory-server` can fail on this Windows environment before test assertions with a local `Mongod internal error (fassert() failure)`. When that happens, data-layer tests are blocked by local MongoMemory startup, not by interaction assertions.
- `build:client` requires the `librechat-data-provider/react-query` subpath bundle to exist; this fork includes the missing CJS build output so workspace builds resolve consistently.

## Local run

Minimal local setup used for this feature:

```env
HOST=localhost
PORT=3080
MONGO_URI=mongodb://admin:admin@localhost:27017/LibreChat?authSource=admin
JWT_SECRET=local-secret
JWT_REFRESH_SECRET=local-refresh-secret
ALLOW_REGISTRATION=true
```

MongoDB example:

```bash
docker run --name librechat-mongo -p 27017:27017 -e MONGO_INITDB_ROOT_USERNAME=admin -e MONGO_INITDB_ROOT_PASSWORD=admin -d mongo:7
```

Build and run:

```bash
npm install
npm run build:data-provider
npm run build:data-schemas
npm run build:api
npm run build:client-package
npm run build:client
npm run backend:dev
cd client && npm run dev
```

Open:

- frontend: `http://localhost:3090`
- analytics: `http://localhost:3090/analytics`

## Limitations

Current state is MVP-level analytics integration.

Known limitations:

- analytics records success interactions after message persistence; failed provider attempts are not yet tracked
- analytics metrics are intentionally compact
- chart is simple by design
- interaction recording is attached to several existing persistence points; a production event/hook in the message repository would be cleaner

## Production path

To move this solution toward production:

1. Keep provider flows untouched and move post-persistence recording behind one shared message repository event/hook.
2. Reuse the existing passive recorder seam for any additional persistence points instead of adding provider-specific request hooks.
3. Extend summary aggregation with metrics such as latency averages, error rate, token usage, and richer per-model breakdowns.
4. Add stronger observability and failure handling around interaction recording.
5. Add `failed_attempt` analytics as a separate status without mixing it with successful interactions.

## Additional docs

Detailed Russian-language project notes are included in:

- `ANALYTICS_TECHNICAL_OVERVIEW_RU.md`
- `INTERACTION_ANALYTICS_SOLUTION_RU.md`
- `MANUAL_TESTING_ANALYTICS_RU.md`
- `ANALYTICS_REVISION_WSL_RU.md`
