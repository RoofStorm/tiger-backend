export const POINTS = {
  FIRST_LOGIN_BONUS: 200, // 200 points for first login (replaces daily login bonus on first login)
  DAILY_LOGIN_BONUS: 10,
  // REFERRAL_BONUS: 50, // Disabled - no points for referrals
  POST_CREATION: 100, // 100 points for first post per week
  WISH_CREATION: 100, // 100 points for first wish per week
  FACEBOOK_SHARE: 50, // 50 points for sharing post/wish/mood-card to Facebook (once lifetime)
  PRODUCT_CARD_CLICK: 10, // 10 points per product card click (max 8 times lifetime)
  // POST_LIKE: 5, // Disabled - no points for likes
  // POST_COMMENT: 3, // Disabled - no points for comments
} as const;

// export const REFERRAL_LIMITS = {
//   WEEKLY_POINTS_LIMIT: 2, // Maximum 2 referral bonuses per week
//   // MAX_REFERRALS_PER_WEEK: 10, // Removed - no limit on number of referrals
// } as const;

export const POST_LIMITS = {
  WEEKLY_POST_POINTS_LIMIT: 1, // Maximum 1 post bonus per week (resets every Monday)
  WEEKLY_POST_POINTS: 100, // Points for first post per week (100 points once per week)
} as const;

export const WISH_LIMITS = {
  WEEKLY_WISH_POINTS_LIMIT: 1, // Maximum 1 wish bonus per week (resets every Monday)
  WEEKLY_WISH_POINTS: 100, // Points for first wish per week (100 points once per week)
} as const;

export const SHARE_LIMITS = {
  LIFETIME_SHARE_POINTS_LIMIT: 1, // Maximum 1 Facebook share bonus per user (lifetime)
  LIFETIME_SHARE_POINTS: 50, // Points for sharing post/wish/mood-card to Facebook (50 points once lifetime)
} as const;

export const PRODUCT_CARD_LIMITS = {
  LIFETIME_CLICK_LIMIT: 8, // Maximum 8 product card clicks per user (lifetime)
  POINTS_PER_CLICK: 10, // Points per product card click
} as const;
