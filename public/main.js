window.addEventListener("load", function () {
  initializeMap();
});

let map;
let drawnItems;
let drawControl;
const API_URL = "http://localhost:3001";

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

  map.removeControl(drawControl);
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
  palette.style.display = "none";

  document.getElementById("colorButton").style.backgroundColor = newColor;
}

window.changeColor = function () {
  const palette = document.getElementById("colorPalette");
  palette.style.display = palette.style.display === "grid" ? "none" : "grid";
};

window.saveToServer = async function () {
  const polygons = [];

  drawnItems.eachLayer(function (layer) {
    if (layer instanceof L.Polygon) {
      polygons.push({
        name: layer.properties?.name || "Polygon " + layer._leaflet_id,
        coordinates: layer
          .getLatLngs()[0]
          .map((latlng) => [latlng.lat, latlng.lng]),
        color: layer.options.fillColor || colorPalette[currentColorIndex],
      });
    }
  });

  try {
    const existing = await fetch(`${API_URL}/polygons`).then((r) => r.json());
    await Promise.all(
      existing.map((d) =>
        fetch(`${API_URL}/polygons/${d.id}`, { method: "DELETE" })
      )
    );

    await Promise.all(
      polygons.map((polygon) =>
        fetch(`${API_URL}/polygons`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(polygon),
        })
      )
    );

    console.log("Data saved to server");
  } catch (error) {
    console.error("Error:", error);
  }
};

window.loadFromServer = async function () {
  try {
    const polygons = await fetch(`${API_URL}/polygons`).then((r) => r.json());

    drawnItems.clearLayers();

    polygons.forEach((polygon) => {
      const layer = L.polygon(polygon.coordinates, {
        color: "#000000",
        fillColor: polygon.color || colorPalette[currentColorIndex],
        fillOpacity: 0.3,
        weight: 2,
      });

      layer.properties = { name: polygon.name };
      layer.bindTooltip(polygon.name, {
        permanent: false,
        direction: "center",
      });
      drawnItems.addLayer(layer);
    });
  } catch (error) {
    console.error("Error loading:", error);
  }
};

function showNamePrompt(layer) {
  const name = prompt("Enter name for this polygon:");

  if (name !== null) {
    layer.properties = { name: name };
    layer.bindTooltip(name, { permanent: false, direction: "center" });
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
    attribution: "&copy; OpenStreetMap",
  }).addTo(map);

  drawnItems = new L.FeatureGroup();
  map.addLayer(drawnItems);

  createColorPalette();

  const colorButton = document.querySelector("button");
  colorButton.id = "colorButton";

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
      e.layer.setStyle({
        color: "#000000",
        weight: 2,
      });
      showNamePrompt(e.layer);
    }
  });

  map.on(L.Draw.Event.EDITED, function (e) {
    e.layers.eachLayer(function (layer) {
      if (layer instanceof L.Polygon) {
        layer.setStyle({
          color: "#000000",
          weight: 2,
        });
      }
    });
    saveToServer();
  });

  map.on(L.Draw.Event.DELETED, function (e) {
    saveToServer();
  });

  loadFromServer();
  map.invalidateSize();
}
