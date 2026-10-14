# errors

Every error is JSON:

```
{"error": {"code": "object_missing", "message": "no object with that name in this space"}}
```

Use `code`. Do not parse `message`. I will rewrite the messages.

| code | http | when |
| --- | --- | --- |
| bad_token | 401 | missing or garbage bearer |
| token_expired | 401 | key existed, clock said no |
| space_forbidden | 403 | key is valid, space is not on it |
| space_missing | 404 | space id is not a thing |
| object_missing | 404 | space exists, name does not |
| payload_too_big | 413 | body > 8MB in the fake |
| name_invalid | 400 | empty name, or a name with a newline, because someone will try |
| conflict | 409 | If-Match etag and the object moved. fake always wins the first put |

`pail_explain_error` in the MCP server returns this table row. That is the whole point of the tool. Do not make an agent grep the marketing site for "403".
