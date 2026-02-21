
const express = require("express");
const app = express();
const pino = require("pino");
const { toBuffer } = require("qrcode");
const path = require('path');
const fs = require("fs-extra");
const { Boom } = require("@hapi/boom");

const PORT = process.env.PORT || 5000;
const MESSAGE = process.env.MESSAGE || `
╔════◇
║ *『 WAOW YOU CHOOSE PETER-MD 』*
║ _You complete first step to making Bot._
╚════════════════════════╝
╔═════◇
║  『••• 𝗩𝗶𝘀𝗶𝘁 𝗙𝗼𝗿 𝗛𝗲𝗹𝗽 •••』
║ *Ytube:* _youtube.com/basanzietech_
║ *Owner:* _https://wa.me/25567778080_
║ *Note :*_Don't provide your SESSION_ID to_
║ _anyone otherwise that can access chats_
╚════════════════════════╝
`;

// Clear auth directory on startup to avoid session conflicts
if (fs.existsSync('./auth_info_baileys')) {
    fs.emptyDirSync(path.join(__dirname, 'auth_info_baileys'));
}

app.get("/", async (req, res) => {
    const Baileys = require("@whiskeysockets/baileys");
    const { 
        default: SuhailWASocket, 
        useMultiFileAuthState, 
        Browsers, 
        delay, 
        DisconnectReason, 
        fetchLatestBaileysVersion
    } = Baileys;

    async function startBot() {
        const { state, saveCreds } = await useMultiFileAuthState(path.join(__dirname, 'auth_info_baileys'));
        const { version } = await fetchLatestBaileysVersion();
        
        console.log(`Starting WhatsApp connection with version ${version.join('.')}`);

        try {
            const sock = SuhailWASocket({
                version,
                printQRInTerminal: false,
                logger: pino({ level: "silent" }),
                // CUSTOM BROWSER NAME: This helps WhatsApp recognize the device properly and stay linked
                browser: ["PETER-MD", "Chrome", "1.0.0"],
                auth: state,
                connectTimeoutMs: 60000,
                defaultQueryTimeoutMs: 0,
                keepAliveIntervalMs: 10000,
                emitOwnEvents: true,
                fireInitQueries: true,
                generateHighQualityLinkPreview: false,
                syncFullHistory: false,
                markOnlineOnConnect: true,
                // Additional options for stability
                getMessage: async (key) => { return { conversation: 'PETER-MD-BOT' } }
            });

            sock.ev.on("connection.update", async (update) => {
                const { connection, lastDisconnect, qr } = update;
                
                if (qr) {
                    if (!res.headersSent) {
                        res.setHeader('Content-Type', 'image/png');
                        try {
                            const qrBuffer = await toBuffer(qr);
                            res.end(qrBuffer);
                        } catch (e) {
                            console.error("QR Generation Error:", e);
                        }
                    }
                }

                if (connection === "open") {
                    await delay(5000); // Wait for connection to fully stabilize
                    const user = sock.user.id;
                    const credsFile = path.join(__dirname, 'auth_info_baileys', 'creds.json');

                    if (fs.existsSync(credsFile)) {
                        const creds = fs.readFileSync(credsFile);
                        // FORMAT: PETER;;;[BASE64_CREDS]
                        // This matches the format expected by PETER-MD's MakeSession function
                        const sessionId = "PETER;;;" + Buffer.from(creds).toString('base64');
                        
                        console.log(`Session ID generated for PETER-MD: ${sessionId}`);

                        const sentMsg = await sock.sendMessage(user, { text: sessionId });
                        await sock.sendMessage(user, { text: MESSAGE }, { quoted: sentMsg });
                        
                        await delay(3000);
                        console.log("Session details sent. Device is now linked safely.");
                        
                        // We do NOT logout here. We let the connection stay for a bit to ensure WhatsApp 
                        // registers the "PETER-MD" browser correctly.
                        // The user can now close the web page.
                    }
                }

                if (connection === "close") {
                    const reason = new Boom(lastDisconnect?.error)?.output.statusCode;
                    console.log("Connection closed. Reason code:", reason);

                    if (reason === DisconnectReason.restartRequired || 
                        reason === DisconnectReason.connectionLost || 
                        reason === DisconnectReason.connectionClosed || 
                        reason === DisconnectReason.timedOut) {
                        console.log("Attempting to reconnect for stability...");
                        startBot().catch(err => console.error("Reconnection Error:", err));
                    } else if (reason === DisconnectReason.loggedOut) {
                        console.log("Device logged out. You need to scan again.");
                        // Clear the auth folder so the next request starts fresh
                        try { fs.emptyDirSync(path.join(__dirname, 'auth_info_baileys')); } catch(e) {}
                    }
                }
            });

            sock.ev.on('creds.update', saveCreds);

        } catch (err) {
            console.error("Error in startBot:", err);
            if (!res.headersSent) {
                res.status(500).send("Connection error occurred. Please refresh.");
            }
        }
    }

    startBot().catch(err => {
        console.error("Global startBot error:", err);
    });
});

app.listen(PORT, () => console.log(`PETER-MD QR Server running on port ${PORT}`));
