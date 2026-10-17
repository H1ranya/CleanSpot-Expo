import { useState, useCallback } from 'react';
import { locationService, LocationResult } from '../services';
import type { ReportLocation } from '../models';

export function useLocation() {
  const [isAcquiring, setIsAcquiring] = useState(false);
  const [result, setResult] = useState<LocationResult | null>(null);

  const acquireLocation = useCallback(async () => {
    setIsAcquiring(true);
    try {
      const res = await locationService.acquireLocationForReport();
      setResult(res);
      return res;
    } finally {
      setIsAcquiring(false);
    }
  }, []);

  const setManualLocation = useCallback(
    (coords: { latitude: number; longitude: number }) => {
      const manualLoc = locationService.createManualLocation(coords);
      const manualRes: LocationResult = {
        status: 'ACQUIRED_CURRENT',
        location: manualLoc,
        source: 'manual',
        message: 'Location selected manually.',
      };
      setResult(manualRes);
      return manualLoc;
    },
    []
  );

  const clearLocation = useCallback(() => {
    setResult(null);
  }, []);

  return {
    isAcquiring,
    result,
    location: result?.location ?? null,
    acquireLocation,
    setManualLocation,
    clearLocation,
  };
}
