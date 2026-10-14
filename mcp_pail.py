#!/usr/bin/env python3
"""stdio MCP for pail. no sdk.

i read the mcp schema once and then just spoke json-rpc. if the
protocol moved, this file will look dated. that is fine.
"""

from __future__ import annotations

import json
import sys
from typing import Any

KEY = "pail_test_k1"
MAX_BYTES = 8 * 1024 * 1024

ERRORS = {
    "bad_token": (401, "missing or garbage bearer"),
    "token_expired": (401, "key existed, clock said no"),
    "space_forbidden": (403, "key is valid, space is not on it"),
    "space_missing": (404, "space id is not a thing"),
    "object_missing": (404, "no object with that name in this space"),
    "payload_too_big": (413, "body is over 8MB in this fake"),
    "name_invalid": (400, "empty name, or a name with a newline"),
}

# in-memory. restarts wipe it. do not @ me.
SPACES = {
    "space_cats": {"hat.png": b"not-a-real-png"},
    "space_trash": {},
}
KEY_SPACES = ["space_cats", "space_trash"]


def _err(code: str) -> dict:
    http, msg = ERRORS[code]
    return {"error": {"code": code, "message": msg, "http": http}}


def whoami() -> dict:
    return {"key": "pail_test_k1", "spaces": list(KEY_SPACES)}


def list_spaces() -> dict:
    return {
        "spaces": [
            {"id": sid, "objects": len(objs)} for sid, objs in SPACES.items()
        ]
    }


def put(space: str, name: str, text: str) -> dict:
    if not name or "\n" in name:
        return _err("name_invalid")
    if space not in SPACES:
        return _err("space_missing")
    if space not in KEY_SPACES:
        return _err("space_forbidden")
    raw = text.encode()
    if len(raw) > MAX_BYTES:
        return _err("payload_too_big")
    SPACES[space][name] = raw
    return {
        "space": space,
        "name": name,
        "etag": hex(len(raw) + 17),
        "bytes": len(raw),
    }


def get(space: str, name: str) -> dict:
    if space not in SPACES:
        return _err("space_missing")
    if space not in KEY_SPACES:
        return _err("space_forbidden")
    if name not in SPACES[space]:
        return _err("object_missing")
    raw = SPACES[space][name]
    return {"space": space, "name": name, "bytes": len(raw), "text": raw.decode("utf-8", "replace")}


def explain(code: str) -> dict:
    if code not in ERRORS:
        return {"unknown": code, "hint": "see docs/errors.md"}
    http, msg = ERRORS[code]
    return {"code": code, "http": http, "message": msg}


TOOLS = [
    {
        "name": "pail_whoami",
        "description": "Show the fake test key and which spaces it can see.",
        "inputSchema": {"type": "object", "properties": {}},
    },
    {
        "name": "pail_list_spaces",
        "description": "List spaces and object counts.",
        "inputSchema": {"type": "object", "properties": {}},
    },
    {
        "name": "pail_put",
        "description": "Store a small text blob in a space. This fake is text-only.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "space": {"type": "string"},
                "name": {"type": "string"},
                "text": {"type": "string"},
            },
            "required": ["space", "name", "text"],
        },
    },
    {
        "name": "pail_get",
        "description": "Fetch a blob as text.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "space": {"type": "string"},
                "name": {"type": "string"},
            },
            "required": ["space", "name"],
        },
    },
    {
        "name": "pail_explain_error",
        "description": "Look up a pail error code. Prefer this over guessing.",
        "inputSchema": {
            "type": "object",
            "properties": {"code": {"type": "string"}},
            "required": ["code"],
        },
    },
]


def call_tool(name: str, args: dict) -> dict:
    if name == "pail_whoami":
        return whoami()
    if name == "pail_list_spaces":
        return list_spaces()
    if name == "pail_put":
        return put(args.get("space", ""), args.get("name", ""), args.get("text", ""))
    if name == "pail_get":
        return get(args.get("space", ""), args.get("name", ""))
    if name == "pail_explain_error":
        return explain(args.get("code", ""))
    return {"error": {"code": "unknown_tool", "message": name}}


def handle(msg: dict) -> dict | None:
    mid = msg.get("id")
    method = msg.get("method")
    if method == "initialize":
        return {
            "jsonrpc": "2.0",
            "id": mid,
            "result": {
                "protocolVersion": "2024-11-05",
                "capabilities": {"tools": {}},
                "serverInfo": {"name": "pail", "version": "0.1"},
            },
        }
    if method == "notifications/initialized":
        return None
    if method == "tools/list":
        return {"jsonrpc": "2.0", "id": mid, "result": {"tools": TOOLS}}
    if method == "tools/call":
        params = msg.get("params") or {}
        name = params.get("name")
        args = params.get("arguments") or {}
        result = call_tool(name, args)
        text = json.dumps(result)
        return {
            "jsonrpc": "2.0",
            "id": mid,
            "result": {"content": [{"type": "text", "text": text}]},
        }
    if mid is None:
        return None
    return {
        "jsonrpc": "2.0",
        "id": mid,
        "error": {"code": -32601, "message": method},
    }


def loop() -> None:
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            msg = json.loads(line)
        except json.JSONDecodeError:
            continue
        resp = handle(msg)
        if resp is not None:
            sys.stdout.write(json.dumps(resp) + "\n")
            sys.stdout.flush()


def main() -> None:
    if "--list" in sys.argv:
        for t in TOOLS:
            print(f"{t['name']}\t{t['description']}")
        return
    if "--selftest" in sys.argv:
        print(json.dumps(put("space_cats", "note.txt", "hi")))
        print(json.dumps(get("space_cats", "note.txt")))
        print(json.dumps(get("space_cats", "nope")))
        print(json.dumps(explain("space_forbidden")))
        return
    loop()


if __name__ == "__main__":
    main()
