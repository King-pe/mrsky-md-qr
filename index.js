
const express = require("express");
const app = express();
const pino = require("pino");
const { toBuffer } = require("qrcode");
const path = require('path');
const fs = require("fs-extra");
const { Boom } = require("@hapi/boom");

const PORT = process.env.PORT || 5000;

// Welcome message that appears first
const WELCOME_MESSAGE = process.env.WELCOME_MESSAGE || `
╔════◇════════════════════════╗
║  🎉 *KARIBU MRSKY-MD* 🎉
║
║ _Umefaulu kuscan QR code!_
║ _Sasa unaweza kuanza kutumia bot._
║
║ 📋 *Hatua Inayofuata:*
║ 1. Nusuru SESSION_ID kutoka ujumbe ujao
║ 2. Tumia SESSION_ID kwenye bot yako
║ 3. Jifunze kuhusu amri za bot
║
║ ⚠️ *MUHIMU:*
║ _Usishare SESSION_ID yako na mtu yeyote!_
║ _Kila mtu anayemiliki SESSION_ID_
║ _anaweza kufikia ujumbe wako wote._
║
║ 📞 *Msaada:*
║ Owner: https://wa.me/25567778080
║ YouTube: youtube.com/basanzietech
║
╚════◇════════════════════════╝
`;

// Session ID message
const SESSION_ID_MESSAGE = process.env.SESSION_ID_MESSAGE || `
╔════◇════════════════════════╗
║  🔐 *SESSION_ID YAKO* 🔐
║
║ _Hii ni SESSION_ID yako ya kipekee._
║ _Tumia kwenye bot configuration._
║
║ ⚠️ *ONYO LA USALAMA:*
║ • Usishare SESSION_ID hii!
║ • Usiweke kwenye GitHub au mahali ya umma
║ • Kila mtu anayemiliki hii anaweza kufikia chats
║
║ 📌 *Jinsi ya Kutumia:*
║ Nakili SESSION_ID hii na uweke kwenye:
║ - Environment variable: SESSION_ID
║ - .env file: SESSION_ID=...
║ - Bot configuration file
║
╚════◇════════════════════════╝

SESSION_ID YAKO:
`;

// Clear auth directory on startup to ensure fresh QR every time
if (fs.existsSync('./auth_info_baileys')) {
    fs.emptyDirSync(path.join(__dirname, 'auth_info_baileys'));
}

app.get("/", async (req, res) => {
    const Baileys = require("@whiskeysockets/baileys");
    const { 
        default: SuhailWASocket, 
        useMultiFileAuthState, 
        delay, 
        DisconnectReason, 
        fetchLatestBaileysVersion
    } = Baileys;

    let sessionSent = false;
    let sock = null;

    async function startBot() {
        try {
            const { state, saveCreds } = await useMultiFileAuthState(path.join(__dirname, 'auth_info_baileys'));
            const { version } = await fetchLatestBaileysVersion();
            
            console.log(`Starting WhatsApp connection with version ${version.join('.')}`);

            sock = SuhailWASocket({
                version,
                printQRInTerminal: false,
                logger: pino({ level: "silent" }),
                browser: ["MRSKY-MD", "Chrome", "1.0.0"],
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

            // Handle QR code display
            sock.ev.on("connection.update", async (update) => {
                const { connection, lastDisconnect, qr } = update;
                
                // Send QR code to browser
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
                    console.log("✅ Connection opened! Waiting for session to stabilize...");
                    
                    if (!sessionSent) {
                        sessionSent = true;
                        
                        try {
                            // Wait for session to fully stabilize
                            await delay(8000);
                            
                            const user = sock.user.id;
                            console.log(`👤 Connected user: ${user}`);
                            
                            const credsPath = path.join(__dirname, 'auth_info_baileys');
                            const credsFile = path.join(credsPath, 'creds.json');

                            // Check if creds file exists
                            if (fs.existsSync(credsFile)) {
                                console.log("📄 Reading credentials file...");
                                const creds = fs.readFileSync(credsFile);
                                const sessionId = "MRSKY;;;" + Buffer.from(creds).toString('base64');
                                
                                console.log(`🔐 Session ID generated (length: ${sessionId.length})`);

                                try {
                                    // Send Welcome Message
                                    console.log("📤 Sending welcome message...");
                                    await sock.sendMessage(user, { text: WELCOME_MESSAGE });
                                    console.log("✅ Welcome message sent");
                                    
                                    // Wait a bit
                                    await delay(3000);
                                    
                                    // Send Session ID with message
                                    console.log("📤 Sending session ID message...");
                                    const fullMessage = SESSION_ID_MESSAGE + sessionId;
                                    await sock.sendMessage(user, { text: fullMessage });
                                    console.log("✅ Session ID message sent successfully");
                                    
                                } catch (sendError) {
                                    console.error("❌ Error sending messages:", sendError.message);
                                }
                            } else {
                                console.error("❌ Credentials file not found at:", credsFile);
                                console.log("📁 Available files:", fs.readdirSync(credsPath));
                            }
                        } catch (err) {
                            console.error("❌ Error processing session:", err.message);
                        }
                    }
                }

                // Handle disconnection
                if (connection === "close") {
                    const reason = new Boom(lastDisconnect?.error)?.output.statusCode;
                    console.log("⚠️ Connection closed. Reason code:", reason);

                    if (reason === DisconnectReason.restartRequired) {
                        console.log("🔄 Restart required, reconnecting...");
                        sessionSent = false;
                        await delay(3000);
                        startBot().catch(err => console.error("Reconnection Error:", err));
                    } else if (reason === DisconnectReason.connectionLost) {
                        console.log("🔄 Connection lost, attempting to reconnect...");
                        sessionSent = false;
                        await delay(3000);
                        startBot().catch(err => console.error("Reconnection Error:", err));
                    } else if (reason === DisconnectReason.connectionClosed) {
                        console.log("⏸️ Connection closed, will reconnect on next request...");
                    } else if (reason === DisconnectReason.timedOut) {
                        console.log("🔄 Connection timed out, reconnecting...");
                        sessionSent = false;
                        await delay(3000);
                        startBot().catch(err => console.error("Reconnection Error:", err));
                    } else if (reason === DisconnectReason.loggedOut) {
                        console.log("🚪 Device logged out. Session cleared.");
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
            console.error("❌ Error in startBot:", err.message);
            if (!res.headersSent) {
                res.status(500).send("Connection error. Please try again.");
            }
        }
    }

    startBot().catch(err => {
        console.error("❌ Global startBot error:", err.message);
    });
});

app.listen(PORT, () => console.log(`🚀 MRSKY-MD QR Server running on port ${PORT}`));
