# ADR-0024: Standardize Frontend Forms on React Hook Form

Date: 2026-07-18

Status: accepted

## Context

Featurewise will include forms for authentication, organization names, project names, and feature titles.

Managing field values, validation state, submission state, parsing, and server errors independently in every form would duplicate behavior and make form conventions inconsistent.

The frontend already provides reusable inputs whose visual and accessibility contracts must remain independent from product form state.

Frontend validation also needs runtime guarantees. TypeScript types alone do not validate user input, while validation rules embedded directly in components would duplicate field contracts and make them harder to test independently.

## Decision

Use React Hook Form as the standard form-state library and Zod as the standard schema validation and parsing library in the frontend.

Product forms use useForm for values, submission state, and form-level errors. Connect the owning Zod schema through zodResolver from @hookform/resolvers so schema validation is the first frontend validation layer before an API request.

Infer form value types from the Zod schema instead of declaring a parallel TypeScript field-value interface. A schema may normalize transport-safe input, such as trimming a username, but must not transform secret values such as passwords unless the backend contract explicitly requires it.

Use Controller when a shared input has a controlled value contract or does not expose the ref contract required by register.

Keep form schemas and orchestration at the narrowest owning feature. Feature-specific schemas live in that feature's lib segment and are tested independently. Only genuinely domain-neutral schemas may live in shared; do not place product-specific validation there.

Zod schemas may enforce input presence, shape, format, and transport constraints for immediate feedback. They must not duplicate backend-only business rules. Backend validation remains authoritative, and forms must continue handling normalized API errors.

Do not add a second form-state library or parallel per-field React state for forms already owned by React Hook Form.

## Consequences

- Forms share one predictable state, validation, and submission model.
- Zod schemas provide independently testable runtime validation and are the source of frontend form value types.
- Shared visual components remain independent from product-specific form behavior.
- Controlled shared components require a Controller adapter unless their public contract later supports direct registration.
- Forms require the @hookform/resolvers adapter to connect Zod with React Hook Form.
- Form tests must cover meaningful client validation, submission state, and mapped backend errors.
- React Hook Form, Zod, and @hookform/resolvers become frontend runtime dependencies.
