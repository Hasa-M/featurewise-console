# ADR-0010: Keep a local-first prototype

Date: 2026-09-24

Status: accepted

## Context

Featurewise is a solo-developer prototype for local development and demonstrations.

## Decision

Run the Console, NestJS API and PostgreSQL locally. Private originals can remain in S3. This is not a public production deployment. Keep authentication, but defer teams, roles, invitations, password reset and 2FA.

## Consequences

Integration tests use a dedicated local database. Cloud infrastructure changes and public deployment require separate scope.
