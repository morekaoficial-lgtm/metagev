FROM node:20-bookworm-slim

WORKDIR /app

# Dependencias de Puppeteer/Chromium en Debian
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 \
    libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2 \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

COPY package*.json ./
COPY prisma ./prisma

RUN npm install

COPY . .

RUN npx prisma generate && npm run build

EXPOSE 3000

CMD sh -c "npx prisma db push && (node prisma/seed.js || echo 'seed: omitido (ya aplicado o error no fatal)') && node dist/main.js"
