import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.fsa.rekapkeuangan',
  appName: 'KasPro',
  webDir: 'dist',
  bundledWebRuntime: true,
  server: {
    androidScheme: 'https',
  },
};

export default config;