FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3000
VOLUME ["/app/public/uploads"]
CMD ["npm","run","start"]