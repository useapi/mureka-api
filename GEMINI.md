# Mureka via useapi.net

This extension connects the hosted useapi.net Mureka MCP server (`useapi-mureka`, 40 tools). The tools make songs and instrumentals, manage characters, remix, split stems, get sheet music and generate speech, on your own Mureka web plan.

- Endpoint: https://api.useapi.net/v1/mureka/mcp (Streamable HTTP), authorized with the user's useapi.net API token in `USEAPI_TOKEN`.
- Before the tools work, the user needs a useapi.net API token (https://useapi.net/docs/start-here/setup-useapi) and an account connected at https://useapi.net/docs/start-here/setup-mureka.
- If a tool returns 401, ask the user to check `USEAPI_TOKEN` (`gemini extensions config useapi-mureka`). If it says no account is configured, point them to the setup page above.
- Generations spend the user's own plan credits. Ask before starting paid or long jobs, and report job status and links when they finish.
- Full tool list and limits: https://useapi.net/docs/api-mureka-v1/mcp

useapi.net is a paid third-party API service ($15/month, covers every useapi.net API), not affiliated with Mureka or Kunlun Tech.
