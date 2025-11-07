window.addEventListener("load", initializeMap);

let map, drawnItems;
const API_URL = "http://localhost:3001";

const CONFIG = {
  polygonStyle: {
    color: "#000000",
    fillOpacity: 0.3,
    weight: 2,
  },
  tooltip: {
    permanent: true,
    direction: "center",
  },
  zoomLevels: {
    distrito: 12,
    barrio: 16,
  },
};

const DISTRICT_COLORS = [
  "#FF0000",
  "#00FF00",
  "#0000FF",
  "#FFFF00",
  "#FF00FF",
  "#00FFFF",
  "#FF8000",
  "#8000FF",
  "#00FF80",
  "#FF0080",
  "#80FF00",
  "#0080FF",
  "#FF8040",
  "#40FF80",
  "#8040FF",
];

const BARRIO_COLOR = "#97009c";

const districtColorMap = new Map();

function getDistrictColor(districtName) {
  if (!districtColorMap.has(districtName)) {
    const colorIndex = districtColorMap.size % DISTRICT_COLORS.length;
    districtColorMap.set(districtName, DISTRICT_COLORS[colorIndex]);
  }
  return districtColorMap.get(districtName);
}

function generateUUID() {
  return (
    crypto?.randomUUID?.() ||
    ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) =>
      (
        c ^
        (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))
      ).toString(16)
    )
  );
}

function debounce(func, wait) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

function getPolygonTypeFromProperties(properties) {
  const name = properties?.name || "";

  if (
    name.toLowerCase().includes("distrito") ||
    /^distrito\s*\d+/i.test(name)
  ) {
    return "distrito";
  }
  return "barrio";
}

function getPolygonTypeFromLayer(layer) {
  const name = layer.properties?.name || "";

  if (
    name.toLowerCase().includes("distrito") ||
    /^distrito\s*\d+/i.test(name)
  ) {
    return "distrito";
  }

  try {
    const latLngs = layer.getLatLngs()[0];
    const area = L.GeometryUtil.geodesicArea(latLngs);
    if (area / 1000000 > 15) return "distrito";
  } catch (error) {
    console.log("Error calculating area:", error);
  }

  return "barrio";
}

function createPolygonLayer(coordinates, properties = {}) {
  const type = getPolygonTypeFromProperties(properties);
  const color =
    type === "distrito" ? getDistrictColor(properties.name) : BARRIO_COLOR;

  const layer = L.polygon(coordinates, {
    ...CONFIG.polygonStyle,
    fillColor: color,
  });

  layer.properties = {
    id: properties.id || generateUUID(),
    name: properties.name || "Unnamed",
    color: color,
    type: type,
  };

  layer.bindTooltip(layer.properties.name, {
    ...CONFIG.tooltip,
    className: `polygon-tooltip ${type}`,
  });

  // Agregar evento de clic derecho para eliminar
  layer.on('contextmenu', function(e) {
    e.originalEvent.preventDefault();
    if (confirm('¿Estás seguro de que quieres eliminar este polígono?')) {
      drawnItems.removeLayer(layer);
      saveToServer();
    }
  });

  return layer;
}

function updateLayerVisibility(layer, currentZoom) {
  if (!(layer instanceof L.Polygon) || !layer.properties?.name) return;

  const tooltip = layer.getTooltip();
  if (!tooltip) return;

  const minZoom = CONFIG.zoomLevels[layer.properties.type];
  const shouldBeOpen = currentZoom >= minZoom;

  if (shouldBeOpen && !tooltip.isOpen()) {
    layer.openTooltip();
  } else if (!shouldBeOpen && tooltip.isOpen()) {
    layer.closeTooltip();
  }
}

function convertToGeoJSON(polygons) {
  return {
    type: "FeatureCollection",
    name: "barrios_managua",
    crs: {
      type: "name",
      properties: { name: "urn:ogc:def:crs:OGC:1.3:CRS84" },
    },
    features: polygons.map((polygon) => ({
      type: "Feature",
      properties: {
        id: polygon.id,
        name: polygon.name,
        color: polygon.color,
        type: "barrio",
        admin_level: "10",
        boundary: "administrative",
      },
      geometry: {
        type: "Polygon",
        coordinates: [polygon.coordinates.map((coord) => [coord[1], coord[0]])],
      },
    })),
  };
}

function processGeoJSONFeature(feature, polygons) {
  const geometry = feature.geometry;
  const properties = feature.properties || {};

  const name = properties.N_Comun || properties.name || "Unnamed Polygon";
  const id =
    properties.id ||
    properties.ID_UNICO ||
    properties.id_unico_1 ||
    generateUUID();
  const type = getPolygonTypeFromProperties(properties);
  const color = type === "distrito" ? getDistrictColor(name) : BARRIO_COLOR;

  const processCoordinates = (coords) => ({
    id: id,
    name: name,
    color: color,
    coordinates: coords.map((coord) => [coord[1], coord[0]]),
  });

  if (geometry.type === "Polygon") {
    geometry.coordinates.forEach((polygonCoords) => {
      polygons.push(processCoordinates(polygonCoords));
    });
  } else if (geometry.type === "MultiPolygon") {
    geometry.coordinates.forEach((multiPolygon) => {
      multiPolygon.forEach((polygonCoords) => {
        polygons.push(processCoordinates(polygonCoords));
      });
    });
  }
}

