#!/bin/bash
# =========================================================================
# Cerberus Production Deploy Script
# =========================================================================

set -e

echo "🚀 Starting Cerberus Production Deployment..."

# 0. Fetch latest changes from Git
echo "⬇️  Pulling latest changes from git..."
git pull

# 0.1 Check and stop development containers to avoid port conflicts
if [ -f docker-compose.yml ]; then
    echo "🧹 Stopping development containers if running..."
    docker compose down --remove-orphans || docker-compose down --remove-orphans
fi


# 1. Create directory structure on host
echo "📂 Creating host directories under /opt/cerberus..."
sudo mkdir -p /opt/cerberus/data/postgres
sudo mkdir -p /opt/cerberus/data/uploads
sudo mkdir -p /opt/cerberus/ssl

# 2. Adjust permissions
echo "🔒 Adjusting permissions for docker storage..."
sudo chmod -R 775 /opt/cerberus/data
sudo chown -R 999:999 /opt/cerberus/data/postgres # Standard Postgres container UID

# 3. Handle SSL Certificates (Generate self-signed fallback if missing)
if [ ! -f /opt/cerberus/ssl/cerberus.crt ] || [ ! -f /opt/cerberus/ssl/cerberus.key ]; then
    echo "⚠️  SSL certificates not found in /opt/cerberus/ssl/."
    echo "⚙️  Generating a temporary self-signed SSL certificate for local testing..."
    sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout /opt/cerberus/ssl/cerberus.key \
        -out /opt/cerberus/ssl/cerberus.crt \
        -subj "/CN=localhost"
    echo "✅ Temporary SSL certificate generated."
else
    echo "✅ Existing SSL certificates found."
fi

# 4. Prepare production env file
if [ ! -f .env.prod ]; then
    echo "📄 Creating .env.prod from .env.example..."
    cp .env.example .env.prod
    # Generate a random JWT secret inside .env.prod
    JWT_RANDOM=$(openssl rand -hex 32 2>/dev/null || echo "7d9f8c2e4b6a1f53d0e9a7c4b8f1e2d6c5a9f3b7e1d4c8a2f6b9e0d3c7a1f5e")
    sed -i "s/your_secure_jwt_secret_key_here/$JWT_RANDOM/g" .env.prod
    echo "⚠️  Please review and update .env.prod configuration before continuing."
fi

# 5. Build and run containers
echo "⚡ Building and starting production containers in detached mode..."
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build

echo "================================================================="
echo "✅ Cerberus Stack is up! Run these commands to monitor health:"
echo "   - View running containers: docker compose -f docker-compose.prod.yml ps"
echo "   - Monitor Gateway logs:   docker compose -f docker-compose.prod.yml logs -f gateway"
echo "   - Monitor API logs:       docker compose -f docker-compose.prod.yml logs -f api"
echo "================================================================="
