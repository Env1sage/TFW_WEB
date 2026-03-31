#!/bin/bash
# ─────────────────────────────────────────────────────
# TFW — First-time Hostinger VPS setup script
# Run this ONCE on your VPS after SSH-ing in as root
# Usage: bash scripts/setup-vps.sh
# ─────────────────────────────────────────────────────
set -euo pipefail

DOMAIN="${1:-theframedwall.com}"
DEPLOY_PATH="/opt/tfw"
REPO_URL="${2:-git@github.com:YOUR_USERNAME/TFW_WEB.git}"

echo "=== TFW VPS Setup ==="
echo "Domain: $DOMAIN"
echo "Deploy path: $DEPLOY_PATH"
echo ""

# ── 1. System updates ──
echo "[1/7] Updating system packages..."
apt update && apt upgrade -y

# ── 2. Install Docker ──
echo "[2/7] Installing Docker..."
if ! command -v docker &> /dev/null; then
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
  echo "Docker installed."
else
  echo "Docker already installed."
fi

# ── 3. Install Docker Compose plugin ──
echo "[3/7] Checking Docker Compose..."
if ! docker compose version &> /dev/null; then
  apt install -y docker-compose-plugin
fi
docker compose version

# ── 4. Install Git ──
echo "[4/7] Installing Git..."
apt install -y git

# ── 5. Clone repo ──
echo "[5/7] Setting up project..."
if [ ! -d "$DEPLOY_PATH" ]; then
  git clone "$REPO_URL" "$DEPLOY_PATH"
else
  echo "Project already exists at $DEPLOY_PATH"
  cd "$DEPLOY_PATH" && git pull origin main
fi
cd "$DEPLOY_PATH"

# ── 6. Create .env from example ──
echo "[6/7] Setting up environment..."
if [ ! -f .env.production ]; then
  cp .env.production.example .env.production
  echo ""
  echo "*** IMPORTANT: Edit .env.production with your actual values ***"
  echo "    nano $DEPLOY_PATH/.env.production"
  echo ""
else
  echo ".env.production already exists."
fi

# Create SSL directory
mkdir -p nginx/ssl

# ── 7. SSL Certificate (Let's Encrypt) ──
echo "[7/7] Setting up SSL certificate..."
echo ""
echo "To get SSL certificate, first start nginx without SSL:"
echo ""
echo "  1. Temporarily modify nginx/default.conf to only have the HTTP server block"
echo "  2. docker compose -f docker-compose.prod.yml up -d nginx"
echo "  3. Run:"
echo "     docker compose -f docker-compose.prod.yml run --rm certbot certonly \\"
echo "       --webroot --webroot-path=/var/www/certbot \\"
echo "       -d $DOMAIN -d www.$DOMAIN \\"
echo "       --email your-email@example.com --agree-tos --no-eff-email"
echo "  4. Restore the full nginx/default.conf and restart"
echo ""

echo "=== Setup Complete ==="
echo ""
echo "Next steps:"
echo "  1. Edit .env.production:  nano $DEPLOY_PATH/.env.production"
echo "  2. Set up SSL (see instructions above)"
echo "  3. Start the app:  cd $DEPLOY_PATH && docker compose --env-file .env.production -f docker-compose.prod.yml up -d"
echo "  4. Set up GitHub Secrets for CI/CD (see DEPLOYMENT.md)"
echo ""
