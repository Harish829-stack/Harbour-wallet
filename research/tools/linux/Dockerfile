FROM --platform=linux/amd64 node:22.22.3-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends procps util-linux ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /opt/rea
RUN npm init -y && npm install --save-exact rea-agents@6.5.0 @wakaru/cli@1.14.0
ENV REA_WAKARU_COMMAND=/opt/rea/node_modules/@wakaru/cli-linux-x64/wakaru
ENTRYPOINT ["/opt/rea/node_modules/.bin/rea"]
