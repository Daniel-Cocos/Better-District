// OpenFreeMap hosts OpenStreetMap data without an API key.
export const mapDocument = `<!doctype html>
<html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/maplibre-gl@5.8.0/dist/maplibre-gl.css"
  onerror="window.ReactNativeWebView.postMessage('error')">
<style>
html, body, #map { width:100%; height:100%; margin:0; background:#f5f5f5; }
.maplibregl-canvas { filter:grayscale(1); }
.maplibregl-ctrl-attrib { font:10px/1.5 sans-serif; background:rgba(255,255,255,.9) !important; }
.maplibregl-ctrl-attrib a { color:#404040; }
</style>
</head><body>
<div id="map" role="application" aria-label="Map of Southampton"></div>
<script src="https://unpkg.com/maplibre-gl@5.8.0/dist/maplibre-gl.js"
  onerror="window.ReactNativeWebView.postMessage('error')"></script>
<script>
try {
  // This pinned build bundles its worker, avoiding cross-origin module workers.
  const { Map, AttributionControl } = maplibregl;
  const map = new Map({
    container:'map', style:'https://tiles.openfreemap.org/styles/positron',
    center:[-1.4044, 50.9097], zoom:13, maxZoom:19,
    attributionControl:false, dragRotate:false, pitchWithRotate:false
  });
  map.touchZoomRotate.disableRotation();
  map.addControl(new AttributionControl({ compact:false }), 'bottom-right');
  window.zoomMap = function (delta) {
    map.easeTo({ zoom:Math.max(0, Math.min(19, map.getZoom() + delta)), duration:250 });
  };
  window.centerOnLocation = function (latitude, longitude, accuracy) {
    const point = [longitude, latitude];
    const radiusAtZoomZero = accuracy / (78271.51696 * Math.max(0.01, Math.cos(latitude * Math.PI / 180)));
    map.getSource('user-location').setData({ type:'Feature', properties:{}, geometry:{ type:'Point', coordinates:point } });
    map.setPaintProperty('user-accuracy', 'circle-radius',
      ['interpolate', ['exponential', 2], ['zoom'], 0, radiusAtZoomZero, 24, radiusAtZoomZero * Math.pow(2, 24)]);
    map.flyTo({ center:point, zoom:16, duration:600 });
  };
  map.on('load', function () {
    map.addSource('user-location', { type:'geojson', data:{ type:'FeatureCollection', features:[] } });
    map.addLayer({ id:'user-accuracy', type:'circle', source:'user-location', paint:{
      'circle-color':'#737373', 'circle-opacity':0.12, 'circle-radius':0,
      'circle-stroke-color':'#737373', 'circle-stroke-width':1
    } });
    map.addLayer({ id:'user-position', type:'circle', source:'user-location', paint:{
      'circle-color':'#171717', 'circle-radius':7, 'circle-stroke-color':'#fff', 'circle-stroke-width':3
    } });
    window.ReactNativeWebView.postMessage('ready');
  });
  map.on('error', function (event) {
    if (!map.loaded()) window.ReactNativeWebView.postMessage('error:' + String(event.error));
  });
} catch (error) {
  window.ReactNativeWebView.postMessage('error:' + String(error));
}
</script></body></html>`;
