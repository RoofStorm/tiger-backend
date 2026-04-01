/**
 * Admin kill-switch: when `isDisabledByAdmin` is `true`, local registration is blocked.
 * Set to `false` and rebuild to allow it again.
 *
 * `disabledRedeemRewardIds`: reward IDs that cannot be redeemed (edit list and rebuild).
 */
export const adminFeatures = {
  isDisabledByAdmin: true,
  disabledRedeemRewardIds: ['voucher-100k', 'voucher-50k'],
};
