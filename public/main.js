window.addEventListener("load", function () {
  initializeMap();
});

let map;
let drawnItems;
let drawControl;
const API_URL = "http://localhost:3001";

// UUID corregido
function generateUUID() {
  if (crypto && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback para navegadores antiguos
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c == "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const colorPalette = [
  "#97009c",
  "#FF0000",
  "#FF4500",
  "#FF69B4",
  "#8A2BE2",
  "#4B0082",
  "#0000FF",
  "#1E90FF",
  "#00BFFF",
  "#FF1493",
  "#DC143C",
  "#B22222",
  "#FF6347",
  "#FF7F50",
  "#FF8C00",
  "#FFA500",
  "#FFD700",
  "#FFFF00",
  "#ADFF2F",
  "#7CFC00",
  "#00FA9A",
  "#00CED1",
  "#4682B4",
  "#6A5ACD",
  "#9370DB",
  "#8B008B",
  "#9932CC",
  "#BA55D3",
  "#DA70D6",
  "#FF00FF",
  "#C71585",
  "#DB7093",
  "#FFB6C1",
  "#FFA07A",
  "#FFDAB9",
  "#EEE8AA",
  "#F0E68C",
  "#BDB76B",
  "#F4A460",
  "#DAA520",
  "#CD853F",
  "#D2691E",
  "#8B4513",
  "#A0522D",
  "#A52A2A",
  "#800000",
  "#2F4F4F",
];

let currentColorIndex = 0;

function createColorPalette() {
  const paletteContainer = document.createElement("div");
  paletteContainer.id = "colorPalette";
  paletteContainer.style.cssText = `
    position: fixed;
    top: 60px;
    right: 10px;
    z-index: 1000;
    background: white;
    padding: 10px;
    border-radius: 5px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.3);
    display: none;
    grid-template-columns: repeat(6, 30px);
    gap: 5px;
    max-height: 200px;
    overflow-y: auto;
  `;

  colorPalette.forEach((color, index) => {
    const colorBox = document.createElement("div");
    colorBox.style.cssText = `
      width: 30px;
      height: 30px;
      background-color: ${color};
      border: 2px solid #ccc;
      border-radius: 3px;
      cursor: pointer;
    `;
    colorBox.title = color;
    colorBox.onclick = () => selectColor(index);
    paletteContainer.appendChild(colorBox);
  });

  document.body.appendChild(paletteContainer);
  return paletteContainer;
}

function selectColor(index) {
  currentColorIndex = index;
  const newColor = colorPalette[currentColorIndex];

  if (drawControl) {
    map.removeControl(drawControl);
  }

  drawControl = new L.Control.Draw({
    draw: {
      polygon: {
        allowIntersection: false,
        shapeOptions: {
          color: "#000000",
          fillColor: newColor,
          fillOpacity: 0.3,
          weight: 2,
        },
      },
      polyline: false,
      rectangle: false,
      circle: false,
      circlemarker: false,
      marker: false,
    },
    edit: {
      featureGroup: drawnItems,
      remove: true,
    },
  });

  map.addControl(drawControl);

  const palette = document.getElementById("colorPalette");
  if (palette) {
    palette.style.display = "none";
  }

  const colorButton = document.getElementById("colorButton");
  if (colorButton) {
    colorButton.style.backgroundColor = newColor;
  }
}

window.changeColor = function () {
  const palette = document.getElementById("colorPalette");
  if (palette) {
    palette.style.display = palette.style.display === "grid" ? "none" : "grid";
  }
};

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

// FUNCIÓN CORREGIDA - Maneja tanto Polygon como MultiPolygon
function convertFromGeoJSON(geoJSON) {
  if (!geoJSON || !geoJSON.features) return [];

  const polygons = [];

  geoJSON.features.forEach((feature) => {
    const geometry = feature.geometry;
    const properties = feature.properties || {};

    if (geometry.type === "Polygon") {
      // Para Polygon simple
      geometry.coordinates.forEach((polygonCoords) => {
        polygons.push({
          id: properties.id || generateUUID(),
          name: properties.name || "Unnamed",
          color: properties.color || colorPalette[0],
          coordinates: polygonCoords.map((coord) => [coord[1], coord[0]]), // Convertir [lng, lat] a [lat, lng]
        });
      });
    } else if (geometry.type === "MultiPolygon") {
      // Para MultiPolygon - iterar sobre cada polígono
      geometry.coordinates.forEach((multiPolygon) => {
        multiPolygon.forEach((polygonCoords) => {
          polygons.push({
            id: properties.id || generateUUID(),
            name: properties.name || "Unnamed",
            color: properties.color || colorPalette[0],
            coordinates: polygonCoords.map((coord) => [coord[1], coord[0]]), // Convertir [lng, lat] a [lat, lng]
          });
        });
      });
    }
  });

  return polygons;
}

window.saveToServer = async function () {
  const polygons = [];

  drawnItems.eachLayer(function (layer) {
    if (layer instanceof L.Polygon) {
      polygons.push({
        id: layer.properties?.id || generateUUID(),
        name: layer.properties?.name || "Polygon " + layer._leaflet_id,
        coordinates: layer
          .getLatLngs()[0]
          .map((latlng) => [latlng.lat, latlng.lng]),
        color:
          layer.properties?.color ||
          layer.options.fillColor ||
          colorPalette[currentColorIndex],
      });
    }
  });

  try {
    const geoJSONData = convertToGeoJSON(polygons);

    const response = await fetch(`${API_URL}/save-geojson`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(geoJSONData),
    });

    if (response.ok) {
      console.log("Data saved to server successfully");
      console.log("Datos guardados correctamente");
    } else {
      console.error("Error saving data:", response.status);
      console.log("Error al guardar los datos");
    }
  } catch (error) {
    console.error("Error:", error);
    console.log("Error de conexión con el servidor");
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

    const existingIds = [];
    drawnItems.eachLayer((layer) => {
      if (layer.properties?.id) {
        existingIds.push(layer.properties.id);
      }
    });

    polygons.forEach((polygon) => {
      if (!existingIds.includes(polygon.id)) {
        try {
          // Asegurar que el polígono esté cerrado (primera y última coordenada iguales)
          const coordinates = [...polygon.coordinates];
          if (coordinates.length > 0) {
            const firstCoord = coordinates[0];
            const lastCoord = coordinates[coordinates.length - 1];

            // Si no está cerrado, agregar la primera coordenada al final
            if (
              firstCoord[0] !== lastCoord[0] ||
              firstCoord[1] !== lastCoord[1]
            ) {
              coordinates.push([firstCoord[0], firstCoord[1]]);
            }
          }

          const layer = L.polygon(coordinates, {
            color: "#000000",
            fillColor: polygon.color || colorPalette[currentColorIndex],
            fillOpacity: 0.3,
            weight: 2,
          });

          layer.properties = {
            id: polygon.id,
            name: polygon.name,
            color: polygon.color,
          };

          layer.bindTooltip(polygon.name, {
            permanent: false,
            direction: "center",
          });
          drawnItems.addLayer(layer);

          console.log(
            "Added polygon:",
            polygon.name,
            "with",
            coordinates.length,
            "points"
          );
        } catch (error) {
          console.error("Error creating polygon:", polygon.name, error);
        }
      }
    });

    console.log("Data loaded successfully");
  } catch (error) {
    console.error("Error loading data:", error);
  }
};

