FROM oven/bun:1-alpine

WORKDIR /app

COPY package.json .
COPY index.ts .

EXPOSE 8888

CMD ["bun", "run", "index.ts"]
