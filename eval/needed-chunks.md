# Needed chunks — docs v1

Frozen map of which **v1** rag chunks contain the facts for each eval task.  
Written from the v1 docs text and the chunker ids below. Not from model output or `results/`.

A set of chunks is sufficient when together they contain every fact the correct answer depends on. The command name cat-status and the answer format are given by the task and do not count as facts.

## Metric: retrieved-sufficient

A rag run attempt is **retrieved-sufficient** if, for **at least one** listed alternative for that task, **all** chunk ids in that alternative appear in the retrieved top-k for the attempt.

- `needs [a AND b]` — one alternative that requires both chunks.
- `OR [c]` — another alternative that is sufficient on its own (or with its own AND set).

## v1 chunk id inventory (chunker only; no retriever)

Generated with `loadDocsPages(..., { includeLlms: false })` + `chunkPages` (rag index set).  
Empty `##` / `###` / intro sections produce no chunk (so parent-only headings like Arguments / Flags are absent).

| chunk id | prefix |
|----------|--------|
| `index` | Introduction |
| `install` | Install |
| `quick-start` | Quick start |
| `command-reference--synopsis` | Command reference > Synopsis |
| `command-reference--arguments--code` | Command reference > Arguments > `<code>` |
| `command-reference--arguments--non-standard-codes` | Command reference > Arguments > Non-standard codes |
| `command-reference--flags--json` | Command reference > Flags > `--json` |
| `command-reference--flags--list-1xx-2xx-3xx-4xx-5xx` | Command reference > Flags > `--list [1xx\|2xx\|3xx\|4xx\|5xx]` |
| `command-reference--flags--save-path` | Command reference > Flags > `--save <path>` |
| `command-reference--flags--force` | Command reference > Flags > `--force` |
| `command-reference--flags--timeout-ms` | Command reference > Flags > `--timeout <ms>` |
| `command-reference--flags--help-h` | Command reference > Flags > `--help` / `-h` |
| `command-reference--flags--version-v` | Command reference > Flags > `--version` / `-V` |
| `command-reference--exit-codes` | Command reference > Exit codes |
| `troubleshooting--invalid-code` | Troubleshooting > Invalid code |
| `troubleshooting--negative-numbers-look-like-options` | Troubleshooting > Negative numbers look like options |
| `troubleshooting--real-http-status-with-no-cat-image` | Troubleshooting > Real HTTP status with no cat image |
| `troubleshooting--file-already-exists` | Troubleshooting > File already exists |
| `troubleshooting--download-timed-out` | Troubleshooting > Download timed out |
| `troubleshooting--download-returned-an-http-error` | Troubleshooting > Download returned an HTTP error |
| `troubleshooting--wrong-node-version` | Troubleshooting > Wrong Node version |
| `changelog--1-0-0` | Changelog > 1.0.0 |

## Per-task needs

T1: needs [quick-start] OR [command-reference--arguments--code]

T2: needs [quick-start] OR [command-reference--flags--json AND command-reference--arguments--code] OR [command-reference--synopsis]

T3: needs [command-reference--synopsis] OR [quick-start AND command-reference--flags--json] OR [command-reference--flags--list-1xx-2xx-3xx-4xx-5xx AND command-reference--flags--json]

T4: needs [quick-start] OR [command-reference--flags--save-path AND command-reference--flags--force]

T5: needs [command-reference--flags--save-path AND command-reference--flags--timeout-ms] OR [quick-start AND command-reference--flags--timeout-ms] OR [command-reference--synopsis]

T6: needs [troubleshooting--negative-numbers-look-like-options] OR [command-reference--arguments--code]

T7: needs [troubleshooting--real-http-status-with-no-cat-image] OR [quick-start] OR [command-reference--exit-codes]

T8: needs [command-reference--flags--timeout-ms AND command-reference--exit-codes]

T9: needs [command-reference--arguments--non-standard-codes]

T10: needs [quick-start] OR [command-reference--flags--save-path] OR [troubleshooting--file-already-exists AND command-reference--flags--save-path]
