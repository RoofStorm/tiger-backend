# Flow Check và Tạo Non-ID (Anonymous ID) trong Redis

## Tổng quan

Hệ thống sử dụng middleware `AnonymousTrackingMiddleware` để tự động track và tạo anonymous ID cho các user chưa đăng nhập. Anonymous ID được lưu trong cookie và Redis để tracking và analytics.

## Flow Diagram

```
Request → Cookie Parser → AnonymousTrackingMiddleware → NextAuthMiddleware → Controller
           ↓
    [Check Cookie]
           ↓
    [Cookie exists?]
    ├─ NO → Generate UUID → Set Cookie → Check Redis → Create Redis Key
    └─ YES → Get anonymousId → Check Redis → Refresh TTL or Create Key
```

## Chi tiết Flow

### 1. Request đến Server

Mỗi request đến server sẽ đi qua middleware chain:
- `cookieParser()` (trong `main.ts`)
- `AnonymousTrackingMiddleware` (được apply cho tất cả routes `*`)
- `NextAuthMiddleware` (được apply sau anonymous tracking)

### 2. AnonymousTrackingMiddleware Logic

**File:** `src/common/middleware/anonymous-tracking.middleware.ts`

#### Bước 1: Kiểm tra User đã Authenticated

```typescript
const user = (req as any).user;
if (user?.id) {
  return next(); // Skip nếu user đã login
}
```

- Nếu user đã authenticated (có `req.user.id`), middleware sẽ skip và không track anonymous.

#### Bước 2: Lấy hoặc Tạo Anonymous ID từ Cookie

```typescript
let anonymousId = req.cookies?.[this.ANONYMOUS_COOKIE_NAME]; // 'anonymous_id'
```

**Nếu không có cookie:**
- Generate UUID mới: `anonymousId = uuidv4()`
- Set cookie với các thông tin:
  - `httpOnly: true` - Bảo mật, không thể truy cập từ JavaScript
  - `sameSite: 'none'` - Cho phép cross-site requests
  - `maxAge: 180 days` - Cookie tồn tại 6 tháng
  - `domain`: 
    - Production: `.tiger-corporation-vietnam.vn`
    - Development: `localhost`
  - `secure: true` (production only) - Chỉ gửi qua HTTPS

**Nếu có cookie:**
- Sử dụng `anonymousId` từ cookie

#### Bước 3: Check và Tạo Key trong Redis

**Redis Key Pattern:** `anon:{anonymousId}`

```typescript
const redisKey = `${this.REDIS_KEY_PREFIX}${anonymousId}`; // 'anon:uuid-here'
const exists = await this.redisService.exists(redisKey);
```

**Nếu key chưa tồn tại (lần đầu tiên trong 30 phút):**

1. **Set key với TTL 30 phút:**
   ```typescript
   await this.redisService.set(redisKey, timestamp, this.REDIS_TTL); // TTL = 30 phút
   ```

2. **Increment counter unique anonymous users:**
   ```typescript
   await this.redisService.increment('unique_anonymous_users');
   ```

3. **Thêm vào sorted set để query theo thời gian:**
   ```typescript
   await redis.zadd('anonymous_users_timestamps', Date.now(), anonymousId);
   ```
   - Score = timestamp (milliseconds)
   - Member = anonymousId
   - Dùng để query anonymous users trong khoảng thời gian

**Nếu key đã tồn tại:**
- Refresh TTL để giữ user active:
  ```typescript
  await this.redisService.set(redisKey, timestamp, this.REDIS_TTL);
  ```

#### Bước 4: Attach Anonymous ID vào Request

```typescript
(req as any).anonymousId = anonymousId;
```

- Anonymous ID được attach vào request để các controller/service khác có thể sử dụng (ví dụ: analytics)

### 3. Redis Data Structure

#### Keys được tạo:

1. **`anon:{anonymousId}`**
   - Type: String
   - Value: Timestamp (milliseconds)
   - TTL: 30 phút
   - Mục đích: Track anonymous user đang active

2. **`unique_anonymous_users`**
   - Type: Counter (String)
   - Value: Số lượng unique anonymous users
   - TTL: Không có (persistent)
   - Mục đích: Đếm tổng số anonymous users

3. **`anonymous_users_timestamps`**
   - Type: Sorted Set
   - Score: Timestamp (milliseconds)
   - Member: anonymousId
   - TTL: Không có (persistent)
   - Mục đích: Query anonymous users theo thời gian

### 4. Error Handling

```typescript
catch (error) {
  // Don't block request if Redis fails
  this.logger.error('Error in anonymous tracking middleware:', error);
  next(); // Vẫn tiếp tục request
}
```

- Nếu Redis fail, middleware sẽ log error nhưng không block request
- Request vẫn tiếp tục được xử lý

## Conversion Flow (Khi User Login)

