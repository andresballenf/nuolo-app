# Monetization System Migration Guide

## Overview

This document explains the changes made to simplify Nuolo's monetization system and how to handle legacy subscriptions.

---

## What Changed

### ✅ **Removed Products (No Longer Available for Purchase)**

The following subscription types are **NO LONGER AVAILABLE** for new purchases:
- `premium_monthly` - Monthly premium subscription
- `premium_yearly` - Yearly premium subscription
- `lifetime` - One-time lifetime purchase

### ✅ **Current Products (Available for Purchase)**

**Subscription:**
- `unlimited_monthly` - Unlimited audio guides, $29.99/month

**Attraction Packages:**
- `basic_package` - 5 audio guides, $3.99
- `standard_package` - 20 audio guides, $9.99
- `premium_package` - 50 audio guides, $19.99

---

## Legacy Subscription Handling

### **Grandfathering Strategy**

Existing subscribers to `premium_monthly`, `premium_yearly`, or `lifetime` subscriptions are **grandfathered in**:

✅ **They retain full unlimited access**
✅ **Auto-renewal continues unchanged**
✅ **No action required from users**

### **Technical Implementation**

All access control logic checks for BOTH current and legacy subscription types:

```typescript
// Example from MonetizationContext.tsx
const hasUnlimitedAccess = subscription.isActive && subscription.type === 'unlimited_monthly';
const hasLegacySubscription = subscription.isActive &&
  ['premium_monthly', 'premium_yearly', 'lifetime'].includes(subscription.type || '');

if (hasUnlimitedAccess || hasLegacySubscription) {
  // Grant unlimited access
}
```

---

## Code Changes Summary

### **Modified Files**

#### 1. `services/MonetizationService.ts`
- Removed `PREMIUM_MONTHLY`, `PREMIUM_YEARLY`, `LIFETIME` product ID constants
- Kept only `UNLIMITED_MONTHLY` for new purchases
- Maintained legacy type handling in `mapProductToSubscriptionType()` for receipt validation
- Simplified `getProductIdForSubscriptionType()` to return only `UNLIMITED_MONTHLY`

#### 2. `contexts/MonetizationContext.tsx`
- Simplified `purchaseSubscription()` method - no type parameter needed
- Updated access control to check for both current and legacy subscriptions
- Maintained backward compatibility for existing subscribers

#### 3. `components/ui/SubscriptionBadge.tsx`
- Updated to display ∞ icon for both `unlimited_monthly` and legacy subscriptions
- Added comments distinguishing current vs legacy subscriptions

#### 4. `components/ui/PaywallModal.tsx`
- Updated `purchaseSubscription()` call to not pass subscription type
- Now only shows unlimited monthly option (legacy types not purchasable)

#### 5. `app/_layout.tsx`
- **Removed** `PurchaseContext` import and provider
- Now uses only `MonetizationContext` (single source of truth)

### **Removed Files**

#### `contexts/PurchaseContext.tsx`
- **Status**: Deprecated, no longer used
- **Replacement**: `MonetizationContext` handles all purchases
- **Action**: File can be deleted in future cleanup

---

## Database Considerations

### **Existing Subscriptions**

The `user_subscriptions` table still contains rows with:
- `subscription_type = 'premium_monthly'`
- `subscription_type = 'premium_yearly'`
- `subscription_type = 'lifetime'`

**These are valid and should NOT be modified.**

### **New Subscriptions**

All new subscription purchases will create rows with:
- `subscription_type = 'unlimited_monthly'`

### **Migration Query (Optional)**

If you want to migrate legacy subscriptions to the new type (NOT RECOMMENDED):

```sql
-- DO NOT RUN - Kept for reference only
UPDATE user_subscriptions
SET subscription_type = 'unlimited_monthly'
WHERE subscription_type IN ('premium_monthly', 'premium_yearly', 'lifetime')
AND is_active = true;
```

**⚠️ Recommendation**: Keep legacy types as-is for accurate analytics and subscription tracking.

---

## App Store Configuration

### **Apple App Store Connect**

