import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNavigator } from './src/navigation';
import { useAuth } from './src/hooks';
import { networkService, syncService } from './src/services';
import { testLocalDatabase } from './src/data/local';
import { testSyncService } from './src/services';

function MainApp() {
  // Ensures an authenticated anonymous Firebase user session exists upon application startup
  useAuth();

  useEffect(() => {
    // 1. App Startup: Check connectivity and trigger synchronization if online
    (async () => {
      const isOnline = await networkService.checkConnectivity();
      if (isOnline) {
        console.log('[App] Application startup: device online. Initiating sync...');
        await syncService.syncPendingReports({ downloadShared: true });
      } else {
        console.log('[App] Application startup: device offline. Running in local SQLite mode.');
      }
    })();

    if (__DEV__ && process.env.EXPO_PUBLIC_RUN_SELF_TESTS === 'true') {
      (async () => {
        await testLocalDatabase();
        await testSyncService();
      })();
    }
  }, []);

  return <RootNavigator />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <MainApp />
    </SafeAreaProvider>
  );
}
