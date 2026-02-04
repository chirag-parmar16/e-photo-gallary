FROM node:20-alpine

WORKDIR /app

# Install Package Manager if needed


# Copy dependency definitions
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy Source
COPY . .

# Build (if needed)
# No build step required

# Expose Port
EXPOSE 3000

# Ensure directories for persistence exist (will be used as mount points)
RUN mkdir -p database public/uploads/images public/uploads/videos

# Start Command
CMD ["node", "server/index.js"]