const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3001;

app.use(cors());

// 📈 SOLO ESTO CAMBIA: AUMENTAR LÍMITES
app.use(express.json({ 
  limit: '2gb'  // ⬆️ 2GB para datasets grandes
}));

app.use(express.urlencoded({ 
  limit: '2gb', 
  extended: true 
}));

app.use(express.static('public'));

// Endpoint para guardar GeoJSON
app.post('/save-geojson', (req, res) => {
  try {
    const geoJSONData = req.body;
    const filePath = path.join(__dirname, 'public', 'barrios_managua.geojson');
    
    // Log para ver el tamaño real
    const dataSizeMB = (JSON.stringify(geoJSONData).length / (1024*1024)).toFixed(2);
    console.log(`💾 Saving: ${dataSizeMB} MB, ${geoJSONData.features?.length || 0} features`);
    
    fs.writeFileSync(filePath, JSON.stringify(geoJSONData, null, 2));
    
    res.json({ 
      success: true, 
      message: `GeoJSON saved successfully (${dataSizeMB} MB)` 
    });
  } catch (error) {
    console.error('Error saving GeoJSON:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Servir el archivo GeoJSON
app.get('/barrios_managua.geojson', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'barrios_managua.geojson');
  
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ error: 'GeoJSON file not found' });
  }
});

app.listen(PORT, () => {
  console.log(`🗺️ Server running on http://localhost:${PORT}`);
  console.log(`📊 Max payload size: 2GB`);
});