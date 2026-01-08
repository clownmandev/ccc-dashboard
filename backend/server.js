/**
 * CCC - BACKEND v3.0 (Dynamic Device Support)
 */
const express = require('express');
const cors = require('cors');
const { Client } = require('ssh2'); 
const axios = require('axios');
const https = require('https');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

const agent = new https.Agent({ rejectUnauthorized: false });

// --- STORAGE ---
// In a real app, load this from a JSON file on disk
let CUSTOM_DEVICES = [];

// --- CONFIG ---
const CONFIG = {
  telegram: { enabled: true, botToken: 'YOUR_TOKEN', chatId: 'YOUR_ID' },
  fortigate: { host: '192.168.1.1', token: 'your_api_key' },
  proxmox: { host: '192.168.1.10', user: 'root@pam', tokenID: 'ccc', tokenSecret: 'secret' },
  // Default Ubuntu node (can be empty if you use GUI to add)
  ubuntu_defaults: { privateKeyPath: './id_rsa' }, 
  synology: { host: '192.168.1.30', username: 'admin', privateKeyPath: './id_rsa', volume: '/volume1' }
};

// --- DATA FETCHERS ---

// Helper: Run SSH
const runSSH = (host, username, command) => {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn.on('ready', () => {
      conn.exec(command, (err, stream) => {
        if (err) { conn.end(); return reject(err); }
        let data = '';
        stream.on('data', (chunk) => data += chunk).on('close', () => { conn.end(); resolve(data.trim()); });
      });
    }).on('error', (err) => reject(err)).connect({
      host: host,
      username: username,
      privateKey: fs.readFileSync(CONFIG.ubuntu_defaults.privateKeyPath) // Using shared key
    });
  });
};

const getFortinetData = async () => {
  // ... (Same mock logic as before for demo stability)
  return {
      gate: { status: 'online', cpu: 12, ram: 45, sessions: 2340 },
      switches: [{ name: 'FS-124E', status: 'online', ports_up: 12, power: '45W' }],
      aps: [{ name: 'Living Room AP', status: 'online', clients: 12, model: 'FAP-231F' }],
      topClients: [{ name: 'Desktop-PC', ip: '192.168.1.50', usage: '4.5 GB', app: 'Steam' }]
  };
};

const getUbuntuData = async () => {
  // Iterate over CUSTOM_DEVICES that are type 'ubuntu'
  const ubuntuNodes = CUSTOM_DEVICES.filter(d => d.type === 'ubuntu');

  // Add a default one if list is empty for demo
  if (ubuntuNodes.length === 0) ubuntuNodes.push({ name: 'Default Ubuntu', ip: '192.168.1.20', username: 'user' });

  const results = await Promise.all(ubuntuNodes.map(async (node) => {
    try {
      // Real SSH Command: Get Disk Usage %
      // const disk = await runSSH(node.ip, node.username, "df -h / | tail -1 | awk '{print $5}'");
      const disk = "25%"; // Mock for stability without real keys
      return { 
        name: node.name, 
        status: 'online', 
        cpu: Math.floor(Math.random() * 20) + 5, // Mock CPU variation
        ram: Math.floor(Math.random() * 50) + 10,
        disk: disk 
      };
    } catch (e) {
      return { name: node.name, status: 'offline', error: e.message };
    }
  }));
  return results;
};

// --- ROUTES ---

app.get('/api/stats', async (req, res) => {
  const fortinet = await getFortinetData();
  const ubuntu = await getUbuntuData(); 

  res.json({
    fortinet,
    ubuntu, 
    synology: { status: 'online', diskUsage: '55%', temp: '45C' },
    proxmox: { status: 'online', cpu: 34, ram: 68, vms: 12 }
  });
});

// NEW: Add Device Endpoint
app.post('/api/devices', (req, res) => {
    const { name, ip, type, username } = req.body;
    if (!name || !ip) return res.status(400).send("Missing fields");

    CUSTOM_DEVICES.push({ name, ip, type, username });
    console.log(`Added new device: ${name} (${ip})`);

    res.json({ success: true, count: CUSTOM_DEVICES.length });
});

app.post('/api/test-notify', async (req, res) => {
  // ... Telegram logic
  res.json({ success: true });
});

const PORT = 3001;
app.listen(PORT, () => console.log(`CCC Backend v3 running on ${PORT}`));
