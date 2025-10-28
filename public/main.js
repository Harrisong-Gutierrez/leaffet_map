window.addEventListener("load", initializeMap);

let map, drawnItems, drawControl;
const API_URL = "http://localhost:3001";

// Configuración centralizada
const CONFIG = {
    polygonStyle: {
        color: "#000000",
        fillOpacity: 0.3,
        weight: 2
    },
    tooltip: {
        permanent: true,
        direction: "center"
    },
    zoomLevels: {
        distrito: 14,
        barrio: 16
    }
};

const colorPalette = [
    "#97009c", "#FF0000", "#FF4500", "#FF69B4", "#8A2BE2", "#4B0082", "#0000FF", 
    "#1E90FF", "#00BFFF", "#FF1493", "#DC143C", "#B22222", "#FF6347", "#FF7F50", 
    "#FF8C00", "#FFA500", "#FFD700", "#FFFF00", "#ADFF2F", "#7CFC00", "#00FA9A", 
    "#00CED1", "#4682B4", "#6A5ACD", "#9370DB", "#8B008B", "#9932CC", "#BA55D3", 
    "#DA70D6", "#FF00FF", "#C71585", "#DB7093", "#FFB6C1", "#FFA07A", "#FFDAB9", 
    "#EEE8AA", "#F0E68C", "#BDB76B", "#F4A460", "#DAA520", "#CD853F", "#D2691E", 
    "#8B4513", "#A0522D", "#A52A2A", "#800000", "#2F4F4F"
];

let currentColorIndex = 0;
let zoomTimeout;

// UUID optimizado
function generateUUID() {
    return crypto?.randomUUID?.() || 
        ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
            (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
        );
}