function convertFromGeoJSON(geoJSON) {
  if (!geoJSON) return [];

  const polygons = [];
  const features =
    geoJSON.type === "FeatureCollection" ? geoJSON.features : [geoJSON];

  features.forEach((feature) => processGeoJSONFeature(feature, polygons));
  return polygons;
}

function extractPolygonData(layer) {
  return {
    id: layer.properties?.id || generateUUID(),
    name: layer.properties?.name || "Polygon " + layer._leaflet_id,
    coordinates: layer
      .getLatLngs()[0]
      .map((latlng) => [latlng.lat, latlng.lng]),
    color: layer.properties?.color || layer.options.fillColor,
  };
}

window.saveToServer = async function () {
  const polygons = [];
  drawnItems.eachLayer((layer) => {
    if (layer instanceof L.Polygon) {
      polygons.push(extractPolygonData(layer));
    }
  });

  try {
    const response = await fetch(`${API_URL}/save-geojson`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(convertToGeoJSON(polygons)),
    });
    
    if (response.ok) {
      console.log("Data saved successfully");
    } else {
      console.log("Error saving data");
    }
  } catch (error) {
    console.error("Error:", error);
  }
};

window.loadFromServer = async function () {
  try {
    const response = await fetch(`${API_URL}/barrios_managua.geojson`);
    if (!response.ok) {
      console.log("No existing GeoJSON data found, starting fresh");
      return;
    }

    const geoJSONData = await response.json();
    const polygons = convertFromGeoJSON(geoJSONData);
    const existingIds = new Set();

    drawnItems.eachLayer((layer) => {
      if (layer.properties?.id) existingIds.add(layer.properties.id);
    });

    polygons.forEach((polygon) => {
      if (!existingIds.has(polygon.id)) {
        try {
          const coordinates = [...polygon.coordinates];
          const firstCoord = coordinates[0];
          const lastCoord = coordinates[coordinates.length - 1];

          if (
            firstCoord[0] !== lastCoord[0] ||
            firstCoord[1] !== lastCoord[1]
          ) {
            coordinates.push([firstCoord[0], firstCoord[1]]);
          }

          const layer = createPolygonLayer(coordinates, polygon);
          drawnItems.addLayer(layer);
        } catch (error) {
          console.error("Error creating polygon:", polygon.name, error);
        }
      }
    });

    updateLabelsVisibility();
    console.log("Data loaded successfully");
  } catch (error) {
    console.error("Error loading data:", error);
  }
};

const updateLabelsVisibility = debounce(function () {
  const currentZoom = map.getZoom();
  drawnItems.eachLayer((layer) => {
    updateLayerVisibility(layer, currentZoom);
  });
}, 150);

function initializeMap() {
  const mapElement = document.getElementById("map");
  if (!mapElement) {
    console.error("Map element not found");
    return;
  }

  map = L.map("map").setView([12.1147, -86.2362], 12);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap",
  }).addTo(map);

  drawnItems = new L.FeatureGroup();
  map.addLayer(drawnItems);

  // Configurar control de dibujo nativo de Leaflet
  const drawControl = new L.Control.Draw({
    draw: {
      polygon: {
        allowIntersection: false,
        drawError: {
          color: '#e1e100',
          message: '<strong>Error:</strong> ¡Las formas no se pueden intersectar!'
        },
        shapeOptions: {
          color: '#97009c',
          fillOpacity: 0.3,
          weight: 2
        }
      },
      polyline: false,
      circle: false,
      rectangle: false,
      circlemarker: false,
      marker: false
    },
    edit: false
  });
  
  map.addControl(drawControl);

  // Evento cuando se crea un nuevo polígono
  map.on(L.Draw.Event.CREATED, function (event) {
    const layer = event.layer;
    if (layer instanceof L.Polygon) {
      const polygonName = prompt('Ingresa el nombre del nuevo polígono:', 'Nuevo Polígono');
      
      if (polygonName) {
        const coordinates = layer.getLatLngs()[0].map(latlng => [latlng.lat, latlng.lng]);
        const newLayer = createPolygonLayer(coordinates, { name: polygonName });
        drawnItems.addLayer(newLayer);
        saveToServer();
      }
      
      // No es necesario remover la capa porque el control de dibujo ya lo maneja
    }
  });

  map.on("zoomend", updateLabelsVisibility);
  map.on("moveend", updateLabelsVisibility);

  loadFromServer();
  setTimeout(() => map.invalidateSize(), 100);
}