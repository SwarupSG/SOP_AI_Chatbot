# Quick Deployment Reference

## 🎯 Recommended: Hetzner Cloud VPS ($7/month)

**Why**: Best price/performance ratio, perfect for 6 users

### One-Command Setup (after server is ready):

```bash
# On your VPS (Ubuntu 22.04)
git clone <your-repo>
cd SOP_AI_Chatbot/sop-ai
chmod +x docker-compose.prod.setup.sh
./docker-compose.prod.setup.sh
```

### What You Need:

1. **VPS Server**: 
   - Hetzner CPX21 (€6.51/month) or similar
   - 4+ vCPU, 8GB+ RAM, 50GB+ storage

2. **Domain** (optional): 
   - Point to server IP
   - Free SSL via Let's Encrypt

3. **Setup Time**: ~30 minutes

### Monthly Costs:

- **Hetzner VPS**: $7/month
- **Domain**: $0-15/year (optional)
- **Total**: **~$7-8/month**

## Alternative Options:

- **DigitalOcean**: $24/month (easier setup)
- **Railway**: $20/month (managed, easiest)
- **Render**: $25/month (good balance)

## Full Guide:

See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for detailed instructions, security setup, monitoring, and backups.

## Performance Tips:

1. Use Docker Compose (included) for easy management
2. Enable Nginx caching for static assets
3. Consider quantized Ollama models for faster responses
4. Set up automated backups (script included in guide)
