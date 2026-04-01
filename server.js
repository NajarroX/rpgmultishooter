const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const qrcode = require('qrcode');

const server = http.createServer((req, res) => {
    // 1. SERVIR ARCHIVOS ESTÁTICOS (IMÁGENES, CSS, ETC)
    if (req.url.startsWith('/assets/')) {
        const filePath = path.join(__dirname, req.url);
        const ext = path.extname(filePath).toLowerCase();
        
        // Tipos MIME para imágenes
        const contentTypes = {
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml',
            '.ico': 'image/x-icon'
        };
        
        const contentType = contentTypes[ext] || 'application/octet-stream';
        
        fs.readFile(filePath, (err, data) => {
            if (err) {
                console.log(`❌ No se pudo cargar: ${req.url}`);
                res.writeHead(404);
                res.end('Archivo no encontrado');
                return;
            }
            console.log(`✅ Sirviendo: ${req.url}`);
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(data);
        });
        return;
    }
    
    // 2. SERVIR EL INDEX.HTML PARA LA RUTA PRINCIPAL
    if (req.url === '/') {
        fs.readFile(path.join(__dirname, 'index.html'), (err, data) => {
            if (err) {
                console.log('❌ Error cargando index.html');
                res.writeHead(500);
                res.end('Error cargando el juego');
                return;
            }
            res.writeHead(200, { 
                'Content-Type': 'text/html',
                'Cache-Control': 'no-cache' 
            });
            res.end(data);
        });
        return;
    }
    
    // 3. 404 PARA CUALQUIER OTRA RUTA
    res.writeHead(404);
    res.end('Recurso no encontrado');
});

const wss = new WebSocket.Server({ server });

let arena = null;
let controllers = [];
let players = [
    { connected: false, index: 0 },
    { connected: false, index: 1 },
    { connected: false, index: 2 },
    { connected: false, index: 3 }
];

wss.on('connection', (ws) => {
    console.log('🟢 Nuevo dispositivo conectado');
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            console.log('📨 Mensaje recibido:', data.type);
            
            if (data.type === 'register_arena') {
                arena = ws;
                console.log('🎮 ARENA conectada');
            }
            
            if (data.type === 'register_controller') {
                controllers.push(ws);
                console.log('📱 Controlador conectado');
                
                for (let i = 0; i < 4; i++) {
                    if (!players[i].connected) {
                        players[i].connected = true;
                        ws.send(JSON.stringify({
                            type: 'assigned',
                            playerIndex: i,
                            color: ['#00ffff', '#ffaa00', '#ff44ee', '#aa00ff'][i]
                        }));
                        console.log(`✅ Jugador ${i+1} asignado`);
                        break;
                    }
                }
            }
            
            if (data.type === 'input' && arena) {
                arena.send(JSON.stringify(data));
            }
            
            if (data.type === 'game_state') {
                controllers.forEach(c => {
                    if (c.readyState === WebSocket.OPEN) {
                        c.send(JSON.stringify(data));
                    }
                });
            }
        } catch (e) {
            console.log('Error:', e);
        }
    });
    
    ws.on('close', () => {
        if (ws === arena) {
            arena = null;
            console.log('🎮 ARENA desconectada');
            players.forEach(p => p.connected = false);
        }
        controllers = controllers.filter(c => c !== ws);
        console.log('📱 Controlador desconectado');
    });
});

function getLocalIP() {
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            if (net.family === 'IPv4' && !net.internal) {
                return net.address;
            }
        }
    }
    return 'localhost';
}

const PORT = 8080;
server.listen(PORT, '0.0.0.0', () => {
    const ip = getLocalIP();
    const url = `http://${ip}:${PORT}`;
    
    console.log('\n' + '='.repeat(60));
    console.log('🚀 GUARDIANES DEL TERRITORIO');
    console.log('='.repeat(60));
    console.log(`\n📡 ARENA (PC/Proyector):`);
    console.log(`   ${url}`);
    console.log(`\n📱 Para los JUGADORES (móviles):`);
    console.log(`   1. Escanea el código QR con tu móvil`);
    console.log(`   2. O ingresa manualmente: ${url}`);
    console.log(`   3. Selecciona "JUGADOR (CONTROL)"`);
    console.log('\n' + '-'.repeat(60));
    
    qrcode.toString(url, { type: 'terminal', small: true }, (err, qr) => {
        if (!err) {
            console.log('\n📱 CÓDIGO QR:\n');
            console.log(qr);
        }
        console.log('\n' + '='.repeat(60));
        console.log('Presiona Ctrl+C para detener el servidor\n');
    });
});