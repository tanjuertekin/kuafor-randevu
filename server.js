const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { MongoClient } = require('mongodb');

// MongoDB Bağlantı Adresi (Kendi bağlantı adresinizi buraya yapıştırın)
const MONGO_URI = 'mongodb+srv://egemynet_db_user:berber35render@cluster0.rrsufvf.mongodb.net/?appName=Cluster0';
const DB_NAME = 'kuafor_randevu_db';

let dbClient = null;
let db = null;

// MongoDB'ye Bağlanma Fonksiyonu
async function connectDB() {
  try {
    dbClient = new MongoClient(MONGO_URI);
    await dbClient.connect();
    db = dbClient.db(DB_NAME);
    console.log("MongoDB Atlas'a başarıyla bağlanıldı!");

    // Varsayılan Ayarlar Koleksiyonu Kontrolü
    const ayarlarColl = db.collection('Ayarlar');
    const count = await ayarlarColl.countDocuments();
    if (count === 0) {
      await ayarlarColl.insertMany([
        { satir: 1, sayfaAdi: "Randevular", gorunenAd: "Ethem (Yönetici)", kacinci: "ethem", sifre: "1234" },
        { satir: 2, sayfaAdi: "Randevular1", gorunenAd: "Mustafa", kacinci: "mustafa", sifre: "1234" },
        { satir: 3, sayfaAdi: "Randevular2", gorunenAd: "Berber 2", kacinci: "berber2", sifre: "1234" },
        { satir: 4, sayfaAdi: "Randevular3", gorunenAd: "Berber 3", kacinci: "berber3", sifre: "1234" },
        { satir: 5, sayfaAdi: "Randevular4", gorunenAd: "Berber 4", kacinci: "berber4", sifre: "1234" }
      ]);
    }
  } catch (err) {
    console.error("MongoDB bağlantı hatası detayı:", err.message);
  }
}

connectDB();

const HTML_FILE = path.join(__dirname, 'index.html');

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  if (!db) {
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ success: false, message: "Veritabanı bağlantısı henüz kurulamadı." }));
    return;
  }

  if (req.method === 'GET') {
    if (pathname === '/' || pathname === '/index.html') {
      if (fs.existsSync(HTML_FILE)) {
        const htmlIcerik = fs.readFileSync(HTML_FILE, 'utf8');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(htmlIcerik);
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('index.html dosyası bulunamadı!');
      }
      return;
    }

    if (pathname === '/api/randevulariGetir') {
      const sayfa = parsedUrl.query.sayfa || 'Randevular';
      const randevular = await db.collection(sayfa).find({}).toArray();
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(randevular));
      return;
    }
    
    if (pathname === '/api/tumMusterileriGetir') {
      let tumMusterilerMap = {};
      const berberSayfalari = ['Randevular', 'Randevular1', 'Randevular2', 'Randevular3', 'Randevular4'];
      
      for (const sayfa of berberSayfalari) {
        const kayitlar = await db.collection(sayfa).find({}).toArray();
        kayitlar.forEach(r => {
          if (r.musteri && r.telefon) {
            let temizIsim = r.musteri.trim().toLowerCase();
            tumMusterilerMap[temizIsim] = {
              musteri: r.musteri.trim(),
              telefon: r.telefon.trim()
            };
          }
        });
      }

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(Object.values(tumMusterilerMap)));
      return;
    }

    if (pathname === '/api/personelleriGetir') {
      const ayarlar = await db.collection('Ayarlar').find({}).toArray();
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(ayarlar));
      return;
    }
  }

  if (req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const data = JSON.parse(body || '{}');

        if (data.islem === 'giris') {
          const girilenKadi = (data.kadi || '').trim().toLowerCase();
          const girilenSifre = (data.sifre || '').trim();
          const ayarlar = await db.collection('Ayarlar').find({}).toArray();
          const kullanici = ayarlar.find(u => u.kacinci.toLowerCase() === girilenKadi && u.sifre === girilenSifre);

          if (kullanici) {
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ success: true, gorunenAd: kullanici.gorunenAd, sayfaAdi: kullanici.sayfaAdi }));
          } else {
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ success: false, message: "Kullanıcı adı veya şifre hatalı!" }));
          }
          return;
        }

        if (data.islem === 'personelGuncelle') {
          await db.collection('Ayarlar').updateOne(
            { sayfaAdi: data.sayfaAdi },
            { $set: { gorunenAd: data.gorunenAd, kacinci: data.kacinci, sifre: data.sifre } }
          );
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ success: true }));
          return;
        }

        if (data.islem === 'randevuEkle') {
          const sayfa = data.sayfa || 'Randevular';
          const yeniRandevu = {
            satir: Date.now(),
            tarih: data.tarih,
            saat: data.saat,
            musteri: data.musteri,
            telefon: data.telefon,
            personel: data.personel
          };
          
          await db.collection(sayfa).insertOne(yeniRandevu);
          
          // Ortak müşteri arşivi için ayrı bir koleksiyona da ekleyelim
          await db.collection('OrtakMusteriler').insertOne({
            tarih: yeniRandevu.tarih,
            saat: yeniRandevu.saat,
            musteri: yeniRandevu.musteri,
            telefon: yeniRandevu.telefon,
            personel: yeniRandevu.personel,
            kayitZamani: new Date().toISOString()
          });

          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ success: true }));
          return;
        }

        if (data.islem === 'sil') {
          const sayfa = data.sayfa || 'Randevular';
          await db.collection(sayfa).deleteOne({ satir: data.satir });
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ success: true }));
          return;
        }

        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, message: "Geçersiz işlem" }));
      } catch (err) {
        console.error("Sunucu Hatası:", err);
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, message: err.toString() }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ error: "Bulunamadı" }));
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Sunucu çalışıyor, port: ${PORT}`);
});
