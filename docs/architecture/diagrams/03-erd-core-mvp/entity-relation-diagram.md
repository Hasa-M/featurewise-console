# Report domain

```mermaid
erDiagram
  ORGANIZATION ||--o| USER : authenticates
  ORGANIZATION ||--o{ PROJECT : owns
  PROJECT ||--o{ FEATURE : contains
  FEATURE ||--o{ STORAGE_OBJECT : retains
  FEATURE ||--o{ REVIEW_REPORT : groups
  USER ||--o{ REVIEW_REPORT : saves
  REVIEW_REPORT ||--o{ REVIEW_FINDING : contains
  REVIEW_REPORT ||--o{ REPORT_SOURCE : owns
  REVIEW_REPORT ||--o{ REPORT_ATTACHMENT : owns
  STORAGE_OBJECT ||--o{ REPORT_ATTACHMENT : original
  REPORT_ATTACHMENT o|--o{ REPORT_SOURCE : supplies
  REVIEW_FINDING ||--o{ FINDING_EVIDENCE : cites
  REPORT_SOURCE ||--o{ FINDING_EVIDENCE : supports
  REVIEW_FINDING ||--o{ FINDING_REVIEW : receives
  USER ||--o{ FINDING_REVIEW : records
```

Report content, format version, producer date, saving author and saving date are
immutable. Findings, report sources, evidence and attachments reject mutation.
Decisions are append-only; order by createdAt and publicNumber for disposition.
Composite foreign keys constrain evidence and attachment sources to their report,
and attached originals to the report feature. MCP sources retain references only.
No relation automatically associates findings from different reports.
