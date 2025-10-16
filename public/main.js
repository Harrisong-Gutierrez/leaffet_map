window.addEventListener("load", function () {
  initializeMap();
});

let map;
let drawnItems;
let drawControl;

function initializeMap() {
  // Inicializar mapa centrado en Managua
  map = L.map("map").setView([12.1147, -86.2362], 12);

  // Capa de tiles de OpenStreetMap
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);

  // Capa para almacenar los elementos dibujados
  drawnItems = new L.FeatureGroup();
  map.addLayer(drawnItems);

  // Configurar controles de dibujo
  drawControl = new L.Control.Draw({
    draw: {
      polygon: {
        allowIntersection: false,
        drawError: {
          color: '#e1e100',
          message: '<strong>Error:</strong> ¡Las formas no pueden superponerse!'
        },
        shapeOptions: {
          color: '#97009c'
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

  // Agregar control al mapa
  map.addControl(drawControl);

  // Eventos para manejar el dibujo (con guardado automático)
  map.on(L.Draw.Event.CREATED, function (e) {
    var type = e.layerType,
        layer = e.layer;

    if (type === 'polygon') {
      drawnItems.addLayer(layer);
      saveToBrowser();
      showAutoSaveNotification('Polígono creado y guardado');
    }
  });

  map.on(L.Draw.Event.EDITED, function (e) {
    saveToBrowser();
    showAutoSaveNotification('Cambios guardados');
  });

  map.on(L.Draw.Event.DELETED, function (e) {
    saveToBrowser();
    showAutoSaveNotification('Polígono eliminado y guardado');
  });

  // Cargar polígonos existentes automáticamente al iniciar
  loadFromBrowser();

  // Agregar controles personalizados
  addCustomControls();

  map.invalidateSize();
}

function addCustomControls() {
  L.Control.DatabaseControl = L.Control.extend({
    onAdd: function(map) {
      var container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');
      container.innerHTML = `
        <strong>Editor de Distritos</strong>
        <div style="font-size: 10px; color: green; margin: 2px 0;">✓ Guardado automático</div>
        <button onclick="showJSON()" style="margin:3px 0; padding:5px; font-size:12px;">Ver JSON</button>
        <button onclick="exportJSON()" style="margin:3px 0; padding:5px; font-size:12px;">Exportar JSON</button>
        <button onclick="clearAll()" style="margin:3px 0; padding:5px; font-size:12px;">Limpiar Todo</button>
      `;
      return container;
    }
  });

  new L.Control.DatabaseControl({ position: 'topright' }).addTo(map);
}

function saveToBrowser() {
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
        fillOpacity: layer.options.fillOpacity || 0.3
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
    features: polygons.map((polygon, index) => ({
      type: "Feature",
      id: polygon.id,
      properties: {
        name: `Distrito ${index + 1}`,
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
  
  // Guardar en localStorage del navegador
  localStorage.setItem('distritosData', JSON.stringify(geoData));
  console.log('Datos guardados automáticamente en el navegador');
}

function loadFromBrowser() {
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

function showAutoSaveNotification(message) {
  // Crear notificación temporal
  const notification = document.createElement('div');
  notification.style.position = 'fixed';
  notification.style.top = '10px';
  notification.style.left = '50%';
  notification.style.transform = 'translateX(-50%)';
  notification.style.backgroundColor = '#4CAF50';
  notification.style.color: 'white';
  notification.style.padding = '8px 16px';
  notification.style.borderRadius = '4px';
  notification.style.zIndex = '1000';
  notification.style.fontSize = '12px';
  notification.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
  notification.textContent = `✓ ${message}`;
  
  document.body.appendChild(notification);
  
  // Remover después de 2 segundos
  setTimeout(() => {
    document.body.removeChild(notification);
  }, 2000);
}

function showJSON() {
  const savedData = localStorage.getItem('distritosData');
  const jsonContent = savedData ? JSON.parse(savedData) : { 
    type: "FeatureCollection", 
    features: [],
    metadata: { message: "No hay datos guardados" }
  };
  const formattedJSON = JSON.stringify(jsonContent, null, 2);
  
  // Crear modal para mostrar el JSON
  const modal = document.createElement('div');
  modal.style.position = 'fixed';
  modal.style.top = '50%';
  modal.style.left = '50%';
  modal.style.transform = 'translate(-50%, -50%)';
  modal.style.backgroundColor = 'white';
  modal.style.padding = '20px';
  modal.style.borderRadius = '10px';
  modal.style.boxShadow = '0 0 20px rgba(0,0,0,0.3)';
  modal.style.zIndex = '1000';
  modal.style.maxWidth = '80%';
  modal.style.maxHeight = '80%';
  modal.style.overflow = 'auto';
  
  modal.innerHTML = `
    <h3>JSON de Distritos (Guardado Automáticamente)</h3>
    <div style="font-size: 12px; color: #666; margin-bottom: 10px;">
      Última actualización: ${jsonContent.metadata?.lastSaved || 'Nunca'}
    </div>
    <textarea style="width: 100%; height: 300px; font-family: monospace; margin: 10px 0; font-size: 12px;">${formattedJSON}</textarea>
    <div>
      <button onclick="copyJSON()" style="padding: 5px 10px;">Copiar JSON</button>
      <button onclick="exportJSON()" style="padding: 5px 10px; margin-left: 10px;">Exportar Archivo</button>
      <button onclick="this.parentElement.parentElement.remove()" style="padding: 5px 10px; margin-left: 10px;">Cerrar</button>
    </div>
  `;
  
  document.body.appendChild(modal);
}

function exportJSON() {
  const savedData = localStorage.getItem('distritosData');
  const geoData = savedData ? JSON.parse(savedData) : { features: [] };
  
  const dataStr = JSON.stringify(geoData, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  
  const link = document.createElement('a');
  link.href = URL.createObjectURL(dataBlob);
  link.download = `distritos_managua_${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function copyJSON() {
  const textarea = document.querySelector('textarea');
  textarea.select();
  document.execCommand('copy');
  alert('JSON copiado al portapapeles!');
}

function clearAll() {
  if (confirm('¿Estás seguro de que quieres eliminar todos los distritos? Esto no se puede deshacer.')) {
    drawnItems.clearLayers();
    localStorage.removeItem('distritosData');
    showAutoSaveNotification('Todos los datos han sido eliminados');
  }
}