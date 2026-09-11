# Third-party code and licensing

**Current status:** implementation. Runtime libraries and font assets are installed, version-locked and listed below. The generator is independently written; no slicer code or printer profiles have been copied. The application license and distribution model remain undecided; there is intentionally no root LICENSE choosing terms on the product manager's behalf.

The [project inventory](research/project-inventory.md) is a candidate register, not a list of installed dependencies. License conclusions apply only to the inspected material. Before reuse, inspect the exact revision, component, examples, assets, and transitive dependencies.

## Adoption workflow

For each incorporated component, record its source URL, exact version or commit, file scope, license identifier and license text, copyright/notice requirements, modifications, and reason for reuse. Preserve required notices and distinguish our code from external material. Generate the release dependency/license inventory from the actual resolved build.

Prioritize independently written product-specific algorithms and reviewed permissive dependencies while distribution is unresolved. “Public on GitHub” is not sufficient permission: code without an applicable license remains a research reference until permission or license evidence is established. GitHub documents the distinction between publishing code and granting reuse rights. [GitHub, *Licensing a repository*](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository)

Copyleft is not a prohibition on commercial use. Its obligations depend on the license and how software is combined, modified, and conveyed; GPL and AGPL should not be treated interchangeably. Do not assume that calling code through a backend or translating it to another language removes obligations. Evaluate a concrete integration plan before selecting it. [GNU GPL FAQ](https://www.gnu.org/licenses/gpl-faq.html), [GNU AGPL](https://www.gnu.org/licenses/agpl-3.0.html)

A project's code license does not automatically establish rights to every linked design, standalone gist, photograph, trademark, fitting drawing, or externally supplied preset. Generated recipes and output files need a separate documented ownership/licensing policy if public sharing becomes scope.

## Gate

The independent-code route passed G0 under the build authorization. Publish required third-party notices with every engineering preview. The requested public GitHub source/Pages preview does not select an open-source license for the original product code; package metadata remains `private: true` and `UNLICENSED`. Obtain the product manager's decision before adopting project distribution terms or incorporating code/profiles that constrain them.

## Installed runtime components — session 001

| Component | Exact version | Source | License / incorporated scope |
|---|---|---|---|
| React and React DOM | 19.3.0 | [React](https://github.com/facebook/react) | MIT; unmodified client runtime |
| Scheduler | Lockfile version | [React](https://github.com/facebook/react) | MIT; React's runtime dependency |
| Three.js, including OrbitControls | 0.186.0 | [Three.js](https://github.com/mrdoob/three.js) | MIT; rendering and camera controls, no physics claim |
| DM Sans variable | @fontsource-variable/dm-sans 5.3.0 | [Fontsource font files](https://github.com/fontsource/font-files) | OFL-1.1; locally bundled font assets and stylesheet |
| IBM Plex Mono | @fontsource/ibm-plex-mono 5.3.0 | [Fontsource font files](https://github.com/fontsource/font-files) | OFL-1.1; locally bundled font assets and stylesheet |

All runtime license texts and copyright notices are retained verbatim in [THIRD_PARTY_NOTICES.txt](../public/THIRD_PARTY_NOTICES.txt), shipped at the public site root. No runtime components were modified. The complete platform-independent lockfile inventory, including development/optional packages and exact Scheduler version, is [dependency-inventory.json](dependency-inventory.json). Regenerate with `npm run licenses`; CI checks for drift with `npm run licenses:check`.

The development graph is **not all permissive**: Lightning CSS 1.33.0 and its optional platform binaries declare MPL-2.0. They are used unmodified as build tooling and are not included in the static browser artifact or committed `node_modules`. Review their obligations again if distributing tooling/binaries or modifying that source. Mozilla explains the distinction between use and distribution, and the file scope of MPL obligations. [Mozilla MPL FAQ](https://www.mozilla.org/en-US/MPL/2.0/FAQ/)

The other recorded development identifiers are MIT, Apache-2.0, ISC and BSD-3-Clause. This inventory describes this resolved build, not blanket permission to adopt future versions or other packages. GitHub Actions are pinned to inspected official action commits in the workflow files.
