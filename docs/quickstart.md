# quickstart

You need a key. In the real world that comes from a dashboard. Here it is `pail_test_k1` and it only works in the MCP fake.

## 1. pick a space

A space is a bucket with a worse name. Your test key can see `space_cats` and `space_trash`.

## 2. put something

```
PUT /v1/spaces/space_cats/objects/hat.png
Authorization: Bearer pail_test_k1
Content-Type: application/octet-stream

<bytes>
```

Response `201` with an etag. If you send a body over 8MB the fake will laugh (`413 payload_too_big`). Real pail would be bigger. I am not simulating a CDN.

## 3. get it back

```
GET /v1/spaces/space_cats/objects/hat.png
Authorization: Bearer pail_test_k1
```

`404 object_missing` if you typo the name. `403 space_forbidden` if you aim at a space that is not on the key.

## 4. stop

That is the happy path. Auth details are in `auth.md`. When it breaks, `errors.md`, not slack.
