const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

let whatsappClient;

// Ensure this executes ONLY on the Server (Node.js) so Next.js doesn't crash trying to run Chromium in the browser UI
if (typeof window === 'undefined') {
  
  // Singleton pattern for Next.js Fast Refresh. This stops 500 Chromium instances opening at once!
  if (!global.whatsappClient) {
    global.whatsappClient = new Client({
      authStrategy: new LocalAuth(), // Saves the session! You only ever scan the QR code once.
      puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      }
    });

    global.whatsappClient.on('qr', (qr) => {
      console.log('\n==================================================================');
      console.log('🚨 HOSTEL WARDEN: SCAN THIS QR CODE WITH YOUR WHATSAPP MOBILE APP 🚨');
      console.log('==================================================================\n');
      qrcode.generate(qr, { small: true });
    });

    global.whatsappClient.on('ready', () => {
      console.log('\n✅ NEXT.JS: WhatsApp Web Client is natively ONLINE & Ready to text Parents!\n');
    });

    global.whatsappClient.on('auth_failure', () => {
      console.error('\n❌ NEXT.JS: WhatsApp Web Authentication completely failed. You may need to delete the .wwebjs_auth folder and rescan QR.\n');
    });

    console.log('\n⏳ NEXT.JS: Booting Headless Chromium for WhatsApp Web Gateway...\n');
    global.whatsappClient.initialize();
  }
  
  whatsappClient = global.whatsappClient;
}

export default whatsappClient;
