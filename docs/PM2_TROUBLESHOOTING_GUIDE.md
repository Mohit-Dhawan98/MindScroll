# 🔧 PM2 Process Management & Troubleshooting Guide

**Complete guide for managing and troubleshooting PM2 processes in production**

## 📋 Table of Contents
- [Quick Commands](#quick-commands)
- [Why PM2 Processes Stop](#why-pm2-processes-stop)
- [Starting Services](#starting-services)
- [Monitoring & Diagnostics](#monitoring--diagnostics)
- [Auto-Startup Configuration](#auto-startup-configuration)
- [Troubleshooting Common Issues](#troubleshooting-common-issues)
- [Emergency Recovery](#emergency-recovery)

---

## ⚡ Quick Commands

### Check Current Status
```bash
pm2 status
pm2 list
```

### Restart All Services
```bash
cd ~/MindScroll/backend
pm2 restart all
```

### View Logs
```bash
pm2 logs --lines 50
pm2 logs mindscroll-api
pm2 logs mindscroll-worker
```

### Emergency Full Restart
```bash
pm2 delete all
cd ~/MindScroll/backend
pm2 start ecosystem.config.cjs --env production
```

---

## 🚨 Why PM2 Processes Stop

### 1. **Server Reboot**
- EC2 instance was restarted
- AWS maintenance or updates
- Manual server restart

### 2. **Out of Memory (OOM) Killer**
- System kills processes when memory runs out
- Check with: `free -h` and `dmesg | grep -i "killed process"`
- Solution: Upgrade instance size or optimize memory usage

### 3. **Application Crashes**
- Unhandled exceptions in Node.js code
- Database connection failures
- API timeouts or errors
- Check logs: `pm2 logs --lines 100`

### 4. **Manual Actions**
- Someone ran `pm2 stop` or `pm2 delete`
- System administrator maintenance
- Deployment scripts stopping processes

### 5. **File System Issues**
- Disk full (check with `df -h`)
- Permission issues
- Log file rotation problems

---

## 🚀 Starting Services

### Method 1: Using Ecosystem Config (Recommended)
```bash
cd ~/MindScroll/backend

# Start with ecosystem config
pm2 start ecosystem.config.cjs --env production

# Verify 3 processes are running (2 API + 1 Worker)
pm2 status
```

### Method 2: Manual Start (More Control)
```bash
cd ~/MindScroll/backend

# Clean slate
pm2 delete all

# Start API server (cluster mode for performance)
pm2 start src/index.js --name "mindscroll-api" --env production -i max

# Start worker (single instance to avoid job conflicts)
pm2 start src/services/worker.js --name "mindscroll-worker" --env production -i 1

# Verify processes
pm2 status
```

### Expected Output
```
┌────┬──────────────────────┬─────────────┬─────────┬─────────┬──────────┬────────┬──────┬───────────┬──────────┬──────────┬──────────┬──────────┐
│ id │ name                 │ namespace   │ version │ mode    │ pid      │ uptime │ ↺    │ status    │ cpu      │ mem      │ user     │ watching │
├────┼──────────────────────┼─────────────┼─────────┼─────────┼──────────┼────────┼──────┼───────────┼──────────┼──────────┼──────────┼──────────┤
│ 0  │ mindscroll-api       │ default     │ 1.0.0   │ cluster │ 26998    │ 5m     │ 0    │ online    │ 0%       │ 189.0mb  │ ubuntu   │ disabled │
│ 2  │ mindscroll-api       │ default     │ 1.0.0   │ cluster │ 27021    │ 5m     │ 0    │ online    │ 0%       │ 182.4mb  │ ubuntu   │ disabled │
│ 1  │ mindscroll-worker    │ default     │ 1.0.0   │ fork    │ 26999    │ 5m     │ 0    │ online    │ 0%       │ 177.7mb  │ ubuntu   │ disabled │
└────┴──────────────────────┴─────────────┴─────────┴─────────┴──────────┴────────┴──────┴───────────┴──────────┴──────────┴──────────┴──────────┘
```

**Key Indicators:**
- **status**: Should be "online" for all processes
- **↺ (restarts)**: Low number is good (0-2), high numbers indicate crashes
- **uptime**: How long each process has been running
- **mem**: Memory usage (should be reasonable, not growing continuously)

---

## 📊 Monitoring & Diagnostics

### Real-time Monitoring
```bash
# Live process monitor (like htop for PM2)
pm2 monit

# Live logs (all processes)
pm2 logs --lines 0

# Live logs for specific process
pm2 logs mindscroll-api --lines 0
pm2 logs mindscroll-worker --lines 0
```

### Health Checks
```bash
# Test API locally
curl localhost:3001/api
curl localhost:3001/health

# Test external access
curl https://epigram.duckdns.org/api
curl https://epigram.duckdns.org/health

# Check system resources
free -h          # Memory usage
df -h            # Disk usage
top              # CPU usage
```

### Log Analysis
```bash
# Recent errors in logs
pm2 logs --lines 100 | grep -i error

# API specific errors
pm2 logs mindscroll-api --lines 50 | grep -i error

# Worker specific errors  
pm2 logs mindscroll-worker --lines 50 | grep -i error

# Database connection issues
pm2 logs | grep -i "database\|prisma\|connection"

# Redis connection issues
pm2 logs | grep -i redis
```

---

## 🔄 Auto-Startup Configuration

### Set Up Auto-Startup (Run Once)
```bash
# Save current PM2 configuration
pm2 save

# Generate startup script
pm2 startup

# Run the command it outputs (example):
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u ubuntu --hp /home/ubuntu
```

### Verify Auto-Startup
```bash
# Check if PM2 is enabled in systemd
sudo systemctl status pm2-ubuntu

# Test by rebooting (careful!)
sudo reboot
# Wait for server to come back up, then check:
pm2 status
```

### Update Saved Configuration
```bash
# After making changes to processes, save again
pm2 save

# Verify saved configuration
cat ~/.pm2/dump.pm2
```

---

## 🔧 Troubleshooting Common Issues

### Issue: "No processes found"
```bash
# Check if PM2 daemon is running
pm2 ping

# If not responding, restart PM2 daemon
pm2 kill
pm2 resurrect

# If that fails, start fresh
cd ~/MindScroll/backend
pm2 start ecosystem.config.cjs --env production
```

### Issue: Processes Keep Crashing (High restart count)
```bash
# Check recent logs for errors
pm2 logs --lines 100

# Check specific error patterns
pm2 logs | grep -E "(Error|Exception|failed|timeout)"

# Check system memory
free -h
dmesg | grep -i "killed process"

# If out of memory, restart with lower instances
pm2 delete all
pm2 start src/index.js --name "api" --env production -i 1
pm2 start src/services/worker.js --name "worker" --env production -i 1
```

### Issue: "Port already in use"
```bash
# Check what's using port 3001
sudo lsof -i :3001

# Kill processes using the port
sudo pkill -f "node.*3001"

# Or find and kill specific PID
sudo lsof -i :3001
sudo kill -9 <PID>

# Then restart PM2
pm2 restart all
```

### Issue: Database Connection Errors
```bash
# Check database connectivity
cd ~/MindScroll/backend
npx prisma db push

# Check environment variables
grep DATABASE_URL .env.production

# Restart with fresh environment
pm2 restart all --update-env
```

### Issue: Redis Connection Errors
```bash
# Check Redis status
redis-cli ping

# If not running
sudo systemctl start redis-server
sudo systemctl enable redis-server

# Check Redis logs
sudo journalctl -u redis-server --lines 20
```

---

## 🚨 Emergency Recovery

### Complete Service Restart
```bash
# Stop everything
pm2 delete all
pm2 kill

# Check for lingering processes
ps aux | grep node
sudo pkill -f node

# Start fresh
cd ~/MindScroll/backend
pm2 start ecosystem.config.cjs --env production

# Verify
pm2 status
curl localhost:3001/health
```

### System Recovery After Reboot
```bash
# If PM2 didn't auto-start after reboot
pm2 resurrect

# If that doesn't work
cd ~/MindScroll/backend
pm2 start ecosystem.config.cjs --env production
pm2 save
```

### Restore from Backup Configuration
```bash
# If you have a working PM2 dump file
pm2 kill
pm2 resurrect

# Or restore from specific dump file
pm2 resurrect /path/to/dump.pm2
```

---

## 📈 Performance Optimization

### Monitor Resource Usage
```bash
# PM2 process monitor
pm2 monit

# System resources
htop
free -h
iostat 1

# Check for memory leaks
pm2 logs | grep -i "memory\|heap\|gc"
```

### Scale Instances Based on Load
```bash
# Scale API instances up
pm2 scale mindscroll-api +2

# Scale down if needed
pm2 scale mindscroll-api 2

# Always keep worker at 1 instance to avoid job conflicts
pm2 scale mindscroll-worker 1
```

### Optimize Memory Usage
```bash
# Restart processes periodically to clear memory
pm2 restart all

# Enable auto-restart on memory threshold (example: 500MB)
pm2 start src/index.js --name "api" --max-memory-restart 500M
```

---

## 📝 Maintenance Commands

### Daily Health Check
```bash
# Quick status check
pm2 status && curl -s localhost:3001/health

# Check for recent errors
pm2 logs --lines 50 | grep -i error | tail -10

# System resource check
free -h && df -h
```

### Weekly Maintenance
```bash
# Restart to clear memory
pm2 restart all

# Clean old logs (PM2 log rotation)
pm2 flush

# Check for process updates
pm2 update
```

### Emergency Contacts Checklist
1. **Check PM2 Status**: `pm2 status`
2. **Check Logs**: `pm2 logs --lines 50`
3. **Check System Resources**: `free -h && df -h`
4. **Test API**: `curl localhost:3001/health`
5. **Restart if needed**: `pm2 restart all`

---

## 📚 Useful PM2 Commands Reference

```bash
# Process Management
pm2 start <script>          # Start process
pm2 stop <name|id>          # Stop process
pm2 restart <name|id>       # Restart process
pm2 delete <name|id>        # Delete process
pm2 reload <name|id>        # Graceful reload

# Monitoring
pm2 status                  # Process status
pm2 monit                   # Live monitor
pm2 logs [name]            # View logs
pm2 flush                  # Clear logs

# Cluster Management
pm2 scale <name> <number>   # Scale instances
pm2 reload all             # Graceful reload all

# Configuration
pm2 save                   # Save current processes
pm2 resurrect              # Restore saved processes
pm2 startup                # Configure auto-startup
pm2 unstartup              # Remove auto-startup

# Information
pm2 show <name|id>         # Detailed process info
pm2 prettylist             # Formatted process list
pm2 jlist                  # JSON process list
```

---

**Last Updated:** August 2025  
**Version:** v1.0 - Production PM2 Management  
**Tested on:** Ubuntu 22.04 LTS, PM2 5.x, Node.js 20.x

> 💡 **Pro Tip**: Always run `pm2 save` after making changes to ensure your configuration survives server reboots!