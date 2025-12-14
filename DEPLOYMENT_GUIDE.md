# Cost-Effective Deployment Guide

This guide outlines the most cost-effective ways to deploy your SOP AI Chatbot while maintaining fast, responsive performance.

## Application Requirements

- **Next.js application** (Node.js runtime)
- **Docker services**: Ollama (LLM) + ChromaDB (vector DB)
- **SQLite database** (file-based)
- **Persistent storage** for Docker volumes (~5-10GB for models + data)
- **6 concurrent users** (small team)
- **Low to moderate traffic**

## Recommended Deployment Options (Ranked by Cost-Effectiveness)

### 🥇 Option 1: VPS with Docker (Most Cost-Effective)

**Best for**: Maximum control, lowest cost, predictable pricing

#### Recommended Providers:

1. **Hetzner Cloud** (Best Value)
   - **Specs**: CPX21 (4 vCPU, 8GB RAM, 160GB SSD) - **€6.51/month (~$7)**
   - **Why**: Excellent price/performance, fast SSD, good for EU
   - **Location**: EU (Germany, Finland, Netherlands)

2. **DigitalOcean Droplet**
   - **Specs**: Basic 4GB/2 vCPU - **$24/month**
   - **Why**: Great documentation, easy setup, reliable
   - **Location**: Global (US, EU, Asia)

3. **Linode (Akamai)**
   - **Specs**: Shared 4GB/2 vCPU - **$18/month**
   - **Why**: Good performance, competitive pricing
   - **Location**: Global

4. **AWS EC2 t3.medium**
   - **Specs**: 2 vCPU, 4GB RAM - **~$30/month** (with reserved instances)
   - **Why**: Enterprise-grade, global presence
   - **Location**: Global

#### Setup Steps (Option A: Docker Compose - Recommended):

**Easiest deployment using Docker Compose:**

```bash
# 1. Create VPS instance (choose Ubuntu 22.04 LTS)
# 2. SSH into server
ssh root@your-server-ip

# 3. Install Docker & Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
apt-get install docker-compose-plugin -y

# 4. Clone your repository
git clone <your-repo-url>
cd SOP_AI_Chatbot/sop-ai

# 5. Run the production setup script
chmod +x docker-compose.prod.setup.sh
./docker-compose.prod.setup.sh

# 6. Set up reverse proxy with Nginx
apt-get install nginx -y

# Create Nginx config
cat > /etc/nginx/sites-available/sop-ai <<EOF
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

ln -s /etc/nginx/sites-available/sop-ai /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx

# 7. Set up SSL with Let's Encrypt (free)
apt-get install certbot python3-certbot-nginx -y
certbot --nginx -d your-domain.com

# 8. Check status
docker-compose -f docker-compose.prod.yml ps
```

**Manual Docker Compose setup (if script doesn't work):**

```bash
# Build and start all services
docker-compose -f docker-compose.prod.yml up -d

# Pull Ollama models
docker exec sop-ai-ollama ollama pull qwen2.5:3b
docker exec sop-ai-ollama ollama pull nomic-embed-text

# Seed database
docker exec sop-ai-app npm run seed

# Index SOPs
docker exec sop-ai-app npm run index
```

#### Setup Steps (Option B: Traditional Node.js):

**If you prefer running Node.js directly (without Docker for the app):**

```bash
# 1. Create VPS instance (choose Ubuntu 22.04 LTS)
# 2. SSH into server
ssh root@your-server-ip

# 3. Install Docker & Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
apt-get install docker-compose-plugin -y

# 4. Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# 5. Clone your repository
git clone <your-repo-url>
cd SOP_AI_Chatbot/sop-ai

# 6. Start Docker services (Ollama + ChromaDB only)
docker-compose up -d

# 7. Pull Ollama models (this takes time, ~4GB download)
docker exec sop-ai-ollama ollama pull qwen2.5:3b
docker exec sop-ai-ollama ollama pull nomic-embed-text

# 8. Install dependencies
npm install

# 9. Build the application
npm run build

# 10. Seed database
npm run seed

# 11. Index SOPs
npm run index

# 12. Set environment variables
export JWT_SECRET="your-secure-random-secret-here"
export CHROMA_URL="http://localhost:8000"
export OLLAMA_URL="http://localhost:11434"
export NODE_ENV="production"

# 13. Start production server with PM2 (process manager)
npm install -g pm2
pm2 start npm --name "sop-ai" -- start
pm2 save
pm2 startup  # Follow instructions to enable auto-start

# 14. Set up reverse proxy with Nginx (same as Option A)
apt-get install nginx -y
# ... (same Nginx config as above)

# 15. Set up SSL with Let's Encrypt (same as Option A)
apt-get install certbot python3-certbot-nginx -y
certbot --nginx -d your-domain.com
```

**Estimated Monthly Cost**: $7-30/month
**Performance**: Excellent (dedicated resources)
**Scalability**: Easy to upgrade

---

### 🥈 Option 2: Railway (Easiest Setup)

**Best for**: Quick deployment, minimal DevOps knowledge

- **Pricing**: ~$20/month (includes Docker support)
- **Pros**: 
  - One-click deployment
  - Automatic HTTPS
  - Built-in monitoring
  - Easy database backups
- **Cons**: Slightly more expensive than VPS
- **Setup**: Connect GitHub repo, Railway auto-detects Docker

**Estimated Monthly Cost**: $20-25/month

---

### 🥉 Option 3: Render (Good Balance)

**Best for**: Managed services with Docker support

- **Pricing**: 
  - Web Service: $7/month (512MB RAM) - may need upgrade
  - Recommended: $25/month (2GB RAM)
- **Pros**: 
  - Free SSL
  - Auto-deploy from Git
  - Built-in monitoring
- **Cons**: Need to configure Docker services separately

**Estimated Monthly Cost**: $25-35/month

---

### Option 4: Fly.io (Edge Deployment)

**Best for**: Global distribution, low latency

- **Pricing**: Pay-as-you-go, ~$15-20/month for small apps
- **Pros**: 
  - Edge deployment (fast globally)
  - Good Docker support
  - Generous free tier
- **Cons**: More complex setup

**Estimated Monthly Cost**: $15-25/month

---

## Performance Optimizations

### 1. Next.js Production Build

Already configured with `npm run build`. Ensure you're using:

```bash
npm run build
npm start  # Production mode
```

### 2. Enable Caching

Update `next.config.ts`:

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable static optimization
  output: 'standalone', // For Docker deployments
  
  // Optimize images if you add any
  images: {
    unoptimized: true, // Or configure image optimization
  },
  
  // Compression
  compress: true,
  
  // Production optimizations
  poweredByHeader: false,
  reactStrictMode: true,
};

