# Divine Heroes - Native Build Guide

## Prerequisites

1. **Install EAS CLI globally:**
   ```bash
   npm install -g eas-cli
   ```

2. **Login to Expo:**
   ```bash
   eas login
   ```

3. **Configure your project:**
   ```bash
   eas build:configure
   ```

## RevenueCat Setup

The app uses RevenueCat for in-app purchases. The API key is configured in:
- `eas.json` - For build-time configuration
- `app.config.js` - Dynamic configuration that adds the plugin only for native builds

### Current API Key
Test API Key: `test_GHJByEeqdUHXOWbuvIWFFrQFXjB`

**For production, replace with your live API key in:**
1. `eas.json` under `production.env.EXPO_PUBLIC_REVENUECAT_API_KEY`
2. RevenueCat dashboard with your products configured

## Building the App

### Development Build (for testing)

**Android APK:**
```bash
eas build --platform android --profile development
```

**iOS Simulator:**
```bash
eas build --platform ios --profile development
```

### Preview Build (internal testing)

**Android APK:**
```bash
eas build --platform android --profile preview
```

**iOS (requires Apple Developer account):**
```bash
eas build --platform ios --profile preview
```

### Production Build (for store submission)

**Android AAB:**
```bash
eas build --platform android --profile production
```

**iOS:**
```bash
eas build --platform ios --profile production
```

## Testing RevenueCat

1. Build the development APK:
   ```bash
   eas build --platform android --profile development
   ```

2. Download and install the APK on your Android device

3. Navigate to Battle Pass or any purchase screen

4. Test purchases using RevenueCat sandbox mode

### Sandbox Testing

**Android:**
- Add test accounts in Google Play Console
- Use test credit cards

**iOS:**
- Create sandbox accounts in App Store Connect
- Use sandbox environment for testing

## Environment Variables

The following environment variables are used:

| Variable | Description | Default |
|----------|-------------|----------|
| `EXPO_PUBLIC_BACKEND_URL` | Backend API URL | https://darkmode-overhaul.preview.emergentagent.com |
| `EXPO_PUBLIC_REVENUECAT_API_KEY` | RevenueCat API Key | test_GHJByEeqdUHXOWbuvIWFFrQFXjB |

## Architecture

```
app.config.js          - Dynamic config (adds RevenueCat for native builds)
app.json               - Base static config (web builds)
eas.json               - EAS build profiles
services/
  RevenueCatService.ts - RevenueCat integration (mocks on web)
```

## Troubleshooting

### Plugin Error on Web
The `react-native-purchases` plugin doesn't support web. The `app.config.js` dynamically adds the plugin only when `EAS_BUILD=true`.

### Missing Products
Ensure your RevenueCat products are configured:
1. Create products in App Store Connect / Google Play Console
2. Link them in RevenueCat dashboard
3. Use correct product IDs in `RevenueCatService.ts`

### Build Failures
1. Check EAS build logs: `eas build:list`
2. View detailed logs in Expo dashboard
3. Ensure all native dependencies are compatible

## Support

- [Expo Documentation](https://docs.expo.dev/)
- [RevenueCat Documentation](https://docs.revenuecat.com/)
- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
