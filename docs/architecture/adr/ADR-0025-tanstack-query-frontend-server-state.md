# ADR-0025: Use TanStack Query for Frontend Server State

Date: 2026-07-22

Status: accepted

## Context

The authenticated React application needs organization, project, and feature data in the persistent navigation shell and route pages. Manual effects would duplicate requests, freshness rules, retry handling, and loading state across those consumers. React Router already owns URL matching and client-side navigation, but it is not the cache for REST resources.

The Phase 1 backend remains a NestJS REST/JSON modular monolith. There is no measured need for GraphQL or a navigation-specific aggregate endpoint.

## Decision

Use TanStack Query as the frontend server-state cache.

- React Router owns URLs, navigation state, route matching, and lazy route modules.
- TanStack Query owns REST resource caching, freshness, retry, request deduplication, prefetching, and mutation-driven cache updates.
- Use one in-memory QueryClient for the active browser session and clear it on logout or failed session restoration.
- Keep organization, project-list, and project-detail data fresh for five minutes. Keep feature-list and feature-detail data fresh for one minute. Garbage-collect inactive queries after thirty minutes.
- Do not refetch on window focus. Retry network and 5xx failures once and never retry 4xx failures.
- Seed detail queries from fresh collection entries and carry forward the collection update timestamp.
- Keep REST/JSON as the transport. Reconsider GraphQL or an aggregate navigation endpoint only after profiling demonstrates a concrete bottleneck that cache policy and existing endpoints cannot address.

## Consequences

- The persistent shell and lazy pages share data without local state duplication or repeated fresh requests.
- Pointer/focus prefetch and branch expansion use the same query options and deduplicate concurrent work.
- Server data cannot cross authenticated sessions through the in-memory cache.
- The frontend adds one dependency and must maintain explicit query keys and invalidation behavior.
- Direct deep links can still use detail endpoints when their parent collection is not cached.
