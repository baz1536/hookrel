FROM node:24-alpine

WORKDIR /app

COPY package.json ./

RUN npm install --omit=dev --ignore-scripts && \
    npm cache clean --force

COPY . .

RUN mkdir -p /app/logs && chown -R node:node /app/logs

EXPOSE 3551

USER node

CMD ["node", "src/server.js"]