export default nextConfig;
```

### 3. Use PM2 for Process Management

PM2 keeps your app running and restarts on crashes:

```bash
npm install -g pm2
pm2 start npm --name "sop-ai" -- start
pm2 save
pm2 startup
```

### 4. Nginx Caching (Optional)

Add caching to Nginx config for static assets:

```nginx
# Cache static assets
location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

### 5. Database Optimization

SQLite is already efficient for 6 users. Consider:
- Regular backups (cron job)
- Connection pooling (already handled by drizzle-orm)

### 6. Ollama Model Optimization

For faster responses, consider:
- Using a smaller model: `qwen2.5:3b` (already optimized for lower resources)
- Or: `llama3.2:3b` (smaller, faster, still good quality)

```bash
docker exec sop-ai-ollama ollama pull qwen2.5:3b-instruct-q4_K_M
# Update chroma.ts to use the new model
```

---

## Cost Comparison Summary

| Option | Monthly Cost | Setup Difficulty | Performance | Best For |
|--------|-------------|------------------|-------------|----------|
| **Hetzner VPS** | $7 | Medium | ⭐⭐⭐⭐⭐ | Best value |
| **DigitalOcean** | $24 | Easy | ⭐⭐⭐⭐⭐ | Easiest VPS |
| **Railway** | $20 | Very Easy | ⭐⭐⭐⭐ | Quick setup |
| **Render** | $25 | Easy | ⭐⭐⭐⭐ | Managed service |
| **Fly.io** | $15-20 | Medium | ⭐⭐⭐⭐⭐ | Global edge |

---

## Recommended Choice: Hetzner Cloud VPS

**Why Hetzner is the best choice:**
1. **Lowest cost** ($7/month) for excellent specs
2. **Fast performance** (SSD, good CPU)
3. **Predictable pricing** (no surprises)
4. **Full control** (Docker, custom configs)
5. **Sufficient resources** for 6 users + Ollama + ChromaDB

**Resource Requirements:**
- **CPU**: 2-4 vCPU (Ollama needs CPU for inference)
- **RAM**: 8GB minimum (4GB for Ollama model, 2GB for ChromaDB, 2GB for Next.js)
- **Storage**: 50GB+ (models ~4GB, ChromaDB data, app files)
- **Network**: Standard (low bandwidth needs)

---

## Security Considerations

1. **Set strong JWT_SECRET**:
   ```bash
   openssl rand -base64 32
   ```

2. **Firewall setup** (UFW):
   ```bash
   ufw allow 22/tcp    # SSH
   ufw allow 80/tcp    # HTTP
   ufw allow 443/tcp   # HTTPS
   ufw enable
   ```

3. **Regular updates**:
   ```bash
   apt-get update && apt-get upgrade -y
   ```

4. **Backup strategy**:
   ```bash
   # Daily backup script
   # Backup SQLite DB and Docker volumes
   ```

---

## Monitoring & Maintenance

### Health Checks

Set up a simple health check endpoint or use:
- **Uptime monitoring**: UptimeRobot (free), Pingdom
- **Application monitoring**: PM2 monitoring, or simple log checking

### Backup Script

```bash
#!/bin/bash
# backup.sh - Run daily via cron

DATE=$(date +%Y%m%d)
BACKUP_DIR="/root/backups"

mkdir -p $BACKUP_DIR

# Backup SQLite database
cp /path/to/sop-ai.db $BACKUP_DIR/sop-ai-$DATE.db

# Backup Docker volumes
docker run --rm -v sop-ai_chroma_data:/data -v $BACKUP_DIR:/backup \
  alpine tar czf /backup/chroma-$DATE.tar.gz /data

# Keep only last 7 days
find $BACKUP_DIR -name "*.db" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete
```

---

## Quick Start: Hetzner Deployment

1. **Sign up** at https://www.hetzner.com/cloud
2. **Create CPX21 instance** (€6.51/month)
3. **Choose location** closest to your users
4. **Follow VPS setup steps** above
5. **Point domain** to server IP (or use IP directly)
6. **Set up SSL** with Let's Encrypt

**Total setup time**: ~30-60 minutes
**Monthly cost**: ~$7-10 (including domain if needed)

---

## Need Help?

- **Docker issues**: Check `docker ps` and `docker logs`
- **Performance**: Monitor with `htop` and `docker stats`
- **SSL issues**: Check certbot logs in `/var/log/letsencrypt/`

