import https from 'https';
import fs from 'fs';

https.get('https://openrouter.ai/api/v1/models', (resp) => {
  let data = '';
  resp.on('data', (chunk) => { data += chunk; });
  resp.on('end', () => {
    try {
      const models = JSON.parse(data).data;
      const slugs = models.map(m => m.id).sort().join('\n');
      fs.writeFileSync('all_models.txt', slugs);
      console.log("Wrote all slugs to all_models.txt");
    } catch(err) {
      console.error(err);
    }
  });
});
