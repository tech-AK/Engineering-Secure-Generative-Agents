FROM node:20.11-bookworm

WORKDIR /app
COPY package.json package-lock.json ./

RUN npm install

COPY . .

EXPOSE 8080
CMD npm run build && npm run start