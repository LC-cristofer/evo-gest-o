FROM node:20-alpine

WORKDIR /app

COPY package.json ./

RUN npm install

COPY . .

RUN mkdir -p uploads logs && chmod -R 777 /app

EXPOSE 4000

# Inline para não depender de script que o bind mount sobrescreve
CMD ["sh", "-c", "npm install --prefer-offline --no-audit --no-fund && node src/config/seed.js || true && node src/app.js"]
