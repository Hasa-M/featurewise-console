# ADR-0009: Use React and Vite for the Console

Date: 2026-09-24

Status: accepted

## Context

The Console needs a small, working interface for authentication and organization, project and feature management.

## Decision

Use React, Vite and TypeScript in `frontend/`, React Router for browser routes,
and NestJS REST/JSON for persisted data. Use CSS Modules, semantic CSS variables,
Lucide icons, and locally bundled Geist/Geist Mono fonts from Fontsource.
Storybook consumes the same Vite aliases and global stylesheet as the app.

The Console has login, project listing/creation, project features, and a feature
page that explicitly states review history is unavailable. Review execution
belongs to the separately developed plugin under ADR-0037.

## Consequences

The frontend retains its shell and design system. Backend authorization and persistence remain authoritative. No provider calls or repository connectors belong in the Console.
