FROM node:20-alpine

WORKDIR /app

COPY package.json ./

RUN npm install

COPY . .

RUN mkdir -p uploads logs && chmod -R 777 /app

EXPOSE 4000

# Entrypoint: roda seed e depois inicia a API
CMD ["sh", "-c", "node src/config/seed.js && node src/app.js"]
