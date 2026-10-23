FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ENV PORT=8080 DATA_DIR=/data
EXPOSE 8080
CMD ["npx", "tsx", "src/index.ts"]
