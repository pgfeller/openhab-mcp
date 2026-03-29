#!/bin/sh
set -e
# Simple healthcheck script for the OpenHAB MCP HTTP adapter
# Exits 0 on success, 1 on failure
curl -fsS --max-time 5 http://127.0.0.1:8000/health >/dev/null 2>&1 || exit 1
exit 0
