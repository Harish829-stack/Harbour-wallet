# Centrifugo with the Harbour channel config baked in, for platforms without bind mounts (Railway).
# Docker Compose does not use this file: it runs the stock image and mounts config.json.
# Required environment: CENTRIFUGO_CLIENT_TOKEN_HMAC_SECRET_KEY (same value as the API's CENTRIFUGO_TOKEN_HMAC_SECRET),
# CENTRIFUGO_HTTP_API_KEY (same value as realtime-bridge's CENTRIFUGO_API_KEY), CENTRIFUGO_ENGINE_TYPE=memory (single node).
FROM centrifugo/centrifugo:v6
COPY config.json /centrifugo/config.json
CMD ["centrifugo", "--config", "/centrifugo/config.json"]
