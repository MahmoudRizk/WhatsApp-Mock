FROM node:18-alpine
RUN apk add --no-cache openssl
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npx prisma generate
RUN npm run build
EXPOSE 3000
# sqlite has no tables until db push; generate-only at build left an empty file.
CMD ["sh", "-c", "npx prisma db push --skip-generate && npm start"]
