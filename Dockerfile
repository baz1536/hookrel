ARG NODE_VERSION=26.6.0
FROM node:${NODE_VERSION}-slim

WORKDIR /app

COPY package.json ./

RUN npm install --omit=dev --ignore-scripts && \
    npm cache clean --force

COPY . .

RUN mkdir -p /app/logs && chown -R node:node /app/logs

EXPOSE 3551

HEALTHCHECK --interval=10s --timeout=2s --start-period=5s --retries=2 \
    CMD node -e "fetch('http://localhost:'+(process.env.PORT||3551)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

USER node

CMD ["node", "src/server.js"]
