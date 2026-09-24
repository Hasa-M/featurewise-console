# License and provenance

The Console and backend retain the original
[PolyForm Noncommercial License 1.0.0](../LICENSE), restored verbatim from the
pre-refactor baseline. Their package license metadata also matches that baseline.
MIT is intended only for the separately developed plugin; its code and license
are managed in its own repository. This repository is not relicensed to MIT.

The local audit on 2026-09-24 found all Git author identities attributed to
Salvatore Fadda (including the Hasa-M and SalvatoreFadda account spellings).
The four tracked SVG assets are the Featurewise logo variants and favicon;
their introduction is recorded in commits `ec5976b` and `20e01f3` by the same
author. No separately vendored third-party source or bitmap assets were found.
The untracked `docs/learning/` directory was excluded and left untouched.
Git provenance is evidence of repository authorship, not a transfer of rights
to third-party dependencies.

Third-party packages retain their licenses. In particular, Geist and Geist Mono
retain the SIL Open Font License 1.1; Lucide retains ISC and the included Feather
MIT attribution. Their full notices are preserved in
[the generated Console notices](../frontend/public/THIRD_PARTY_NOTICES.txt),
which Vite copies into application and Storybook builds. This file covers all
260 installed runtime packages identified by the frontend lockfile, including
dependencies only used by the retained shared component workbench.

Regenerate with `node scripts/generate-third-party-notices.mjs` after installing
the lockfile. The generator fails if a runtime package has no license text.
Five packages omit a standard license file from their npm distribution; the
version-specific fallback copies in `docs/licenses/` preserve their attribution:

- `cm6-theme-basic-light@0.2.0`: [upstream license](https://github.com/craftzdog/cm6-themes/blob/main/LICENSE).
- `mdast-util-highlight-mark@1.2.2` and `micromark-extension-highlight-mark@1.2.0`:
  [shared upstream license](https://github.com/shlroland/remark-highlight-mark/blob/master/License).
- `react-remove-scroll-bar@2.3.8`: [upstream license](https://github.com/theKashey/react-remove-scroll-bar/blob/master/LICENSE).
- `format@0.2.2`: its distributed package.json declares MIT via `licenses[0]`,
  and Readme.md names Sami Samhuri with copyright 2010–2014. The fallback retains
  that notice with the standard MIT text; [upstream repository](https://github.com/samsonjs/format).

Backend and development dependencies remain ordinary npm packages with their
own package licenses; the repository license does not replace them.
No dependency source files or their license notices were modified.
