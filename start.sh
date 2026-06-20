#!/bin/sh
# Source mounted secrets as env vars before starting the server
if [ -f /run/secrets/app.env ]; then
  set -a
  . /run/secrets/app.env
  set +a
fi
exec node server.js
