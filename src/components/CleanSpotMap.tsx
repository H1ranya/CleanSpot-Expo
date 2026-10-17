import React, { useRef, useEffect, useImperativeHandle, forwardRef, useMemo } from 'react';
import { StyleSheet, View, StyleProp, ViewStyle, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import type { MapMarkerReport } from '../models';
import { LEAFLET_CSS, LEAFLET_JS } from './leafletBundle';
import { colors } from '../utils/theme';

export interface CleanSpotMapRef {
  centerOn: (latitude: number, longitude: number, zoom?: number) => void;
  fitAllMarkers: () => void;
}

export interface CleanSpotMapProps {
  markers?: MapMarkerReport[];
  selectedLocation?: { latitude: number; longitude: number } | null;
  mode?: 'view' | 'select';
  initialCenter?: { latitude: number; longitude: number; zoom?: number };
  onSelectLocation?: (coords: { latitude: number; longitude: number }) => void;
  onMarkerPress?: (marker: MapMarkerReport) => void;
  style?: StyleProp<ViewStyle>;
}

export function isValidCoordinate(latitude?: number | null, longitude?: number | null): boolean {
  if (latitude == null || longitude == null) return false;
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return false;
  if (isNaN(latitude) || isNaN(longitude)) return false;
  if (latitude < -90 || latitude > 90) return false;
  if (longitude < -180 || longitude > 180) return false;
  return true;
}

const CATEGORY_COLORS: Record<string, string> = {
  plastic: '#0284C7',
  glass: '#0D9488',
  paper: '#D97706',
  food_waste: '#16A34A',
  electronic_waste: '#7C3AED',
  construction_waste: '#EA580C',
  mixed_waste: '#475569',
  other: '#6B7280',
};

const SEVERITY_COLORS: Record<string, string> = {
  Low: '#16A34A',
  Medium: '#D97706',
  High: '#E11D48',
};

export const CleanSpotMap = forwardRef<CleanSpotMapRef, CleanSpotMapProps>(
  (
    {
      markers = [],
      selectedLocation,
      mode = 'view',
      initialCenter,
      onSelectLocation,
      onMarkerPress,
      style,
    },
    ref
  ) => {
    const webViewRef = useRef<WebView>(null);
    const markersMapRef = useRef<Map<string, MapMarkerReport>>(new Map());

    // Filter valid coordinates strictly (Requirement 9)
    const validMarkers = useMemo(() => {
      const filtered: MapMarkerReport[] = [];
      const map = new Map<string, MapMarkerReport>();

      for (const m of markers) {
        if (m && isValidCoordinate(m.latitude, m.longitude)) {
          filtered.push(m);
          map.set(m.id, m);
        }
      }
      markersMapRef.current = map;
      return filtered;
    }, [markers]);

    // Compute sensible initial coordinates
    const defaultCenter = useMemo(() => {
      if (initialCenter && isValidCoordinate(initialCenter.latitude, initialCenter.longitude)) {
        return {
          latitude: initialCenter.latitude,
          longitude: initialCenter.longitude,
          zoom: initialCenter.zoom ?? 14,
        };
      }
      if (selectedLocation && isValidCoordinate(selectedLocation.latitude, selectedLocation.longitude)) {
        return {
          latitude: selectedLocation.latitude,
          longitude: selectedLocation.longitude,
          zoom: 15,
        };
      }
      if (validMarkers.length > 0) {
        return {
          latitude: validMarkers[0].latitude,
          longitude: validMarkers[0].longitude,
          zoom: 14,
        };
      }
      // Safe global/city fallback coordinates (Bangalore default for this assignment)
      return {
        latitude: 12.9716,
        longitude: 77.5946,
        zoom: 13,
      };
    }, [initialCenter, selectedLocation, validMarkers]);

    useImperativeHandle(ref, () => ({
      centerOn: (latitude: number, longitude: number, zoom = 16) => {
        if (isValidCoordinate(latitude, longitude)) {
          webViewRef.current?.injectJavaScript(`
            if (window.centerOn) {
              window.centerOn(${latitude}, ${longitude}, ${zoom});
            }
            true;
          `);
        }
      },
      fitAllMarkers: () => {
        webViewRef.current?.injectJavaScript(`
          if (window.fitAllMarkers) {
            window.fitAllMarkers();
          }
          true;
        `);
      },
    }));

    // Update markers dynamically when data changes
    useEffect(() => {
      const markersPayload = JSON.stringify(validMarkers);
      webViewRef.current?.injectJavaScript(`
        if (window.updateMarkers) {
          window.updateMarkers(${markersPayload});
        }
        true;
      `);
    }, [validMarkers]);

    // Update selected location pin in 'select' mode
    useEffect(() => {
      if (mode === 'select' && selectedLocation && isValidCoordinate(selectedLocation.latitude, selectedLocation.longitude)) {
        webViewRef.current?.injectJavaScript(`
          if (window.setSelectedPin) {
            window.setSelectedPin(${selectedLocation.latitude}, ${selectedLocation.longitude});
          }
          true;
        `);
      }
    }, [mode, selectedLocation]);

    // Handle messages coming from Leaflet in WebView
    const handleMessage = (event: any) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        if (data.type === 'MARKER_PRESS' && onMarkerPress) {
          const marker = markersMapRef.current.get(data.id);
          if (marker) {
            onMarkerPress(marker);
          }
        } else if (data.type === 'LOCATION_SELECT' && onSelectLocation) {
          if (isValidCoordinate(data.latitude, data.longitude)) {
            onSelectLocation({
              latitude: Number(data.latitude),
              longitude: Number(data.longitude),
            });
          }
        }
      } catch (err) {
        console.warn('[CleanSpotMap] Failed to parse message from WebView:', err);
      }
    };

    // Construct the complete offline-first HTML page
    const htmlContent = useMemo(() => {
      const markersJson = JSON.stringify(validMarkers);
      const isSelectMode = mode === 'select';
      const initialSelectedJson = selectedLocation && isValidCoordinate(selectedLocation.latitude, selectedLocation.longitude)
        ? JSON.stringify(selectedLocation)
        : 'null';

      return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <style>
    ${LEAFLET_CSS}
    
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background-color: #f1f5f9;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    #map {
      width: 100%;
      height: 100%;
      background-color: #e2e8f0;
    }
    
    /* Modern Custom Marker Pin Styles */
    .cleanspot-pin {
      position: relative;
      width: 38px;
      height: 38px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: transform 0.15s ease-out;
    }
    .cleanspot-pin:active {
      transform: scale(1.15);
    }
    
    .pin-body {
      width: 32px;
      height: 32px;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 10px rgba(0,0,0,0.3);
      border: 2px solid #ffffff;
      position: absolute;
      top: 0;
      left: 3px;
    }
    
    .pin-inner-icon {
      transform: rotate(45deg);
      font-size: 13px;
      font-weight: 800;
      color: #ffffff;
      text-transform: uppercase;
      line-height: 1;
    }
    
    .pin-severity-dot {
      position: absolute;
      top: -3px;
      right: 0px;
      width: 11px;
      height: 11px;
      border-radius: 50%;
      border: 2px solid #ffffff;
      box-shadow: 0 1px 3px rgba(0,0,0,0.25);
    }
    
    .pin-own-badge {
      position: absolute;
      bottom: -4px;
      left: -2px;
      background: #0f172a;
      color: #38bdf8;
      font-size: 9px;
      font-weight: 900;
      padding: 1px 3px;
      border-radius: 4px;
      border: 1px solid #38bdf8;
      box-shadow: 0 1px 2px rgba(0,0,0,0.3);
    }
    
    /* Manual Selection Pin */
    .selection-pin {
      width: 44px;
      height: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
    }
    .selection-pulse {
      position: absolute;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: rgba(14, 165, 233, 0.25);
      animation: pulse-ring 1.8s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
    }
    .selection-dot {
      width: 18px;
      height: 18px;
      background: #0284c7;
      border: 3px solid #ffffff;
      border-radius: 50%;
      box-shadow: 0 2px 8px rgba(0,0,0,0.35);
      position: relative;
      z-index: 2;
    }
    @keyframes pulse-ring {
      0% { transform: scale(0.6); opacity: 0.9; }
      100% { transform: scale(1.4); opacity: 0; }
    }
  </style>
</head>
<body>
  <div id="map"></div>

  <script>
    ${LEAFLET_JS}

    var categoryColors = ${JSON.stringify(CATEGORY_COLORS)};
    var severityColors = ${JSON.stringify(SEVERITY_COLORS)};
    var isSelectMode = ${isSelectMode ? 'true' : 'false'};

    // 1. Initialize Leaflet Map
    var map = L.map('map', {
      zoomControl: false,
      attributionControl: false
    }).setView([${defaultCenter.latitude}, ${defaultCenter.longitude}], ${defaultCenter.zoom});

    L.control.zoom({ position: 'topright' }).addTo(map);

    // 2. OpenStreetMap Free Tile Layer (Works with graceful failure when offline)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      crossOrigin: true
    }).addTo(map);

    // 3. Markers Layer Group
    var markersLayer = L.layerGroup().addTo(map);
    var selectedPinMarker = null;

    function sendToRN(payload) {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify(payload));
      }
    }

    function createPinIcon(markerData) {
      var catColor = categoryColors[markerData.category] || '#64748b';
      var sevColor = severityColors[markerData.severity] || '#d97706';
      var isOwnBadge = markerData.isOwn ? '<div class="pin-own-badge">YOU</div>' : '';
      
      var initial = (markerData.category || 'W').charAt(0).toUpperCase();

      var html = '<div class="cleanspot-pin">' +
        '<div class="pin-body" style="background-color: ' + catColor + ';">' +
          '<span class="pin-inner-icon">' + initial + '</span>' +
        '</div>' +
        '<div class="pin-severity-dot" style="background-color: ' + sevColor + ';"></div>' +
        isOwnBadge +
      '</div>';

      return L.divIcon({
        className: '',
        html: html,
        iconSize: [38, 38],
        iconAnchor: [19, 36],
      });
    }

    function createSelectionIcon() {
      var html = '<div class="selection-pin">' +
        '<div class="selection-pulse"></div>' +
        '<div class="selection-dot"></div>' +
      '</div>';

      return L.divIcon({
        className: '',
        html: html,
        iconSize: [44, 44],
        iconAnchor: [22, 22],
      });
    }

    window.updateMarkers = function(markers) {
      markersLayer.clearLayers();
      if (!markers || !markers.length) return;

      var bounds = [];
      markers.forEach(function(m) {
        if (typeof m.latitude !== 'number' || typeof m.longitude !== 'number') return;
        var icon = createPinIcon(m);
        var leafletMarker = L.marker([m.latitude, m.longitude], { icon: icon });

        leafletMarker.on('click', function() {
          sendToRN({ type: 'MARKER_PRESS', id: m.id });
        });

        markersLayer.addLayer(leafletMarker);
        bounds.push([m.latitude, m.longitude]);
      });
    };

    window.setSelectedPin = function(lat, lng) {
      if (selectedPinMarker) {
        selectedPinMarker.setLatLng([lat, lng]);
      } else {
        selectedPinMarker = L.marker([lat, lng], {
          icon: createSelectionIcon(),
          zIndexOffset: 1000
        }).addTo(map);
      }
      map.panTo([lat, lng]);
    };

    window.centerOn = function(lat, lng, zoom) {
      map.setView([lat, lng], zoom || 15);
    };

    window.fitAllMarkers = function() {
      var layers = markersLayer.getLayers();
      if (layers.length === 0) return;
      var group = L.featureGroup(layers);
      map.fitBounds(group.getBounds().pad(0.15));
    };

    // Handle map tap in selection mode
    if (isSelectMode) {
      map.on('click', function(e) {
        var lat = e.latlng.lat;
        var lng = e.latlng.lng;
        window.setSelectedPin(lat, lng);
        sendToRN({
          type: 'LOCATION_SELECT',
          latitude: lat,
          longitude: lng
        });
      });

      var initialSelected = ${initialSelectedJson};
      if (initialSelected && typeof initialSelected.latitude === 'number') {
        window.setSelectedPin(initialSelected.latitude, initialSelected.longitude);
      }
    }

    // Initial render of markers
    var initialMarkers = ${markersJson};
    window.updateMarkers(initialMarkers);
  </script>
</body>
</html>
      `;
    }, [validMarkers, mode, selectedLocation, defaultCenter]);

    return (
      <View style={[styles.container, style]}>
        <WebView
          ref={webViewRef}
          originWhitelist={['*']}
          source={{ html: htmlContent }}
          style={styles.webView}
          onMessage={handleMessage}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          renderLoading={() => (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.forest700} />
            </View>
          )}
        />
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: colors.slate100,
  },
  webView: {
    flex: 1,
    backgroundColor: colors.slate100,
  },
  loadingContainer: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.slate100,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
});