function showNamePrompt(layer) {
  const name = prompt("Enter name for this polygon:", "New Polygon");

  if (name !== null && name.trim() !== "") {
    layer.properties = {
      id: generateUUID(),
      name: name.trim(),
      color: layer.options.fillColor,
    };

    layer.bindTooltip(name.trim(), {
      permanent: false,
      direction: "center",
      className: "polygon-tooltip",
    });

    drawnItems.addLayer(layer);

    // Guardar después de un breve delay
    setTimeout(() => {
      saveToServer();
    }, 100);
  } else {
    map.removeLayer(layer);
    if (name !== null) {
      console.log("Please enter a valid name");
    }
  }
}

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

  createColorPalette();

  // Asegurar que el botón de color tenga el ID correcto
  const colorButton = document.querySelector("button");
  if (colorButton) {
    colorButton.id = "colorButton";
    colorButton.style.backgroundColor = colorPalette[currentColorIndex];
  }

  drawControl = new L.Control.Draw({
    draw: {
      polygon: {
        allowIntersection: false,
        shapeOptions: {
          color: "#000000",
          fillColor: colorPalette[currentColorIndex],
          fillOpacity: 0.3,
          weight: 2,
        },
      },
      polyline: false,
      rectangle: false,
      circle: false,
      circlemarker: false,
      marker: false,
    },
    edit: {
      featureGroup: drawnItems,
      remove: true,
    },
  });

  map.addControl(drawControl);

  map.on(L.Draw.Event.CREATED, function (e) {
    if (e.layerType === "polygon") {
      const currentColor = colorPalette[currentColorIndex];
      e.layer.setStyle({
        color: "#000000",
        fillColor: currentColor,
        fillOpacity: 0.3,
        weight: 2,
      });
      showNamePrompt(e.layer);
    }
  });

  map.on(L.Draw.Event.EDITED, function (e) {
    e.layers.eachLayer(function (layer) {
      if (layer instanceof L.Polygon) {
        const existingProperties = layer.properties || {};
        const existingColor =
          existingProperties.color || layer.options.fillColor;

        layer.setStyle({
          color: "#000000",
          fillColor: existingColor,
          fillOpacity: 0.3,
          weight: 2,
        });

        if (!layer.properties) {
          layer.properties = {
            id: generateUUID(),
            color: existingColor,
            name: "Polygon " + layer._leaflet_id,
          };
        } else {
          layer.properties.color = existingColor;
        }
      }
    });
    saveToServer();
  });

  map.on(L.Draw.Event.DELETED, function (e) {
    saveToServer();
  });

  // Cargar datos existentes
  loadFromServer();

  // Asegurar que el mapa se redibuje correctamente
  setTimeout(() => {
    map.invalidateSize();
  }, 100);
}
