export interface ReportLocation {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  altitude?: number | null;
  timestamp?: number;
  isManualPin?: boolean;
}

export function formatCoordinates(latitude: number, longitude: number): string {
  const latFormatted = `${Math.abs(latitude).toFixed(4)}°${latitude >= 0 ? 'N' : 'S'}`;
  const lngFormatted = `${Math.abs(longitude).toFixed(4)}°${longitude >= 0 ? 'E' : 'W'}`;
  return `${latFormatted}, ${lngFormatted}`;
}
