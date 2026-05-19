FROM node:24.15-alpine as builder

WORKDIR /app

COPY package*.json ./

RUN npm install --omit=dev

COPY . .

RUN npm run build

## Stage 2: Run the application
FROM node:24.15-alpine as runner

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

ENV TZ=America/Sao_Paulo
EXPOSE 3000

ENV NODE_ENV=production

CMD ["npm", "run","start"]