

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
        name: layer.properties?.name || 'Polygon ' + layer._leaflet_id,
        coordinates: layer.getLatLngs()[0].map(latlng => [latlng.lat, latlng.lng]),
        color: layer.options.color || '#97009c'
      });
    }
  });
  
  try {
    const existing = await fetch(`${API_URL}/polygons`).then(r => r.json());
    await Promise.all(existing.map(d => 
      fetch(`${API_URL}/polygons/${d.id}`, { method: 'DELETE' })
    ));
    
    await Promise.all(polygons.map(polygon =>
      fetch(`${API_URL}/polygons`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(polygon)
      })
    ));
    
    console.log('Data saved to server');
  } catch (error) {
    console.error('Error:', error);
  }
}

window.loadFromServer = async function() {
  try {
    const polygons = await fetch(`${API_URL}/polygons`).then(r => r.json());
    
    drawnItems.clearLayers();
    
    polygons.forEach(polygon => {
      const layer = L.polygon(polygon.coordinates, {
        color: polygon.color || '#97009c',
        fillColor: polygon.color || '#97009c',
        fillOpacity: 0.3
      });
      
      layer.properties = { name: polygon.name };
      layer.bindTooltip(polygon.name, { permanent: false, direction: 'center' });
      drawnItems.addLayer(layer);
    });
    
  } catch (error) {
    console.error('Error loading:', error);
  }
}

function showNamePrompt(layer) {
  const name = prompt("Enter name for this polygon:");
  
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

  let currentColor = '#97009c';

  drawControl = new L.Control.Draw({
    draw: {
      polygon: {
        allowIntersection: false,
        shapeOptions: { 
          color: currentColor, 
          fillColor: currentColor, 
          fillOpacity: 0.3 
        }
      },
      polyline: false,
      rectangle: false,
      circle: false,
      circlemarker: false,
      marker: false
    },
    edit: {
      featureGroup: drawnItems,
      remove: true
    }
  });

  map.addControl(drawControl);

  window.changeColor = function() {
    if (currentColor === '#97009c') {
      currentColor = '#ff0000';
    } else {
      currentColor = '#97009c';
    }
    
    map.removeControl(drawControl);
    drawControl = new L.Control.Draw({
      draw: {
        polygon: {
          allowIntersection: false,
          shapeOptions: { 
            color: currentColor, 
            fillColor: currentColor, 
            fillOpacity: 0.3 
          }
        },
        polyline: false,
        rectangle: false,
        circle: false,
        circlemarker: false,
        marker: false
      },
      edit: {
        featureGroup: drawnItems,
        remove: true
      }
    });
    map.addControl(drawControl);
    
    alert('Color changed to: ' + (currentColor === '#97009c' ? 'PURPLE' : 'RED'));
  }

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