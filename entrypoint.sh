#!/bin/sh
set -e

# If compose provides TOKEN (private env), map it to OPENHAB_API_TOKEN
if [ -n "$TOKEN" ] && [ -z "$OPENHAB_API_TOKEN" ]; then
  export OPENHAB_API_TOKEN="$TOKEN"
fi

# Start the MCP server
exec node dist/index.js
