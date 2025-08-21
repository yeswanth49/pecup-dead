const {google} = require('googleapis');
const fs = require('fs');
(async ()=>{
  try{
    const credsPath = './google-credentials.json';
    if(!fs.existsSync(credsPath)) throw new Error('credentials file missing');
    const credentials = JSON.parse(fs.readFileSync(credsPath,'utf8'));
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes:['https://www.googleapis.com/auth/drive.file']
    });
    const drive = google.drive({version:'v3', auth});
    const res = await drive.files.create({
      requestBody:{ name:'node-large-test.pdf', parents:['1JTkhXkytL5kHEOKjRNFcHaecpgMXlv50'], description:'test upload from node-drive-test.js'},
      media:{ mimeType:'application/pdf', body: fs.createReadStream('large-test.pdf')},
      fields: 'id, webViewLink'
    });
    console.log('uploaded', res.data);
    await drive.permissions.create({ fileId: res.data.id, requestBody: { role: 'reader', type: 'anyone' } });
    console.log('permission set');
    // cleanup
    // await drive.files.delete({ fileId: res.data.id });
    process.exit(0);
  }catch(e){
    console.error('ERROR', e);
    process.exit(2);
  }
})();
