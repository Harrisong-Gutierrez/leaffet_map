window.addEventListener("load", function () {
  initializeMap();
});

let map;
let drawnItems;
let drawControl;
const API_URL = 'http://localhost:3001';


window.saveToServer = async function() {
  const polygons = [];
  
  drawnItems.eachLayer(function(layer) {
    if (layer instanceof L.Polygon) {
      polygons.push({
        name: layer.properties?.name || 'Distrito ' + layer._leaflet_id,
        coordinates: layer.getLatLngs()[0].map(latlng => [latlng.lat, latlng.lng])
      });
    }
  });
  
  try {
    const existing = await fetch(`${API_URL}/distritos`).then(r => r.json());
    await Promise.all(existing.map(d => 
      fetch(`${API_URL}/distritos/${d.id}`, { method: 'DELETE' })
    ));
    
    await Promise.all(polygons.map(polygon =>
      fetch(`${API_URL}/distritos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(polygon)
      })
    ));
    
    console.log('Datos guardados en servidor');
  } catch (error) {
    console.error('Error:', error);
  }
}


window.loadFromServer = async function() {
  try {
    const distritos = await fetch(`${API_URL}/distritos`).then(r => r.json());
    
    drawnItems.clearLayers();
    
    distritos.forEach(distrito => {
      const polygon = L.polygon(distrito.coordinates, {
        color: '#97009c',
        fillColor: '#97009c',
        fillOpacity: 0.3
      });
      
      polygon.properties = { name: distrito.name };
      polygon.bindTooltip(distrito.name, { permanent: false, direction: 'center' });
      drawnItems.addLayer(polygon);
    });
    
  } catch (error) {
    console.error('Error cargando:', error);
  }
}

function showNamePrompt(layer) {
  const name = prompt("Ingresa el nombre para este distrito:");
  
  if (name !== null) {
    layer.properties = { name: name };
    layer.bindTooltip(name, { permanent: false, direction: 'center' });
    drawnItems.addLayer(layer);
    saveToServer();
  } else {
    map.removeLayer(layer);
  }
}

function initializeMap() {
  map = L.map("map").setView([12.1147, -86.2362], 12);

  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap'
  }).addTo(map);

  drawnItems = new L.FeatureGroup();
  map.addLayer(drawnItems);

  drawControl = new L.Control.Draw({
    draw: {
      polygon: {
        allowIntersection: false,
        shapeOptions: { color: '#97009c', fillColor: '#97009c', fillOpacity: 0.3 }
      },
      polyline: false, rectangle: false, circle: false, circlemarker: false, marker: false
    },
    edit: {
      featureGroup: drawnItems,
      remove: true
    }
  });

  map.addControl(drawControl);

  map.on(L.Draw.Event.CREATED, function (e) {
    if (e.layerType === 'polygon') {
      showNamePrompt(e.layer);
    }
  });

  map.on(L.Draw.Event.EDITED, function (e) {
    saveToServer();
  });

  map.on(L.Draw.Event.DELETED, function (e) {
    saveToServer();
  });

  loadFromServer();
  map.invalidateSize();
}