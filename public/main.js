window.addEventListener("load", initializeMap);

let map, drawnItems;
const API_URL = "http://localhost:3001";

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

// Colores radicalmente diferentes para cada distrito
const DISTRICT_COLORS = [
    "#FF0000", // Rojo vivo
    "#00FF00", // Verde puro  
    "#0000FF", // Azul puro
    "#FFFF00", // Amarillo
    "#FF00FF", // Magenta
    "#00FFFF", // Cian
    "#FF8000", // Naranja fuerte
    "#8000FF", // Violeta
    "#00FF80", // Verde azulado
    "#FF0080", // Rosa intenso
    "#80FF00", // Lima
    "#0080FF", // Azul eléctrico
    "#FF8040", // Naranja pastel
    "#40FF80", // Verde menta
    "#8040FF"  // Lila
];

// Color único para todos los barrios
const BARRIO_COLOR = "#97009c";

let districtColorMap = new Map();

function getDistrictColor(districtName) {
    if (!districtColorMap.has(districtName)) {
        const colorIndex = districtColorMap.size % DISTRICT_COLORS.length;
        districtColorMap.set(districtName, DISTRICT_COLORS[colorIndex]);
    }
    return districtColorMap.get(districtName);
}

function generateUUID() {
    return crypto?.randomUUID?.() || 
        ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
            (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
        );
}

function createPolygon(coordinates, properties = {}) {
    const polygonType = getPolygonType({ properties });
    
    // Solo los distritos obtienen colores diferentes
    const color = polygonType === 'distrito' 
        ? getDistrictColor(properties.name)
        : BARRIO_COLOR;
    
    const layer = L.polygon(coordinates, {
        ...CONFIG.polygonStyle,
        fillColor: color
    });

    layer.properties = {
        id: properties.id || generateUUID(),
        name: properties.name || "Unnamed",
        color: color,
        type: polygonType
    };

    layer.bindTooltip(layer.properties.name, {
        ...CONFIG.tooltip,
        className: `polygon-tooltip ${polygonType}`
    });

    return layer;
}

function updateLayerTooltip(layer, currentZoom) {
    if (!(layer instanceof L.Polygon) || !layer.properties?.name) return;

    const tooltip = layer.getTooltip();
    if (!tooltip) return;

    const polygonType = getPolygonType(layer);
    const minZoom = CONFIG.zoomLevels[polygonType];
    
    if (currentZoom >= minZoom) {
        if (!tooltip.isOpen()) layer.openTooltip();
    } else if (tooltip.isOpen()) {
        layer.closeTooltip();
    }
}

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

function getPolygonType(layer) {
    const name = layer.properties?.name || "";
    
    if (name.toLowerCase().includes('distrito') || /^distrito\s*\d+/i.test(name)) {
        return 'distrito';
    }
    
    try {
        const latLngs = layer.getLatLngs()[0];
        const area = L.GeometryUtil.geodesicArea(latLngs);
        if (area / 1000000 > 15) return 'distrito';
    } catch (error) {
        console.log("Error calculating area:", error);
    }
    
    return 'barrio';
}

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
    if (!geoJSON) return [];

    const polygons = [];
    
    if (geoJSON.type === "FeatureCollection" && geoJSON.features) {
        geoJSON.features.forEach(feature => {
            processFeature(feature, polygons);
        });
    } else if (geoJSON.type === "Feature") {
        processFeature(geoJSON, polygons);
    }
    
    return polygons;
}

function processFeature(feature, polygons) {
    const geometry = feature.geometry;
    const properties = feature.properties || {};
    
    const getName = () => {
        if (properties.N_Comun) return properties.N_Comun;
        if (properties.name) return properties.name;
        return "Unnamed Polygon";
    };
    
    const polygonName = getName();
    const polygonId = properties.id || properties.ID_UNICO || properties.id_unico_1 || generateUUID();
    const polygonType = getPolygonType({ properties });
    
    // Determinar el color basado en el tipo de polígono
    const color = polygonType === 'distrito' 
        ? getDistrictColor(polygonName)
        : BARRIO_COLOR;
    
    const processCoordinates = (coords) => ({
        id: polygonId,
        name: polygonName,
        color: color,
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
}

window.saveToServer = async function() {
    const polygons = [];
    drawnItems.eachLayer(layer => {
        if (layer instanceof L.Polygon) {
            polygons.push({
                id: layer.properties?.id || generateUUID(),
                name: layer.properties?.name || "Polygon " + layer._leaflet_id,
                coordinates: layer.getLatLngs()[0].map(latlng => [latlng.lat, latlng.lng]),
                color: layer.properties?.color || layer.options.fillColor
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

const updateLabelsVisibility = debounce(function() {
    const currentZoom = map.getZoom();
    drawnItems.eachLayer(layer => {
        updateLayerTooltip(layer, currentZoom);
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
        attribution: "&copy; OpenStreetMap"
    }).addTo(map);

    drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    map.on('zoomend', updateLabelsVisibility);
    map.on('moveend', updateLabelsVisibility);

    loadFromServer();
    setTimeout(() => map.invalidateSize(), 100);
}