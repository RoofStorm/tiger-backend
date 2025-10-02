# Troubleshooting Guide

## Common Issues and Solutions

### 1. Package Installation Issues

#### Error: `No matching version found for tsconfig-paths@^4.2.1`

**Solution:**
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and package-lock.json
rm -rf node_modules package-lock.json  # Linux/Mac
# or
rmdir /s /q node_modules & del package-lock.json  # Windows

# Install with legacy peer deps
npm install --legacy-peer-deps
```

#### Error: `ETARGET` or version conflicts

**Solution:**
```bash
# Use the install script
./install.bat  # Windows
# or
chmod +x install.sh && ./install.sh  # Linux/Mac
```

### 2. Database Connection Issues

#### Error: `Connection refused` or `ECONNREFUSED`

**Solutions:**
1. **Check if PostgreSQL is running:**
   ```bash
   docker-compose ps
   ```

2. **Start database service:**
   ```bash
   docker-compose up -d db
   ```

3. **Check database URL in .env:**
   ```env
   DATABASE_URL="postgresql://postgres:password@localhost:5432/tiger"
   ```

4. **Wait for database to be ready:**
   ```bash
   # Wait 10-15 seconds after starting
   sleep 15
   ```

### 3. Prisma Issues

#### Error: `PrismaClientInitializationError`

**Solutions:**
1. **Generate Prisma client:**
   ```bash
   npx prisma generate
   ```

2. **Reset database:**
   ```bash
   npx prisma migrate reset
   npm run db:seed
   ```

3. **Check Prisma schema:**
   ```bash
   npx prisma validate
   ```

### 4. Docker Issues

#### Error: `Port already in use`

**Solutions:**
1. **Check what's using the port:**
   ```bash
   netstat -ano | findstr :4000  # Windows
   lsof -i :4000  # Linux/Mac
   ```

2. **Stop conflicting services:**
   ```bash
   docker-compose down
   ```

3. **Change ports in docker-compose.yml:**
   ```yaml
   ports:
     - "4001:4000"  # Use different port
   ```

#### Error: `Cannot connect to Docker daemon`

**Solutions:**
1. **Start Docker Desktop**
2. **Restart Docker service:**
   ```bash
   # Windows
   net stop com.docker.service
   net start com.docker.service
   
   # Linux
   sudo systemctl restart docker
   ```

### 5. Environment Variables Issues

#### Error: `JWT_SECRET is not defined`

**Solutions:**
1. **Copy environment file:**
   ```bash
   cp env.example .env
   ```

2. **Set required variables in .env:**
   ```env
   JWT_SECRET="your-super-secret-jwt-key-here"
   JWT_REFRESH_SECRET="your-super-secret-refresh-key-here"
   DATABASE_URL="postgresql://postgres:password@localhost:5432/tiger"
   ```

### 6. Build Issues

#### Error: `Cannot find module` or TypeScript errors

**Solutions:**
1. **Clean and rebuild:**
   ```bash
   npm run build
   ```

2. **Check TypeScript configuration:**
   ```bash
   npx tsc --noEmit
   ```

3. **Install missing types:**
   ```bash
   npm install --save-dev @types/node @types/express
   ```

### 7. Test Issues

#### Error: `Jest tests failing`

**Solutions:**
1. **Run tests with verbose output:**
   ```bash
   npm test -- --verbose
   ```

2. **Run specific test:**
   ```bash
   npm test -- --testNamePattern="AuthService"
   ```

3. **Check test database:**
   ```bash
   # Make sure test database is separate
   DATABASE_URL="postgresql://postgres:password@localhost:5432/tiger_test"
   ```

### 8. OAuth Issues

#### Error: `OAuth strategy not found`

**Solutions:**
1. **Check OAuth credentials in .env:**
   ```env
   OAUTH_GOOGLE_CLIENT_ID="your-google-client-id"
   OAUTH_GOOGLE_CLIENT_SECRET="your-google-client-secret"
   OAUTH_FB_CLIENT_ID="your-facebook-client-id"
   OAUTH_FB_CLIENT_SECRET="your-facebook-client-secret"
   ```

2. **Verify OAuth app configuration:**
   - Google: https://console.developers.google.com/
   - Facebook: https://developers.facebook.com/

### 9. Storage Issues

#### Error: `S3 connection failed`

**Solutions:**
1. **Check MinIO is running:**
   ```bash
   docker-compose ps minio
   ```

2. **Access MinIO console:**
   - URL: http://localhost:9001
   - Username: minioadmin
   - Password: minioadmin

3. **Create bucket manually:**
   - Go to MinIO console
   - Create bucket named "tiger-uploads"

### 10. Performance Issues

#### Error: `Slow response times`

**Solutions:**
1. **Check database indexes:**
   ```bash
   npx prisma studio
   ```

2. **Monitor Docker resources:**
   ```bash
   docker stats
   ```

3. **Enable query logging:**
   ```env
   # Add to .env
   DEBUG="prisma:query"
   ```

## Quick Fixes

### Complete Reset
```bash
# Stop all services
docker-compose down

# Remove volumes (WARNING: This deletes all data)
docker-compose down -v

# Clean install
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps

# Start fresh
docker-compose up -d
npm run migration:generate
npm run db:seed
npm run start:dev
```

### Check System Status
```bash
# Check all services
docker-compose ps

# Check logs
docker-compose logs backend
docker-compose logs db

# Check database connection
npx prisma db pull

# Check API health
curl http://localhost:4000/api/docs
```

## Getting Help

1. **Check logs:**
   ```bash
   docker-compose logs -f backend
   ```

2. **Enable debug mode:**
   ```env
   NODE_ENV=development
   DEBUG=*
   ```

3. **Run with verbose output:**
   ```bash
   npm run start:dev -- --verbose
   ```

4. **Check API documentation:**
   - Visit: http://localhost:4000/api/docs
   - Test endpoints with Postman collection

## Still Having Issues?

1. Check the [GitHub Issues](https://github.com/your-repo/issues)
2. Review the [API Documentation](http://localhost:4000/api/docs)
3. Check the [Postman Collection](docs/postman-collection.json)
4. Verify all [Prerequisites](README.md#prerequisites) are installed