// Función única para crear controles de dibujo
function createDrawControl(color) {
    return new L.Control.Draw({
        draw: {
            polygon: {
                allowIntersection: false,
                shapeOptions: { ...CONFIG.polygonStyle, fillColor: color }
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
}

// Función optimizada para crear polígonos
function createPolygon(coordinates, properties = {}) {
    const layer = L.polygon(coordinates, {
        ...CONFIG.polygonStyle,
        fillColor: properties.color || colorPalette[currentColorIndex]
    });

    layer.properties = {
        id: properties.id || generateUUID(),
        name: properties.name || "Unnamed",
        color: properties.color || colorPalette[currentColorIndex]
    };

    const polygonType = getPolygonType(layer);
    layer.bindTooltip(layer.properties.name, {
        ...CONFIG.tooltip,
        className: `polygon-tooltip ${polygonType}`
    });

    return layer;
}

// Función única para manejar tooltips
function updateLayerTooltip(layer, currentZoom) {
    if (!(layer instanceof L.Polygon) || !layer.properties?.name) return;

    const tooltip = layer.getTooltip();
    if (!tooltip) return;

    const polygonType = getPolygonType(layer);
    const minZoom = CONFIG.zoomLevels[polygonType];
    
    if (currentZoom >= minZoom) {
        if (!tooltip.isOpen()) layer.openTooltip();
        const tooltipElement = layer._tooltip?._container;
        if (tooltipElement) {
            tooltipElement.style.fontWeight = polygonType === 'distrito' ? 'bold' : 'normal';
            tooltipElement.style.fontSize = polygonType === 'distrito' ? '16px' : '11px';
            tooltipElement.style.textShadow = polygonType === 'distrito' ? 
                '2px 2px 4px rgba(0,0,0,0.8)' : '1px 1px 2px rgba(0,0,0,0.6)';
        }
    } else if (tooltip.isOpen()) {
        layer.closeTooltip();
    }
}

// Debounce para optimizar eventos de zoom
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Función para determinar tipo de polígono (optimizada)
function getPolygonType(layer) {
    const name = layer.properties?.name || "";
    
    if (name.toLowerCase().includes('distrito') || /^distrito\s*\d+/i.test(name)) {
        return 'distrito';
    }
    
    try {
        const latLngs = layer.getLatLngs()[0];
        const area = L.GeometryUtil.geodesicArea(latLngs);
        if (area / 1000000 > 5) return 'distrito';
    } catch (error) {
        console.log("Error calculando área:", error);
    }
    
    return 'barrio';
}

// Paleta de colores optimizada
function createColorPalette() {
    const paletteContainer = document.createElement("div");
    paletteContainer.id = "colorPalette";
    paletteContainer.style.cssText = `
        position: fixed; top: 60px; right: 10px; z-index: 1000;
        background: white; padding: 10px; border-radius: 5px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.3); display: none;
        grid-template-columns: repeat(6, 30px); gap: 5px;
        max-height: 200px; overflow-y: auto;
    `;

    const fragment = document.createDocumentFragment();
    colorPalette.forEach((color, index) => {
        const colorBox = document.createElement("div");
        colorBox.style.cssText = `
            width: 30px; height: 30px; background-color: ${color};
            border: 2px solid #ccc; border-radius: 3px; cursor: pointer;
        `;
        colorBox.title = color;
        colorBox.onclick = () => selectColor(index);
        fragment.appendChild(colorBox);
    });

    paletteContainer.appendChild(fragment);
    document.body.appendChild(paletteContainer);
    return paletteContainer;
}

// Función optimizada para selección de color
function selectColor(index) {
    currentColorIndex = index;
    const newColor = colorPalette[currentColorIndex];

    if (drawControl) map.removeControl(drawControl);
    
    drawControl = createDrawControl(newColor);
    map.addControl(drawControl);

    const palette = document.getElementById("colorPalette");
    if (palette) palette.style.display = "none";

    const colorButton = document.getElementById("colorButton");
    if (colorButton) colorButton.style.backgroundColor = newColor;
}

window.changeColor = function() {
    const palette = document.getElementById("colorPalette");
    if (palette) palette.style.display = palette.style.display === "grid" ? "none" : "grid";
};

// Conversión GeoJSON optimizada
function convertToGeoJSON(polygons) {
    return {
        type: "FeatureCollection",
        name: "barrios_managua",
        crs: { type: "name", properties: { name: "urn:ogc:def:crs:OGC:1.3:CRS84" } },
        features: polygons.map(polygon => ({
            type: "Feature",
            properties: {
                id: polygon.id,
                name: polygon.name,
                color: polygon.color,
                type: "barrio",
                admin_level: "10",
                boundary: "administrative"
            },
            geometry: {
                type: "Polygon",
                coordinates: [polygon.coordinates.map(coord => [coord[1], coord[0]])]
            }
        }))
    };
}

function convertFromGeoJSON(geoJSON) {
    if (!geoJSON?.features) return [];

    const polygons = [];
    geoJSON.features.forEach(feature => {
        const geometry = feature.geometry;
        const properties = feature.properties || {};

        const processCoordinates = (coords) => ({
            id: properties.id || generateUUID(),
            name: properties.name || "Unnamed",
            color: properties.color || colorPalette[0],
            coordinates: coords.map(coord => [coord[1], coord[0]])
        });

        if (geometry.type === "Polygon") {
            geometry.coordinates.forEach(polygonCoords => {
                polygons.push(processCoordinates(polygonCoords));
            });
        } else if (geometry.type === "MultiPolygon") {
            geometry.coordinates.forEach(multiPolygon => {
                multiPolygon.forEach(polygonCoords => {
                    polygons.push(processCoordinates(polygonCoords));
                });
            });
        }
    });

    return polygons;
}

// Guardado optimizado
window.saveToServer = async function() {
    const polygons = [];
    drawnItems.eachLayer(layer => {
        if (layer instanceof L.Polygon) {
            polygons.push({
                id: layer.properties?.id || generateUUID(),
                name: layer.properties?.name || "Polygon " + layer._leaflet_id,
                coordinates: layer.getLatLngs()[0].map(latlng => [latlng.lat, latlng.lng]),
                color: layer.properties?.color || layer.options.fillColor || colorPalette[currentColorIndex]
            });
        }
    });

    try {
        const response = await fetch(`${API_URL}/save-geojson`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(convertToGeoJSON(polygons))
        });
        console.log(response.ok ? "Data saved successfully" : "Error saving data");
    } catch (error) {
        console.error("Error:", error);
    }
};

// Carga optimizada
window.loadFromServer = async function() {
    try {
        const response = await fetch(`${API_URL}/barrios_managua.geojson`);
        if (!response.ok) {
            console.log("No existing GeoJSON data found, starting fresh");
            return;
        }

        const geoJSONData = await response.json();
        const polygons = convertFromGeoJSON(geoJSONData);
        const existingIds = new Set();

        drawnItems.eachLayer(layer => {
            if (layer.properties?.id) existingIds.add(layer.properties.id);
        });

        // Carga en lote para mejor rendimiento
        polygons.forEach(polygon => {
            if (!existingIds.has(polygon.id)) {
                try {
                    const coordinates = [...polygon.coordinates];
                    const firstCoord = coordinates[0];
                    const lastCoord = coordinates[coordinates.length - 1];
                    
                    if (firstCoord[0] !== lastCoord[0] || firstCoord[1] !== lastCoord[1]) {
                        coordinates.push([firstCoord[0], firstCoord[1]]);
                    }

                    const layer = createPolygon(coordinates, polygon);
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

// Función optimizada para prompts
function showNamePrompt(layer) {
    const name = prompt("Enter name for this polygon:", "New Polygon");
    if (name === null) {
        map.removeLayer(layer);
        return;
    }

    if (name.trim() !== "") {
        layer.properties = {
            id: generateUUID(),
            name: name.trim(),
            color: layer.options.fillColor
        };

        const polygonType = getPolygonType(layer);
        layer.bindTooltip(name.trim(), {
            ...CONFIG.tooltip,
            className: `polygon-tooltip ${polygonType}`
        });

        drawnItems.addLayer(layer);
        updateLabelsVisibility();
        setTimeout(saveToServer, 100);
    } else {
        map.removeLayer(layer);
        console.log("Please enter a valid name");
    }
}

// Actualización de etiquetas optimizada con debounce
const updateLabelsVisibility = debounce(function() {
    const currentZoom = map.getZoom();
    drawnItems.eachLayer(layer => {
        updateLayerTooltip(layer, currentZoom);
    });
}, 150);

// Inicialización optimizada del mapa
function initializeMap() {
    const mapElement = document.getElementById("map");
    if (!mapElement) {
        console.error("Map element not found");
        return;
    }

    map = L.map("map").setView([12.1147, -86.2362], 12);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap"
    }).addTo(map);

    drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    createColorPalette();

    const colorButton = document.querySelector("button");
    if (colorButton) {
        colorButton.id = "colorButton";
        colorButton.style.backgroundColor = colorPalette[currentColorIndex];
    }

    drawControl = createDrawControl(colorPalette[currentColorIndex]);
    map.addControl(drawControl);

    // Eventos optimizados
    map.on('zoomend', updateLabelsVisibility);
    map.on('moveend', updateLabelsVisibility);

    map.on(L.Draw.Event.CREATED, function(e) {
        if (e.layerType === "polygon") {
            e.layer.setStyle({
                ...CONFIG.polygonStyle,
                fillColor: colorPalette[currentColorIndex]
            });
            showNamePrompt(e.layer);
        }
    });

    map.on(L.Draw.Event.EDITED, function(e) {
        e.layers.eachLayer(layer => {
            if (layer instanceof L.Polygon) {
                const existingProperties = layer.properties || {};
                const existingColor = existingProperties.color || layer.options.fillColor;
                
                layer.setStyle({
                    ...CONFIG.polygonStyle,
                    fillColor: existingColor
                });

                layer.properties = layer.properties || {
                    id: generateUUID(),
                    color: existingColor,
                    name: "Polygon " + layer._leaflet_id
                };
                layer.properties.color = existingColor;
            }
        });
        saveToServer();
    });

    map.on(L.Draw.Event.DELETED, saveToServer);

    // Cargar datos y redimensionar
    loadFromServer();
    setTimeout(() => map.invalidateSize(), 100);
}