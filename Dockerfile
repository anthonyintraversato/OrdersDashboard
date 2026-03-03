FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production=false
COPY client/package*.json ./client/
RUN cd client && npm install
COPY . .
RUN cd client && npx vite build
EXPOSE 8080
CMD ["node", "server/index.js"]
