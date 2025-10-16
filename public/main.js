window.addEventListener("load", function () {
  initializeMap();
});

let map;
let drawnItems;
let drawControl;

// Función para mostrar popup de nombre al crear polígono
function showNamePrompt(layer) {
  const name = prompt("Ingresa el nombre para este distrito:", "Distrito " + (drawnItems.getLayers().length + 1));
  
  if (name !== null) {
    layer.setStyle({
      color: '#97009c',
      fillColor: '#97009c',
      fillOpacity: 0.3
    });
    
    // Guardar nombre en las propiedades del layer
    layer.properties = layer.properties || {};
    layer.properties.name = name;
    
    // Agregar tooltip con el nombre
    layer.bindTooltip(name, { permanent: false, direction: 'center' });
    
    drawnItems.addLayer(layer);
    saveToBrowser();
    showAutoSaveNotification('Polígono "' + name + '" creado y guardado');
  } else {
    // Si el usuario cancela, removemos el layer
    map.removeLayer(layer);
  }
}

window.saveToBrowser = function() {
  const polygons = [];
  
  drawnItems.eachLayer(function(layer) {
    if (layer instanceof L.Polygon) {
      polygons.push({
        id: layer._leaflet_id,
        type: 'polygon',
        coordinates: layer.getLatLngs()[0].map(function(latlng) {
          return [latlng.lat, latlng.lng];
        }),
        color: layer.options.color || '#97009c',
        fillColor: layer.options.fillColor || '#97009c',
        fillOpacity: layer.options.fillOpacity || 0.3,
        properties: layer.properties || { name: 'Distrito ' + layer._leaflet_id }
      });
    }
  });
  
  const geoData = {
    type: "FeatureCollection",
    metadata: {
      name: "Distritos de Managua",
      lastSaved: new Date().toLocaleString(),
      totalPolygons: polygons.length
    },
    features: polygons.map((polygon) => ({
      type: "Feature",
      id: polygon.id,
      properties: {
        name: polygon.properties.name,
        color: polygon.color,
        fillColor: polygon.fillColor,
        fillOpacity: polygon.fillOpacity
      },
      geometry: {
        type: "Polygon",
        coordinates: [polygon.coordinates]
      }
    }))
  };
  
  localStorage.setItem('distritosData', JSON.stringify(geoData));
  console.log('Datos guardados automáticamente en el navegador');
}

window.loadFromBrowser = function() {
  const savedData = localStorage.getItem('distritosData');
  if (savedData) {
    try {
      const geoData = JSON.parse(savedData);
      
      if (geoData.features && geoData.features.length > 0) {
        geoData.features.forEach(feature => {
          if (feature.geometry.type === "Polygon" && feature.geometry.coordinates) {
            const polygon = L.polygon(feature.geometry.coordinates[0], {
              color: feature.properties?.color || '#97009c',
              fillColor: feature.properties?.fillColor || '#97009c',
              fillOpacity: feature.properties?.fillOpacity || 0.3
            });
            
            // Restaurar propiedades
            polygon.properties = {
              name: feature.properties?.name || 'Distrito ' + polygon._leaflet_id
            };
            
            // Agregar tooltip
            polygon.bindTooltip(polygon.properties.name, { permanent: false, direction: 'center' });
            
            drawnItems.addLayer(polygon);
          }
        });
        console.log(`Cargados ${geoData.features.length} polígonos desde el navegador`);
      }
    } catch (error) {
      console.error('Error cargando datos:', error);
    }
  }
}

window.showAutoSaveNotification = function(message) {
  const existingNotification = document.querySelector('.auto-save-notification');
  if (existingNotification) {
    document.body.removeChild(existingNotification);
  }
  
  const notification = document.createElement('div');
  notification.className = 'auto-save-notification';
  notification.style.position = 'fixed';
  notification.style.top = '10px';
  notification.style.left = '50%';
  notification.style.transform = 'translateX(-50%)';
  notification.style.backgroundColor = '#4CAF50';
  notification.style.color = 'white';
  notification.style.padding = '8px 16px';
  notification.style.borderRadius = '4px';
  notification.style.zIndex = '1000';
  notification.style.fontSize = '12px';
  notification.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
  notification.textContent = `✓ ${message}`;
  
  document.body.appendChild(notification);

  setTimeout(() => {
    if (document.body.contains(notification)) {
      document.body.removeChild(notification);
    }
  }, 2000);
}

function initializeMap() {
  map = L.map("map").setView([12.1147, -86.2362], 12);

  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);

  drawnItems = new L.FeatureGroup();
  map.addLayer(drawnItems);

  // Configurar controles de Leaflet Draw
  drawControl = new L.Control.Draw({
    draw: {
      polygon: {
        allowIntersection: false,
        drawError: {
          color: '#e1e100',
          message: '<strong>Error:</strong> ¡Las formas no pueden superponerse!'
        },
        shapeOptions: {
          color: '#97009c',
          fillColor: '#97009c',
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

  // Evento cuando se crea un polígono
  map.on(L.Draw.Event.CREATED, function (e) {
    var type = e.layerType,
        layer = e.layer;

    if (type === 'polygon') {
      showNamePrompt(layer);
    }
  });

  // Evento cuando se edita un polígono
  map.on(L.Draw.Event.EDITED, function (e) {
    saveToBrowser();
    showAutoSaveNotification('Cambios guardados');
  });

  // Evento cuando se elimina un polígono
  map.on(L.Draw.Event.DELETED, function (e) {
    saveToBrowser();
    showAutoSaveNotification('Polígono(s) eliminado(s) y guardado');
  });

  // Cargar datos existentes
  loadFromBrowser();
  map.invalidateSize();
}