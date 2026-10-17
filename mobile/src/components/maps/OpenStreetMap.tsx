import { useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { ActivityIndicator, Button, Linking, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { mapDocument } from './mapDocument';
import { MapControls } from './MapControls';

/** Keyless OSM-based map, isolated so screens need no WebView logic. */
export function OpenStreetMap() {
  const webView = useRef<WebView<object>>(null);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<{ message: string; settings?: boolean } | null>(null);

  async function centerOnUser() {
    if (locating || status !== 'ready') return;
    setLocating(true);
    setLocationError(null);
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setLocationError({ message: 'Allow location access to center the map on you.', settings: !permission.canAskAgain });
        return;
      }
      if (!await Location.hasServicesEnabledAsync()) {
        setLocationError({ message: 'Turn on your device’s location services, then try again.' });
        return;
      }
      const position = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => reject(new Error('Location timed out')), 15000);
        }),
      ]);
      const { latitude, longitude, accuracy } = position.coords;
      webView.current?.injectJavaScript(`window.centerOnLocation(${JSON.stringify(latitude)}, ${JSON.stringify(longitude)}, ${JSON.stringify(accuracy ?? 0)}); true;`);
    } catch {
      setLocationError({ message: 'Couldn’t get your location. Try again in a moment.' });
    } finally {
      clearTimeout(timeout);
      setLocating(false);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(() => {
      setStatus((current) => current === 'loading' ? 'error' : current);
    }, 20000);
    return () => clearTimeout(timeout);
  }, [attempt]);

  function retry() {
    setStatus('loading');
    setAttempt((value) => value + 1);
  }

  return (
    <View style={styles.container}>
      <WebView<object>
        ref={webView}
        key={attempt}
        source={{ html: mapDocument }}
        style={styles.map}
        accessibilityLabel="Interactive OpenStreetMap of Southampton"
        applicationNameForUserAgent="SotonShip/1.0"
        cacheEnabled
        javaScriptEnabled
        domStorageEnabled
        mixedContentMode="never"
        originWhitelist={['*']}
        scrollEnabled={false}
        setSupportMultipleWindows={false}
        onMessage={({ nativeEvent }) => {
          if (nativeEvent.data === 'ready' || nativeEvent.data === 'error') setStatus(nativeEvent.data);
          else if (nativeEvent.data.startsWith('error:')) {
            console.warn('Map renderer:', nativeEvent.data.slice(6));
            setStatus('error');
          }
        }}
        onError={() => setStatus('error')}
        onHttpError={() => setStatus('error')}
        onShouldStartLoadWithRequest={(request) => {
          // Keep attribution links working without navigating away from the map.
          if (request.url === 'about:blank') return true;
          if (request.url.startsWith('https://')) {
            void Linking.openURL(request.url).catch((error) => console.warn('Could not open map link', error));
          }
          return false;
        }}
      />
      {status === 'ready' && (
        <MapControls locating={locating} onLocate={centerOnUser}
          onZoomIn={() => webView.current?.injectJavaScript('window.zoomMap(1); true;')}
          onZoomOut={() => webView.current?.injectJavaScript('window.zoomMap(-1); true;')} />
      )}
      {locationError && status === 'ready' && (
        <View style={styles.locationError}>
          <Text accessibilityRole="alert" style={styles.message}>{locationError.message}</Text>
          {locationError.settings && <Button title="Open settings" color="#171717"
            onPress={() => { void Linking.openSettings().catch(() => setLocationError({ message: 'Open your device settings to allow location access.' })); }} />}
          <Button title="Dismiss" color="#171717" onPress={() => setLocationError(null)} />
        </View>
      )}
      {status !== 'ready' && (
        <View style={styles.overlay}>
          {status === 'loading' ? (
            <>
              <ActivityIndicator color="#171717" size="large" />
              <Text style={styles.message}>Loading map…</Text>
            </>
          ) : (
            <>
              <Text accessibilityRole="alert" style={styles.title}>Couldn’t load the map</Text>
              <Text style={styles.message}>Check your internet connection and try again.</Text>
              <Button title="Retry" color="#171717" onPress={retry} />
            </>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1, backgroundColor: '#fafafa' },
  locationError: { position: 'absolute', left: 16, right: 16, bottom: 32, padding: 16, gap: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 12 },
  overlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: '#fafafa', justifyContent: 'center', alignItems: 'center', padding: 24, gap: 16 },
  title: { fontSize: 20, fontWeight: '600', color: '#171717' },
  message: { color: '#525252', textAlign: 'center', lineHeight: 22 },
});
