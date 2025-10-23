const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Endpoint para guardar GeoJSON
app.post('/save-geojson', (req, res) => {
  try {
    const geoJSONData = req.body;
    const filePath = path.join(__dirname, 'public', 'barrios_managua.geojson');
    
    fs.writeFileSync(filePath, JSON.stringify(geoJSONData, null, 2));
    
    res.json({ success: true, message: 'GeoJSON saved successfully' });
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
  console.log(`Server running on http://localhost:${PORT}`);
});