FROM node:24.15-alpine as builder

WORKDIR /app

COPY package*.json ./

RUN npm install --production

COPY . .

RUN npm run build

## Stage 2: Run the application
FROM node:24.15-alpine as runner

WORKDIR /app

COPY --from=builder /app ./dist
COPY --from=builder /app/node_modules ./node_modules

ENV TZ=America/Sao_Paulo
EXPOSE 3000

ENV NODE_ENV=production

CMD ["node", "index.js"]