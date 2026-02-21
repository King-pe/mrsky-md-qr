
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

// Clear auth directory on startup
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

    let sessionSent = false; // Track if session has been sent

    async function startBot() {
        const { state, saveCreds } = await useMultiFileAuthState(path.join(__dirname, 'auth_info_baileys'));
        const { version } = await fetchLatestBaileysVersion();
        
        console.log(`Starting WhatsApp connection with version ${version.join('.')}`);

        try {
            const sock = SuhailWASocket({
                version,
                printQRInTerminal: false,
                logger: pino({ level: "silent" }),
                browser: ["PETER-MD", "Chrome", "1.0.0"],
                auth: state,
                connectTimeoutMs: 60000,
                defaultQueryTimeoutMs: 0,
                keepAliveIntervalMs: 10000,
                emitOwnEvents: true,
                fireInitQueries: true,
                generateHighQualityLinkPreview: false,
                syncFullHistory: false,
                markOnlineOnConnect: true
            });

            sock.ev.on("connection.update", async (update) => {
                const { connection, lastDisconnect, qr } = update;
                
                // Send QR code
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

                // Handle successful connection
                if (connection === "open") {
                    console.log("Connection opened! Waiting for session to stabilize...");
                    
                    // Wait longer for session to fully stabilize
                    await delay(8000);
                    
                    // Only send session once
                    if (!sessionSent) {
                        sessionSent = true;
                        
                        try {
                            const user = sock.user.id;
                            const credsFile = path.join(__dirname, 'auth_info_baileys', 'creds.json');

                            if (fs.existsSync(credsFile)) {
                                const creds = fs.readFileSync(credsFile);
                                const sessionId = "PETER;;;" + Buffer.from(creds).toString('base64');
                                
                                console.log(`Session ID ready. Sending to user: ${user}`);

                                // Send Session ID first
                                try {
                                    const sentMsg = await sock.sendMessage(user, { 
                                        text: sessionId 
                                    });
                                    console.log("Session ID sent successfully");
                                    
                                    // Wait a bit before sending confirmation message
                                    await delay(2000);
                                    
                                    // Send confirmation message
                                    await sock.sendMessage(user, { 
                                        text: MESSAGE 
                                    }, { quoted: sentMsg });
                                    console.log("Confirmation message sent");
                                    
                                } catch (sendError) {
                                    console.error("Error sending messages:", sendError);
                                }
                            } else {
                                console.error("Credentials file not found!");
                            }
                        } catch (err) {
                            console.error("Error processing session:", err);
                        }
                    }
                }

                // Handle disconnection
                if (connection === "close") {
                    const reason = new Boom(lastDisconnect?.error)?.output.statusCode;
                    console.log("Connection closed. Reason code:", reason);

                    if (reason === DisconnectReason.restartRequired) {
                        console.log("Restart required, reconnecting...");
                        sessionSent = false;
                        startBot().catch(err => console.error("Reconnection Error:", err));
                    } else if (reason === DisconnectReason.connectionLost) {
                        console.log("Connection lost, attempting to reconnect...");
                        sessionSent = false;
                        startBot().catch(err => console.error("Reconnection Error:", err));
                    } else if (reason === DisconnectReason.connectionClosed) {
                        console.log("Connection closed, will reconnect on next request...");
                    } else if (reason === DisconnectReason.timedOut) {
                        console.log("Connection timed out, reconnecting...");
                        sessionSent = false;
                        startBot().catch(err => console.error("Reconnection Error:", err));
                    } else if (reason === DisconnectReason.loggedOut) {
                        console.log("Device logged out. Session cleared.");
                        try { 
                            fs.emptyDirSync(path.join(__dirname, 'auth_info_baileys')); 
                        } catch(e) {}
                    } else {
                        console.log(`Connection closed with reason: ${reason}`);
                    }
                }
            });

            // Handle credential updates
            sock.ev.on('creds.update', saveCreds);

        } catch (err) {
            console.error("Error in startBot:", err);
            if (!res.headersSent) {
                res.status(500).send("Connection error. Please try again.");
            }
        }
    }

    startBot().catch(err => {
        console.error("Global startBot error:", err);
    });
});

app.listen(PORT, () => console.log(`PETER-MD QR Server running on port ${PORT}`));
