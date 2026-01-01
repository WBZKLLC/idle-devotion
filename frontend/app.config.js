// Dynamic Expo configuration for native builds
module.exports = ({ config }) => {
  const baseConfig = {
    ...config,
    name: 'Divine Heroes',
    slug: 'divine-heroes-gacha',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'divineheroes',
    userInterfaceStyle: 'dark',
    newArchEnabled: true,
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.divineheroes.gacha',
      buildNumber: '1',
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/images/adaptive-icon.png',
        backgroundColor: '#0a1628',
      },
      edgeToEdgeEnabled: true,
      package: 'com.divineheroes.gacha',
      versionCode: 1,
    },
    web: {
      bundler: 'metro',
      output: 'static',
      favicon: './assets/images/favicon.png',
    },
    plugins: [
      'expo-router',
      [
        'expo-splash-screen',
        {
          image: './assets/images/splash-icon.png',
          imageWidth: 200,
          resizeMode: 'contain',
          backgroundColor: '#0a1628',
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      eas: {
        projectId: '59fe8d53-8818-4d41-a206-556a8f621bbd',
      },
      BACKEND_URL: process.env.EXPO_PUBLIC_BACKEND_URL || 'https://mobile-rpg-4.preview.emergentagent.com',
      REVENUECAT_API_KEY: process.env.EXPO_PUBLIC_REVENUECAT_API_KEY || '',
    },
  };

  return baseConfig;
};
