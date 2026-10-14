# auth

Bearer token. No cookies. No "login with github" on the API.

The token is bound to a list of space ids. It cannot create spaces. Making spaces is a dashboard problem and I am not putting a dashboard in this repo.

Header:

```
Authorization: Bearer pail_test_k1
```

Wrong key → `401 bad_token`.
Right key, wrong space → `403 space_forbidden`.
Expired key → `401 token_expired` (the fake never expires, the code is there so a generated client has somewhere to map).

I am not doing UCAN in this version. I have written that stack. It is a bad first page.
