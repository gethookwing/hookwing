FROM oven/bun:1-alpine

WORKDIR /app

COPY package.json .
COPY index.ts .

EXPOSE 9999

CMD ["bun", "run", "index.ts"]
