# Performance Debugging Guide

This document explains how to use the comprehensive logging system to debug performance issues in the Security Scanner application.

## 🚀 Quick Start

1. **Start the application with detailed logging:**
   ```bash
   cd backend
   LOG_LEVEL=debug npm start
   ```

2. **Monitor logs in real-time:**
   ```bash
   # Watch all logs
   tail -f backend/logs/*.log
   
   # Watch specific component logs
   tail -f backend/logs/wsl-operations.log
   tail -f backend/logs/scan-orchestrator.log
   tail -f backend/logs/scan-routes.log
   ```

## 📊 Log Files Structure

### Backend Logs
- `backend/logs/app-combined.log` - All application logs
- `backend/logs/app-error.log` - Error logs only
- `backend/logs/wsl-operations.log` - WSL2 command execution details
- `backend/logs/scan-orchestrator.log` - Scan orchestration timing
- `backend/logs/scan-routes.log` - API request/response timing

### Frontend Logs
- Check browser console for detailed API timing logs
- Look for `[API-INFO]` prefixed messages

## 🔍 Performance Investigation Areas

### 1. WSL2 Command Execution
**Symptoms:** Long scan times, WSL timeouts
**Check:** `backend/logs/wsl-operations.log`
**Look for:**
```
[WSL2-INFO] 🔍 Checking WSL2 availability...
[WSL2-INFO] ⚡ Executing WSL command
[WSL2-INFO] 🏁 Command execution completed
```
**Key metrics:**
- `executionTimeMs` - Time taken for WSL commands
- `timeSinceLastOutputMs` - Detect hung processes
- `stdoutBytes`/`stderrBytes` - Data flow monitoring

### 2. File System Operations
**Symptoms:** Slow file uploads, path resolution delays
**Check:** `backend/logs/scan-orchestrator.log`
**Look for:**
```
[ORCHESTRATOR-INFO] 🔍 Resolving target path...
[ORCHESTRATOR-INFO] 📁 Target directory contents analyzed
```
**Key metrics:**
- `resolutionTimeMs` - Path resolution time
- `fileListTimeMs` - Directory listing time
- `fileCount` - Number of files to scan

### 3. Network/API Performance
**Symptoms:** Slow frontend responses, API timeouts
**Check:** Browser console
**Look for:**
```
[API-INFO] 📥 API Response received
[API-INFO] 🔌 WebSocket connected
```
**Key metrics:**
- `duration` - Request/response time
- `responseSize` - Data transfer size
- `connectionTimeMs` - WebSocket connection time

### 4. Scan Tool Performance
**Check:** `backend/logs/scan-orchestrator.log`
**Look for:**
```
[ORCHESTRATOR-INFO] 🔍 Starting Semgrep scan
[ORCHESTRATOR-INFO] ✅ Semgrep scan completed
```
**Key metrics:**
- `executionTimeMs` - Individual tool execution time
- `resultCount` - Number of vulnerabilities found
- `pathConversionTimeMs` - Windows to WSL path conversion time

## 🐛 Common Performance Issues & Solutions

### Issue 1: WSL Commands Timing Out
**Symptoms:**
```
[WSL2-ERROR] ⏰ Command timeout reached
timeoutMs: 300000
timeSinceLastOutputMs: 295000
```

**Solutions:**
1. Increase timeout: Set `SCAN_TIMEOUT=600000` (10 minutes)
2. Check WSL2 resource allocation
3. Verify target directory size isn't too large

### Issue 2: Slow Path Resolution
**Symptoms:**
```
[ORCHESTRATOR-WARN] ⚠️ POTENTIAL BUG: Resolved relative path
```

**Solutions:**
1. Use absolute paths for direct folder scanning
2. Check if target files are in expected temp directory
3. Verify folder registry is working correctly

### Issue 3: Large Directory Scanning
**Symptoms:**
```
[ORCHESTRATOR-INFO] 📁 Target directory contents analyzed
fileCount: 50000
fileListTimeMs: 5000
```

**Solutions:**
1. Use `.gitignore` or similar to exclude unnecessary files
2. Consider increasing timeouts for large codebases
3. Implement file filtering in scan tools

### Issue 4: WebSocket Connection Issues
**Symptoms:**
```
[API-ERROR] ❌ WebSocket error
closeCode: 1006
```

**Solutions:**
1. Check firewall settings
2. Verify WebSocket server is running
3. Check for network connectivity issues

## 📈 Performance Monitoring Commands

### Real-time Performance Monitoring
```bash
# Monitor WSL command execution times
grep "executionTimeMs" backend/logs/wsl-operations.log | tail -10

# Check for timeouts
grep "timeout" backend/logs/*.log

# Monitor scan completion times
grep "totalScanTimeMs" backend/logs/scan-orchestrator.log

# Check API response times
# (In browser console, filter by [API-INFO])
```

### Performance Analysis
```bash
# Find slowest WSL commands
grep "executionTimeMs" backend/logs/wsl-operations.log | \
  jq -r '.executionTimeMs' | sort -n | tail -10

# Check memory usage patterns
grep "stdoutBytes\|stderrBytes" backend/logs/wsl-operations.log

# Analyze scan tool performance
grep "tool.*executionTimeMs" backend/logs/scan-orchestrator.log
```

## ⚙️ Configuration Options

### Environment Variables
```bash
# Logging
LOG_LEVEL=debug          # trace, debug, info, warn, error
SCAN_TIMEOUT=300000      # WSL command timeout (ms)

# WSL Configuration
MOCK_WSL2=true          # Use mock results instead of real WSL
ENABLE_ODC=true         # Enable OWASP Dependency Check

# Paths
TEMP_DIR=/custom/temp   # Custom temp directory
UPLOAD_DIR=/custom/uploads # Custom upload directory
```

### Log Rotation
Logs automatically rotate when they reach 10MB, keeping 5 historical files.

## 🚨 Emergency Debugging

If the application is completely unresponsive:

1. **Check all log files immediately:**
   ```bash
   tail -50 backend/logs/*.log
   ```

2. **Look for fatal errors:**
   ```bash
   grep -i "error\|fatal\|timeout" backend/logs/*.log
   ```

3. **Check system resources:**
   ```bash
   # Windows
   wsl --status
   tasklist | findstr node
   
   # Memory usage
   wmic process where name="node.exe" get PageFileUsage
   ```

4. **Restart with maximum logging:**
   ```bash
   LOG_LEVEL=trace SCAN_TIMEOUT=600000 npm start
   ```

## 📝 Log Rotation and Cleanup

The logging system automatically manages log files, but you can manually clean up:

```bash
# Clean old logs (keeps last 24 hours)
find backend/logs -name "*.log*" -mtime +1 -delete

# Archive logs before cleanup
tar -czf logs-backup-$(date +%Y%m%d).tar.gz backend/logs/
```

## 🔧 Advanced Debugging

### Enable Trace Level Logging
```bash
LOG_LEVEL=trace npm start
```

### Debug Specific Components
```javascript
// In your code, add component-specific debugging
const logger = winston.createLogger({
  level: 'debug',
  defaultMeta: { component: 'MyComponent' }
});
```

### Monitor Real-time Performance
```bash
# Watch for performance bottlenecks
tail -f backend/logs/*.log | grep -E "TimeMs|Duration"
```

This comprehensive logging system will help you identify exactly where performance bottlenecks are occurring in your application!
