import { useState, useEffect } from 'react';
import { networkService, NetworkState } from '../services/NetworkService';

export interface UseNetworkResult extends NetworkState {
  isOffline: boolean;
}

/**
 * Custom React hook providing reactive network connectivity state.
 * Automatically subscribes on mount and unsubscribes on unmount.
 */
export function useNetwork(): UseNetworkResult {
  const [state, setState] = useState<NetworkState>(() =>
    networkService.getNetworkState()
  );

  useEffect(() => {
    // Subscribe to connectivity changes
    const unsubscribe = networkService.subscribe((_isOnline, newState) => {
      setState(newState);
    });

    return () => {
      // Clean up the listener correctly
      unsubscribe();
    };
  }, []);

  return {
    ...state,
    isOffline: !state.isOnline,
  };
}
