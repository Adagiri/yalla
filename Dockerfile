FROM public.ecr.aws/amazonlinux/amazonlinux:2023

# Install Node.js 22
RUN dnf update -y && \
    dnf install -y wget tar gzip && \
    wget -qO- https://rpm.nodesource.com/setup_22.x | bash - && \
    dnf install -y nodejs && \
    dnf clean all

WORKDIR /app

# Copy package filez
COPY package*.json ./

# Install all dependencies (including dev for build)
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Expose port
EXPOSE 8080

# Start the application
CMD ["npm", "start"]