**File:** `src/common/services/anonymous-conversion.service.ts`

Khi user login, hệ thống sẽ track conversion từ anonymous → logged-in user:

### Track Conversion

```typescript
await trackConversion(anonymousId, userId);
```

**Redis Keys được tạo:**

1. **`anon_convert:{anonymousId}`**
   - Type: String
   - Value: userId
   - TTL: 90 ngày
   - Mục đích: Map anonymousId → userId

2. **`anonymous_to_user_conversions`**
   - Type: Sorted Set
   - Score: Timestamp
   - Member: `{anonymousId}:{userId}`
   - TTL: Không có (persistent)
   - Mục đích: Query conversions theo thời gian

3. **`user_anon:{userId}`**
   - Type: String
   - Value: anonymousId
   - TTL: 90 ngày
   - Mục đích: Reverse mapping (userId → anonymousId)

## Constants

### AnonymousTrackingMiddleware

```typescript
ANONYMOUS_COOKIE_NAME = 'anonymous_id'
COOKIE_MAX_AGE = 1000 * 60 * 60 * 24 * 180  // 180 days
REDIS_TTL = 60 * 30  // 30 minutes
REDIS_KEY_PREFIX = 'anon:'
COUNTER_KEY = 'unique_anonymous_users'
```

### AnonymousConversionService

```typescript
CONVERSION_KEY_PREFIX = 'anon_convert:'
CONVERSION_SET_KEY = 'anonymous_to_user_conversions'
CONVERSION_TTL = 60 * 60 * 24 * 90  // 90 days
```

## Use Cases

### 1. Analytics Tracking
- Anonymous ID được attach vào request để track analytics events
- File: `src/modules/analytics/analytics.service.ts`

### 2. Unique User Counting
- Đếm số lượng unique anonymous users từ counter `unique_anonymous_users`

### 3. Time-based Queries
- Query anonymous users trong khoảng thời gian từ sorted set `anonymous_users_timestamps`

### 4. Conversion Tracking
- Track khi anonymous user convert thành logged-in user
- Link analytics data từ anonymous → logged-in user

## Best Practices

1. **TTL Management:**
   - Anonymous tracking key có TTL 30 phút để tự động cleanup
   - Conversion keys có TTL 90 ngày để giữ lịch sử

2. **Error Handling:**
   - Middleware không block request nếu Redis fail
   - Log errors để debug

3. **Performance:**
   - Sử dụng Redis EXISTS để check nhanh
   - Sử dụng sorted set để query theo thời gian hiệu quả

4. **Security:**
   - Cookie httpOnly để tránh XSS
   - Secure flag trong production
   - SameSite none để support cross-site

## Testing

Để test flow:

1. **Test tạo mới anonymous ID:**
   - Clear cookies
   - Gửi request → Check cookie `anonymous_id` được tạo
   - Check Redis key `anon:{anonymousId}` tồn tại

2. **Test reuse anonymous ID:**
   - Gửi request với cookie `anonymous_id`
   - Check Redis key được refresh TTL

3. **Test conversion:**
   - Login với user đã có anonymous_id
   - Check Redis keys conversion được tạo

## Data Persistence - Dữ liệu được lưu ở đâu?

### ⚠️ QUAN TRỌNG: Dữ liệu không bị mất khi cleanup Redis

**Dữ liệu anonymous tracking được lưu vào 2 nơi:**

#### 1. Database (Nguồn dữ liệu chính) ✅

**Bảng:** `analytics_events`

Tất cả analytics events (bao gồm anonymous) được lưu vào database với:
- `isAnonymous: true` - Đánh dấu là anonymous user
- `sessionId` - Track anonymous sessions
- `userId: null` - Không có user ID
- Tất cả thông tin khác: `page`, `zone`, `component`, `action`, `value`, `metadata`, `createdAt`

**Flow lưu vào database:**
```
Anonymous Event → Analytics Queue → Analytics Worker → Database (analytics_events)
```

**File:** `src/modules/analytics/analytics-worker.service.ts`

```typescript
// Bulk insert events to database
await this.prisma.analyticsEvent.createMany({
  data: events.map((event) => ({
    userId: event.userId, // null cho anonymous
    sessionId: event.sessionId,
    isAnonymous: event.isAnonymous, // true cho anonymous
    page: event.page,
    zone: event.zone,
    component: event.component,
    action: event.action,
    value: event.value,
    metadata: event.metadata,
  })),
});
```

**Analytics queries luôn từ database:**
- `getSummary()` - Query từ `analytics_events` table
- `getAnalysis()` - Query từ `analytics_events` table
- Tất cả metrics đều tính từ database, KHÔNG phụ thuộc vào Redis

#### 2. Redis (Cache/Index - Optional) ⚡

**Sorted Set:** `anonymous_users_timestamps`

