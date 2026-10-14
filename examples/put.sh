# this would hit api.pail.example if it existed.
# left here so a human (or an agent) can see the shape.

curl -sS -X PUT \
  https://api.pail.example/v1/spaces/space_cats/objects/hat.png \
  -H "Authorization: Bearer pail_test_k1" \
  --data-binary @hat.png
