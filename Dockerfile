# build frontend
FROM node:14 as build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client/ ./
RUN npm run build

# build backend
FROM node:14
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
COPY --from=build /app/client/dist /app/client/dist
EXPOSE 3000
CMD [ "node", "index.js" ]
