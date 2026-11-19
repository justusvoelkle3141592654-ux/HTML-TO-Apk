#!/bin/sh
cd "$(dirname "$0")" && exec node server.js "${1:-8080}"
