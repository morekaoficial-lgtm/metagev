FROM node:20-alpine

WORKDIR /app

# Dependencias de Puppeteer/Chromium en Alpine
RUN apk add --no-cache chromium nss freetype harfbuzz ca-certificates ttf-freefont

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

COPY package*.json ./
COPY prisma ./prisma

RUN npm install

COPY . .

RUN npx prisma generate && npm run build

EXPOSE 3000

CMD sh -c "npx prisma db push && (node prisma/seed.js || echo 'seed: omitido (ya aplicado o error no fatal)') && node dist/main.js"
