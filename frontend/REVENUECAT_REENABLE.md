# RevenueCat Integration - Re-enable Instructions

## ⚠️ CRITICAL: Re-enable before production release!

RevenueCat is currently **DISABLED** to allow testing in Expo Go.
The native modules crash Expo Go, but work fine in production builds.

---

## Files Created (Keep these!)

1. **`/app/frontend/stores/revenueCatStore.ts`** - Main RevenueCat state management
2. **`/app/frontend/components/Paywall.tsx`** - Paywall UI components

---

## How to Re-enable RevenueCat

### Step 1: Update `_layout.tsx`

Uncomment these lines:

```typescript
// At the top:
import { useRevenueCatStore } from '../stores/revenueCatStore';

// In SessionProvider:
const { initialize: initRevenueCat, setUserId } = useRevenueCatStore();

// In restore() useEffect:
try {
  await initRevenueCat();
} catch (error) {
  console.log('[App] RevenueCat init skipped:', error);
}

// Add this useEffect:
useEffect(() => {
  if (user?.username) {
    try {
      setUserId(user.username);
    } catch (error) {
      console.log('[App] RevenueCat setUserId skipped:', error);
    }
  }
}, [user?.username]);
```

### Step 2: Update `store.tsx`

Uncomment these lines:

```typescript
// At the top:
import { useRevenueCatStore } from '../stores/revenueCatStore';
import { CustomPaywall, presentNativePaywall } from '../components/Paywall';

// In component:
const { isPro, isLoading: isRevenueCatLoading } = useRevenueCatStore();
// Remove: const isPro = false;

// Replace handleShowPaywall:
const handleShowPaywall = async () => {
  const result = await presentNativePaywall();
  if (!result) {
    setShowPaywall(true);
  }
};

// Re-enable the Paywall Modal in JSX
```

---

## How to Use RevenueCat in Your App

### Check Pro Status Anywhere

```typescript
import { useRevenueCatStore } from '../stores/revenueCatStore';

function MyComponent() {
  const { isPro } = useRevenueCatStore();
  
  if (isPro) {
    // Show pro features
  }
  return <Text>{isPro ? 'Pro User' : 'Free User'}</Text>;
}
```

### Show Paywall Programmatically

```typescript
import { presentNativePaywall } from '../components/Paywall';

async function handleUpgradePress() {
  const purchased = await presentNativePaywall();
  if (purchased) {
    Alert.alert('Success!', 'You are now a Pro user!');
  }
}
```

### Gate Features Behind Pro

```typescript
import { useRevenueCatStore } from '../stores/revenueCatStore';

function PremiumFeature() {
  const { isPro } = useRevenueCatStore();
  
  const handleFeaturePress = async () => {
    if (!isPro) {
      const purchased = await presentNativePaywall();
      if (!purchased) return; // User cancelled
    }
    // Execute premium feature
    doThePremiumThing();
  };
  
  return (
    <TouchableOpacity onPress={handleFeaturePress}>
      <Text>Use Premium Feature {!isPro && '🔒'}</Text>
    </TouchableOpacity>
  );
}
```

### Restore Purchases

```typescript
import { useRevenueCatStore } from '../stores/revenueCatStore';

function RestoreButton() {
  const { restorePurchases, isLoading } = useRevenueCatStore();
  
  const handleRestore = async () => {
    const restored = await restorePurchases();
    Alert.alert(restored ? 'Restored!' : 'No purchases found');
  };
  
  return (
    <Button 
      title="Restore Purchases" 
      onPress={handleRestore}
      disabled={isLoading}
    />
  );
}
```

---

## RevenueCat Dashboard Setup Required

Before testing, configure in RevenueCat Dashboard (https://app.revenuecat.com):

1. **Products** - Create these product IDs:
   - `monthly` - Monthly subscription
   - `yearly` - Yearly subscription
   - `lifetime` - One-time lifetime purchase

2. **Entitlements** - Create entitlement:
   - Identifier: `DivineHeros Pro`
   - Add all products to this entitlement

3. **Offerings** - Create offering with all packages

4. **Paywall** (optional) - Design a paywall in the dashboard for `presentNativePaywall()`

---

## API Key

```
test_IZyOoxmCinuIynJgzhXakqWWiyY
```

Already configured in `/app/frontend/stores/revenueCatStore.ts`

---

## Testing

RevenueCat requires a **development build** or **production build** to work.
It will NOT work in Expo Go.

To test:
```bash
# Create development build
eas build --profile development --platform android

# Or production build
eas build --platform android
```

---

## Files to Search for "REVENUECAT DISABLED"

Run this to find all places to re-enable:
```bash
grep -r "REVENUECAT DISABLED" /app/frontend
```
