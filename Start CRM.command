#!/bin/bash
# Double-click this file to install (first run only), start, and open the CRM.
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  osascript -e 'display dialog "Node.js is not installed.\n\nPlease install it from https://nodejs.org, then double-click this file again." buttons {"OK"} with icon caution with title "Marathon CRM"'
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "First run: installing dependencies (this takes a minute)..."
  npm install
fi

echo "Starting Marathon CRM..."
npm start &
SERVER_PID=$!

# Wait for the server to come up, then open it in the browser.
for i in $(seq 1 60); do
  if curl -s -o /dev/null http://localhost:3000; then
    open http://localhost:3000
    break
  fi
  sleep 0.5
done

echo ""
echo "Marathon CRM is running. Leave this window open while you use the app."
echo "Close this window (or press Ctrl+C) to stop it."
wait $SERVER_PID
