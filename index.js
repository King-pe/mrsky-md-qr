const express = require('express');
const app = express();
const path = require('path');
const bodyParser = require("body-parser");
const fs = require('fs-extra');

const PORT = process.env.PORT || 8000;

// Ensure temp directory exists
const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}

// Clear temp on startup
fs.emptyDirSync(tempDir);

// Routes
const qrRouter = require('./qr');
const pairRouter = require('./pair');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/qr', qrRouter);
app.use('/code', pairRouter);

app.get('/pair', (req, res) => {
    res.sendFile(path.join(__dirname, 'pair.html'));
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'main.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 MRSKY-MD Server running on http://localhost:${PORT}`);
    console.log(`Scan QR at http://localhost:${PORT}/qr`);
});

module.exports = app;