- Chỉ dùng để **query nhanh** unique anonymous users theo thời gian
- **KHÔNG phải nguồn dữ liệu chính**
- **KHÔNG được sử dụng** trong analytics queries hiện tại
- Chỉ là cache/index để có thể query nhanh nếu cần (chưa implement)

**Kết luận:**
- ✅ **Dữ liệu đã được lưu vào database** - Không bị mất khi cleanup Redis
- ✅ **Analytics luôn query từ database** - Không phụ thuộc vào Redis sorted set
- ✅ **Cleanup Redis chỉ tiết kiệm bộ nhớ** - Không ảnh hưởng đến analytics
- ✅ **Có thể analytics lại bất cứ lúc nào** - Dữ liệu vẫn còn trong database

## Cleanup và Maintenance

### Automatic Cleanup

Hệ thống tự động cleanup sorted sets trong Redis để quản lý bộ nhớ (KHÔNG ảnh hưởng đến dữ liệu trong database):

**File:** `src/common/services/anonymous-tracking-cleanup.service.ts`

#### 1. Cleanup Anonymous User Timestamps

- **Cron Schedule:** `0 3 * * *` (Mỗi ngày lúc 3:00 AM)
- **Retention:** 30 ngày gần nhất
- **Action:** Xóa các entries cũ hơn 30 ngày từ sorted set `anonymous_users_timestamps`
- **Command:** `ZREMRANGEBYSCORE anonymous_users_timestamps 0 (now - 30days)`

```typescript
@Cron('0 3 * * *')
async cleanupAnonymousTimestamps() {
  const cutoffTime = Date.now() - 30 * 24 * 60 * 60 * 1000;
  await redisService.removeFromSortedSetByScore(
    'anonymous_users_timestamps',
    0,
    cutoffTime - 1,
  );
}
```

#### 2. Cleanup Conversion Timestamps

- **Cron Schedule:** `0 3 * * *` (Mỗi ngày lúc 3:00 AM)
- **Retention:** 90 ngày gần nhất (phù hợp với CONVERSION_TTL)
- **Action:** Xóa các entries cũ hơn 90 ngày từ sorted set `anonymous_to_user_conversions`

#### 3. Manual Cleanup

Service cung cấp method `cleanupManually()` để có thể gọi từ admin API nếu cần:

```typescript
await cleanupService.cleanupManually(retentionDays);
```

### Redis Service Method

**File:** `src/common/redis/redis.service.ts`

Method mới được thêm để hỗ trợ cleanup:

```typescript
async removeFromSortedSetByScore(
  key: string,
  minScore: number,
  maxScore: number,
): Promise<number>
```

- Xóa members từ sorted set trong khoảng score
- Trả về số lượng members đã xóa
- Sử dụng Redis command: `ZREMRANGEBYSCORE`

### Lý do Cleanup

1. **Quản lý bộ nhớ Redis:**
   - Sorted sets có thể phát triển lớn theo thời gian
   - Chỉ cần giữ dữ liệu gần đây cho quick queries (nếu cần)
   - **Dữ liệu thực sự vẫn còn trong database** - Không bị mất

2. **Performance:**
   - Sorted sets nhỏ hơn = query nhanh hơn (nếu dùng)
   - Giảm memory usage trong Redis
   - **Analytics vẫn query từ database** - Không bị ảnh hưởng

3. **Data Retention Policy:**
   - 30 ngày cho anonymous timestamps trong Redis (cache)
   - 90 ngày cho conversion timestamps trong Redis (cache)
   - **Database giữ dữ liệu lâu hơn** (90 ngày theo analytics cleanup)
   - Có thể query lại từ database bất cứ lúc nào

### Cron Schedule Strategy

- **2:00 AM:** Analytics cleanup (DISABLED - Short-term project, không cần cleanup database)
- **3:00 AM:** Anonymous tracking cleanup (xóa old timestamps từ Redis - sau 30 ngày)
- Tránh conflict và tải cao bằng cách chạy vào giờ thấp điểm

**Lưu ý:**
- **Database cleanup đã được DISABLED** vì đây là dự án short-term (3-4 tháng)
- Redis cleanup (3 AM) vẫn chạy để quản lý bộ nhớ Redis (chỉ xóa cache/index)
- **Tất cả dữ liệu analytics được giữ lại trong database** - Không bị xóa
- Có thể analytics lại từ database bất cứ lúc nào trong suốt thời gian dự án

## Monitoring

- Log level DEBUG: Log khi tạo mới anonymous ID
- Log level ERROR: Log khi Redis fail
- Log level LOG: Log khi cleanup chạy và số lượng records đã xóa
- Monitor Redis keys:
  - `unique_anonymous_users` - Tổng số unique users
  - `anonymous_users_timestamps` - Số lượng trong sorted set (sau cleanup)
  - `anonymous_to_user_conversions` - Số lượng conversions (sau cleanup)

