# docs-the-agent-can-read

Most API docs assume a person with a browser. A lot of the traffic is now a model fetching `llms.txt` at 3am.

**pail** is a tiny object store. The files around it are the point:

- `llms.txt` — open these first
- `openapi.yaml` — the contract, matching the prose (I have been burned)
- `docs/errors.md` — the codes
- `mcp_pail.py` — stdio MCP, no SDK, so an agent can put a blob or decode a 403 without scraping a blog
- `docs/quickstart.md` — one coffee

I wrote this kind of pack for a storage product whose docs I cannot republish.

## run

```bash
python3 mcp_pail.py --list
python3 mcp_pail.py --selftest
```

JSON-RPC on stdin/stdout. Two spaces in memory. There is a cat.

![MCP selftest: put, get, missing object, forbidden space](shots/mcp.png)

![Error catalogue from docs/errors.md](shots/errors.png)

Put the error codes in a file. Let people and models read the same file.
