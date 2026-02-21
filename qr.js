const { makeid } = require('./id');
const QRCode = require('qrcode');
const express = require('express');
const path = require('path');
const fs = require('fs-extra');
let router = express.Router();
const pino = require("pino");
const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    DisconnectReason,
    fetchLatestBaileysVersion,
    Browsers
} = require("@whiskeysockets/baileys");

function removeFile(FilePath) {
    if (!fs.existsSync(FilePath)) return false;
    fs.rmSync(FilePath, { recursive: true, force: true });
}

const WELCOME_MESSAGE = `
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
╚════════════════════════════╝
`;

const SESSION_ID_HEADER = `
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
╚════════════════════════════╝

SESSION_ID YAKO:
`;

router.get('/', async (req, res) => {
    const id = makeid();
    async function startQR() {
        const { state, saveCreds } = await useMultiFileAuthState(path.join(__dirname, 'temp', id));
        const { version } = await fetchLatestBaileysVersion();

        try {
            let sock = makeWASocket({
                auth: state,
                printQRInTerminal: false,
                logger: pino({ level: "silent" }),
                browser: Browsers.macOS("Desktop"), // Most reliable for linking
                version
            });

            sock.ev.on('creds.update', saveCreds);
            sock.ev.on("connection.update", async (update) => {
                const { connection, lastDisconnect, qr } = update;

                if (qr) {
                    if (!res.headersSent) {
                        res.setHeader('Content-Type', 'image/png');
                        try {
                            const qrBuffer = await QRCode.toBuffer(qr);
                            res.end(qrBuffer);
                        } catch (e) {
                            console.error("QR Error:", e);
                        }
                    }
                }

                if (connection === "open") {
                    console.log(`✅ Device Linked: ${sock.user.id}`);
                    await delay(10000); // Allow time for creds.json to be written

                    try {
                        const credsFile = path.join(__dirname, 'temp', id, 'creds.json');
                        if (fs.existsSync(credsFile)) {
                            const credsData = fs.readFileSync(credsFile);
                            const b64 = Buffer.from(credsData).toString('base64');
                            const sessionId = "MRSKY;;;" + b64;

                            const userJid = sock.user.id;
                            
                            // Send Messages to user inbox
                            await sock.sendMessage(userJid, { text: WELCOME_MESSAGE });
                            await delay(2000);
                            await sock.sendMessage(userJid, { text: SESSION_ID_HEADER + sessionId });

                            console.log("✅ Session ID sent to inbox");
                        }
                    } catch (err) {
                        console.error("Session Generation Error:", err);
                    }

                    await delay(5000);
                    sock.ws.close();
                    removeFile(path.join(__dirname, 'temp', id));
                }

                if (connection === "close") {
                    const reason = lastDisconnect?.error?.output?.statusCode;
                    if (reason !== DisconnectReason.loggedOut && reason !== 401) {
                        // Attempt reconnect if not a logout
                        // startQR(); // Optional: might cause loop if not careful
                    } else {
                        removeFile(path.join(__dirname, 'temp', id));
                    }
                }
            });

        } catch (err) {
            console.error("Bot Error:", err);
            if (!res.headersSent) res.status(500).send("Error connecting");
            removeFile(path.join(__dirname, 'temp', id));
        }
    }
    startQR();
});

module.exports = router;