**DO NOT DELETE** legacy products from App Store Connect:
1. Navigate to your app → Features → In-App Purchases
2. Find `nuolo_premium_monthly`, `nuolo_premium_yearly`, `nuolo_lifetime`
3. Set status to **"Not Available"** (do not delete)
4. Keep for receipt validation of existing subscribers

**Why?**
- Deleting products breaks receipt validation
- Existing subscribers need products to exist for auto-renewal
- Apple requires products to remain for historical purchases

### **Google Play Console**

**DO NOT DELETE** legacy subscriptions from Google Play Console:
1. Navigate to Monetize → Products → Subscriptions
2. Find legacy products
3. Set to **"Inactive"** (do not delete)
4. Keep for existing subscribers

---

## Testing Checklist

### **New Users (Post-Migration)**

- [ ] Can see only `unlimited_monthly` subscription option in paywall
- [ ] Can purchase unlimited monthly subscription successfully
- [ ] Can purchase attraction packages successfully
- [ ] Cannot purchase legacy subscription types

### **Existing Subscribers (Legacy)**

- [ ] `premium_monthly` subscribers have unlimited access
- [ ] `premium_yearly` subscribers have unlimited access
- [ ] `lifetime` subscribers have unlimited access
- [ ] Auto-renewal continues working for legacy subscriptions
- [ ] Receipt validation succeeds for legacy purchases

### **Restore Purchases**

- [ ] Restoring legacy subscription grants unlimited access
- [ ] Restoring current subscription grants unlimited access
- [ ] Restoring packages grants correct attraction count

---

## Analytics Impact

### **Metrics to Monitor**

1. **Conversion Rate**: Track if simplified offering improves conversion
2. **ARPU**: Compare before/after removing legacy tiers
3. **Legacy Subscriber Churn**: Monitor if grandfathered users cancel more/less
4. **Package vs Subscription Mix**: Track purchase distribution

### **Recommended Tracking Events**

```typescript
// Track subscription type distribution
analytics.track('subscription_active', {
  subscription_type: subscription.type, // unlimited_monthly vs legacy
  is_legacy: ['premium_monthly', 'premium_yearly', 'lifetime'].includes(subscription.type)
});

// Track paywall conversions
analytics.track('paywall_conversion', {
  selected_option: 'unlimited_monthly', // Only option now
  trigger: 'free_limit' | 'premium_attraction'
});
```

---

## Rollback Plan

If you need to re-enable legacy subscription types:

### **Quick Rollback Steps**

1. **Revert Product IDs**: Restore `PREMIUM_MONTHLY`, `PREMIUM_YEARLY`, `LIFETIME` constants
2. **Revert MonetizationService**: Add back legacy type handling in `getProductIdForSubscriptionType()`
3. **Revert MonetizationContext**: Add back type parameter to `purchaseSubscription()`
4. **Revert PaywallModal**: Add back UI options for legacy subscriptions
5. **Re-enable in stores**: Set legacy products to "Available" in App Store Connect and Google Play

**Estimated rollback time**: 30 minutes

---

## Future Enhancements

### **Phase 2 Recommendations**

1. **Centralized Product Config**: ✅ Created `config/products.ts`
2. **Analytics Service**: Add comprehensive purchase tracking
3. **Error Handling**: Improve user-facing error messages
4. **Retry Logic**: Add automatic retry for failed purchases
5. **A/B Testing**: Test different price points for unlimited monthly
6. **Promotional Offers**: Add limited-time discounts
7. **Referral Program**: Reward users for referring friends

---

## Support Documentation

### **Customer Support FAQs**

**Q: I had a yearly subscription - what happens now?**
A: Your yearly subscription remains active! You'll continue enjoying unlimited access at your current price until expiration.

**Q: Can I still purchase a yearly subscription?**
A: We've simplified our offerings to just unlimited monthly. However, your existing yearly subscription will continue as normal.

**Q: Why can't I see the lifetime option anymore?**
A: We're focusing on our unlimited monthly subscription. If you purchased lifetime access previously, you still have it!

---

## Contact

For questions about this migration:
- Technical: Check code comments in `services/MonetizationService.ts`
- Product: Review this document
- Support: Update customer-facing documentation accordingly

---

**Last Updated**: January 2025
**Migration Status**: ✅ Complete
