# Use Node.js LTS version (Alpine)
FROM node:20-alpine

RUN apk add --no-cache openssl libc6-compat

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json (if available, using wildcard)
COPY package*.json ./

# Install dependencies (use npm ci or npm install)
RUN npm install

# Copy the rest of the application files
COPY . .

# Generate the Prisma Client
RUN npx prisma generate

# Build TypeScript to JavaScript
RUN npm run build

# Expose the application port (3000)
EXPOSE 3000

# On container start, run prisma generate, migrations, compile TS, and start the server
CMD ["sh", "-c", "npx prisma generate && npx prisma migrate deploy && npm run build && npm run start"]
