# CORS và Cookie Requirements - Bắt buộc cho Cross-Origin Requests

## ⚠️ QUAN TRỌNG: Điều kiện bắt buộc phía BE

Khi FE gửi credentials (cookies) trong cross-origin requests, BE **PHẢI** config đúng, nếu không browser sẽ tự động drop cookies.

## 1. CORS Configuration

### ✅ Đúng (Current Implementation)

**File:** `src/main.ts`

```typescript
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';
app.enableCors({
  origin: corsOrigin, // Specific origin (REQUIRED when credentials = true)
  credentials: true, // REQUIRED: Must be true to allow cookies
  // ... other config
});
```

### ❌ SAI (Sẽ không hoạt động)

```typescript
// ❌ KHÔNG được dùng wildcard khi credentials = true
app.enableCors({
  origin: '*', // SAI - Browser sẽ reject
  credentials: true,
});

// ❌ KHÔNG được dùng origin: true khi credentials = true
app.enableCors({
  origin: true, // SAI - Tương đương wildcard
  credentials: true,
});

// ❌ KHÔNG được set credentials = false khi cần cookies
app.enableCors({
  origin: 'https://frontend.com',
  credentials: false, // SAI - Cookies sẽ không được gửi
});
```

### Quy tắc:

1. **`Access-Control-Allow-Credentials: true`** - Phải có trong response header
2. **`Access-Control-Allow-Origin: https://frontend.com`** - Phải là origin cụ thể, KHÔNG được dùng `*`
3. **Environment Variable:** `CORS_ORIGIN` - Set trong `.env`

## 2. Cookie Configuration

### ✅ Đúng (Current Implementation)

**File:** `src/common/middleware/anonymous-tracking.middleware.ts`

```typescript
res.cookie(this.ANONYMOUS_COOKIE_NAME, anonymousId, {
  httpOnly: true,
  sameSite: 'none', // Required for cross-origin requests
  secure: true, // REQUIRED when sameSite = 'none'
  maxAge: this.COOKIE_MAX_AGE,
  domain: isProd ? '.tiger-corporation-vietnam.vn' : 'localhost',
});
```

### ❌ SAI (Browser sẽ tự động drop cookie)

```typescript
// ❌ SAI: secure = false khi sameSite = 'none'
res.cookie('anonymous_id', value, {
  sameSite: 'none',
  secure: false, // Browser sẽ reject cookie này
});

// ❌ SAI: sameSite = 'strict' hoặc 'lax' cho cross-origin
res.cookie('anonymous_id', value, {
  sameSite: 'strict', // Cookie sẽ không được gửi trong cross-origin requests
  secure: true,
});
```

### Quy tắc:

1. **`sameSite: 'none'`** - Bắt buộc cho cross-origin requests
2. **`secure: true`** - Bắt buộc khi `sameSite = 'none'` (kể cả trong dev nếu dùng HTTPS)
3. **`httpOnly: true`** - Bảo mật, không cho JavaScript truy cập

## 3. Environment Variables

**File:** `.env` hoặc `env.example`

```bash
# CORS Origin - Must be specific origin, not wildcard
CORS_ORIGIN="http://localhost:3000"  # Development
# CORS_ORIGIN="https://frontend.com"  # Production
```

## 4. Browser Behavior

### Chrome / Safari sẽ tự động drop cookie nếu:

1. ❌ `sameSite: 'none'` nhưng `secure: false`
2. ❌ CORS `origin: '*'` nhưng `credentials: true`
3. ❌ CORS `credentials: false` nhưng FE gửi cookies

### Kết quả:

- Cookie không được set
- Cookie không được gửi trong subsequent requests
- FE không thể nhận cookies từ BE

## 5. Testing

### Kiểm tra CORS headers:

```bash
curl -H "Origin: http://localhost:3000" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     http://localhost:4000/api/endpoint \
     -v
```

**Expected response headers:**
```
Access-Control-Allow-Origin: http://localhost:3000
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: GET,POST,PUT,DELETE,PATCH,OPTIONS,HEAD
Access-Control-Allow-Headers: Origin,X-Requested-With,Content-Type,Accept,Authorization
```

### Kiểm tra Cookie:

1. Mở DevTools → Application → Cookies
2. Kiểm tra cookie có:
   - ✅ `Secure` flag
   - ✅ `SameSite=None`
   - ✅ `HttpOnly` flag

## 6. Common Issues

### Issue 1: Cookie không được set

**Nguyên nhân:**
- `secure: false` với `sameSite: 'none'`
- CORS `credentials: false`

**Giải pháp:**
- Set `secure: true` khi `sameSite: 'none'`
- Set CORS `credentials: true`

### Issue 2: Cookie không được gửi trong requests

**Nguyên nhân:**
- CORS `origin: '*'` với `credentials: true`
- Cookie domain không match

**Giải pháp:**
- Set CORS `origin` cụ thể từ env
- Kiểm tra cookie domain

### Issue 3: Preflight request fails

**Nguyên nhân:**
- Missing `OPTIONS` method trong CORS config
- Missing headers trong `allowedHeaders`

**Giải pháp:**
- Thêm `OPTIONS` vào `methods`
- Thêm tất cả headers cần thiết vào `allowedHeaders`

## 7. Production Checklist

- [ ] `CORS_ORIGIN` được set đúng production URL
- [ ] CORS `credentials: true`
- [ ] CORS `origin` là specific origin (không phải `*`)
- [ ] Cookie `sameSite: 'none'`
- [ ] Cookie `secure: true`
- [ ] Cookie `httpOnly: true`
- [ ] Test với production frontend URL
- [ ] Verify cookies được set và gửi trong requests

## 8. References

- [MDN: CORS with credentials](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS#requests_with_credentials)
- [MDN: SameSite cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie/SameSite)
- [Chrome: SameSite cookie changes](https://www.chromium.org/updates/same-site)

