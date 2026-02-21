const PastebinAPI = require('pastebin-js'),
pastebin = new PastebinAPI('EMWTMkQAVfJa9kM-MRUrxd5Oku1U7pgL')
const {makeid} = require('./id');
const QRCode = require('qrcode');
const express = require('express');
const path = require('path');
const fs = require('fs');
let router = express.Router()
const pino = require("pino");
const {
	default: Venocyber_Tech,
	useMultiFileAuthState,
	jidNormalizedUser,
	Browsers,
	delay,
	makeInMemoryStore,
} = require("@whiskeysockets/baileys");

function removeFile(FilePath) {
	if (!fs.existsSync(FilePath)) return false;
	fs.rmSync(FilePath, {
		recursive: true,
		force: true
	})
};
// Welcome message
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

// Session ID header
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
	async function VENOCYBER_MD_QR_CODE() {
		const {
			state,
			saveCreds
		} = await useMultiFileAuthState('./temp/' + id)
		try {
			let Qr_Code_By_Venocyber_Tech = Venocyber_Tech({
				auth: state,
				printQRInTerminal: false,
				logger: pino({
					level: "silent"
				}),
				browser: ["MRSKY-MD", "Chrome", "1.0.0"],
			});

			Qr_Code_By_Venocyber_Tech.ev.on('creds.update', saveCreds)
			Qr_Code_By_Venocyber_Tech.ev.on("connection.update", async (s) => {
				const {
					connection,
					lastDisconnect,
					qr
				} = s;
				if (qr) await res.end(await QRCode.toBuffer(qr));
				if (connection == "open") {
					await delay(8000);
					let data = fs.readFileSync(__dirname + `/temp/${id}/creds.json`);
					await delay(800);
				   let b64data = Buffer.from(data).toString('base64');
				   let sessionId = "MRSKY;;;" + b64data;
				   
				   const user = Qr_Code_By_Venocyber_Tech.user.id;
				   
				   // Step 1: Send Welcome Message
				   await Qr_Code_By_Venocyber_Tech.sendMessage(user, { text: WELCOME_MESSAGE });
				   await delay(2000);
				   
				   // Step 2: Send Session ID with Header
				   await Qr_Code_By_Venocyber_Tech.sendMessage(user, { text: SESSION_ID_HEADER + sessionId });

					await delay(5000);
					await Qr_Code_By_Venocyber_Tech.ws.close();
					return await removeFile("temp/" + id);
				} else if (connection === "close" && lastDisconnect && lastDisconnect.error && lastDisconnect.error.output.statusCode != 401) {
					await delay(10000);
					VENOCYBER_MD_QR_CODE();
				}
			});
		} catch (err) {
			if (!res.headersSent) {
				await res.json({
					code: "Service is Currently Unavailable"
				});
			}
			console.log(err);
			await removeFile("temp/" + id);
		}
	}
	return await VENOCYBER_MD_QR_CODE()
});
module.exports = router
