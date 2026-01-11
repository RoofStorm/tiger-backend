# Logging Configuration

## Overview
Tất cả `console.log()` và `console.error()` đã được chuyển sang NestJS Logger.

## Configuration

### Development
```env
LOG_LEVEL=log,error,warn,debug,verbose
```

### Production
```env
LOG_LEVEL=error,warn,log
# hoặc chỉ errors
LOG_LEVEL=error
```

## Log Levels
- `this.logger.debug()` - Chi tiết debug (CHỈ trong development)
- `this.logger.log()` - Thông tin chung
- `this.logger.warn()` - Cảnh báo
- `this.logger.error()` - Lỗi (luôn hiển thị)

## Kiểm tra logs
```bash
# Development - sẽ thấy debug logs
npm run start:dev

# Production - chỉ thấy errors và important logs
NODE_ENV=production LOG_LEVEL=error npm run start:prod
```

## Lưu ý
- Tất cả services, controllers đã có Logger initialized
- Debug logs tự động tắt trong production
- Logs có context (tên class) và timestamp
