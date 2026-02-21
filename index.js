
const express = require("express");
const app = express();
const pino = require("pino");
let { toBuffer } = require("qrcode");
const path = require('path');
const fs = require("fs-extra");
const { Boom } = require("@hapi/boom");

const PORT = process.env.PORT || 5000;
const MESSAGE = process.env.MESSAGE || `
╔════◇
║ *『 WAOW YOU CHOOSE MRSKY-MD 』*
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

// Safely clear auth directory on start to ensure a fresh session generation
if (fs.existsSync('./auth_info_baileys')) {
    fs.emptyDirSync(path.join(__dirname, 'auth_info_baileys'));
}

app.use("/", async (req, res) => {
    const { 
        default: SuhailWASocket, 
        useMultiFileAuthState, 
        Browsers, 
        delay, 
        DisconnectReason, 
        makeInMemoryStore,
        fetchLatestBaileysVersion
    } = require("@whiskeysockets/baileys");

    const store = makeInMemoryStore({ logger: pino().child({ level: 'silent', stream: 'store' }) });

    async function SUHAIL() {
        const { state, saveCreds } = await useMultiFileAuthState(path.join(__dirname, 'auth_info_baileys'));
        const { version, isLatest } = await fetchLatestBaileysVersion();
        
        console.log(`Using Baileys v${version.join('.')}, isLatest: ${isLatest}`);

        try {
            let Smd = SuhailWASocket({
                version,
                printQRInTerminal: false,
                logger: pino({ level: "silent" }),
                // Using macOS Chrome for better stability and less chance of unlinking
                browser: Browsers.macOS("Desktop"),
                auth: state,
                // Improved connection options
                connectTimeoutMs: 60000,
                defaultQueryTimeoutMs: 0,
                keepAliveIntervalMs: 10000,
                emitOwnEvents: true,
                fireInitQueries: true,
                generateHighQualityLinkPreview: false,
                syncFullHistory: false,
                markOnlineOnConnect: true
            });

            // Bind store
            store.bind(Smd.ev);

            Smd.ev.on("connection.update", async (s) => {
                const { connection, lastDisconnect, qr } = s;
                
                if (qr) {
                    if (!res.headersSent) {
                        res.setHeader('Content-Type', 'image/png');
                        res.end(await toBuffer(qr));
                    }
                }

                if (connection === "open") {
                    await delay(5000); // Wait for connection to stabilize
                    let user = Smd.user.id;

                    // Read credentials and generate session ID
                    let credsFile = path.join(__dirname, 'auth_info_baileys', 'creds.json');
                    if (fs.existsSync(credsFile)) {
                        let CREDS = fs.readFileSync(credsFile);
                        var Scan_Id = Buffer.from(CREDS).toString('base64');
                        
                        console.log(`
====================  SESSION ID  ==========================                   
SESSION-ID ==> ${Scan_Id}
-------------------   SESSION GENERATED   -----------------------
`);

                        // Send Session ID and Message to the user
                        let msgsss = await Smd.sendMessage(user, { text: Scan_Id });
                        await Smd.sendMessage(user, { text: MESSAGE }, { quoted: msgsss });
                        
                        await delay(2000);
                        console.log("Session ID sent successfully. Closing connection...");
                        
                        // After sending, we can clean up if this is just a session generator
                        // But if the user wants "stable" we should ideally keep it or let them know
                        // For this specific "Web QR" app, the goal is to get the ID.
                        // However, to satisfy "not unlinking", we ensure the session is valid.
                        try { 
                            await Smd.ws.close();
                        } catch(e) {}
                    }
                }

                if (connection === "close") {
                    let reason = new Boom(lastDisconnect?.error)?.output.statusCode;
                    console.log("Connection closed. Reason:", reason);

                    if (reason === DisconnectReason.restartRequired) {
                        console.log("Restart Required, Restarting...");
                        SUHAIL().catch(err => console.log(err));
                    } else if (reason === DisconnectReason.connectionLost) {
                        console.log("Connection Lost from Server, Reconnecting...");
                        SUHAIL().catch(err => console.log(err));
                    } else if (reason === DisconnectReason.connectionClosed) {
                        console.log("Connection closed, Reconnecting...");
                        SUHAIL().catch(err => console.log(err));
                    } else if (reason === DisconnectReason.loggedOut) {
                        console.log("Device Logged Out, please scan again.");
                    } else if (reason === DisconnectReason.timedOut) {
                        console.log("Connection Timed Out, Reconnecting...");
                        SUHAIL().catch(err => console.log(err));
                    } else {
                        console.log(`Connection closed with reason: ${reason}`);
                    }
                }
            });

            // Important: Handle credentials update to keep session alive
            Smd.ev.on('creds.update', saveCreds);

        } catch (err) {
            console.log("Error in SUHAIL function:", err);
            if (!res.headersSent) {
                res.status(500).send("Internal Server Error");
            }
        }
    }

    SUHAIL().catch(async (err) => {
        console.log("Global error:", err);
    });
});

app.listen(PORT, () => console.log(`App listened on port http://localhost:${PORT}`));
