const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const DB_FILE = path.join(__dirname, 'db.json');
const ORTAK_DB_FILE = path.join(__dirname, 'ortakdb.json');
const HTML_FILE = path.join(__dirname, 'index.html');

function dbOku() {
  if (!fs.existsSync(DB_FILE)) {
    const ilkVeri = {
      Ayarlar: [
        { satir: 1, sayfaAdi: "Randevular", gorunenAd: "Ethem (Yönetici)", kacinci: "ethem", sifre: "1234" },
        { satir: 2, sayfaAdi: "Randevular1", gorunenAd: "Mustafa", kacinci: "mustafa", sifre: "1234" },
        { satir: 3, sayfaAdi: "Randevular2", gorunenAd: "Berber 2", kacinci: "berber2", sifre: "1234" },
        { satir: 4, sayfaAdi: "Randevular3", gorunenAd: "Berber 3", kacinci: "berber3", sifre: "1234" },
        { satir: 5, sayfaAdi: "Randevular4", gorunenAd: "Berber 4", kacinci: "berber4", sifre: "1234" }
      ],
      Randevular: [],
      Randevular1: [],
      Randevular2: [],
      Randevular3: [],
      Randevular4: []
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(ilkVeri, null, 2), 'utf8');
  }
  const icerik = fs.readFileSync(DB_FILE, 'utf8');
  let data = JSON.parse(icerik);
  
  // Eskiden kalan Musteriler alanı varsa temizle
  if (data.Musteriler) {
    delete data.Musteriler;
    dbYaz(data);
  }
  
  return data;
}

function dbYaz(veri) {
  fs.writeFileSync(DB_FILE, JSON.stringify(veri, null, 2), 'utf8');
}

// Arka plandaki ortak müşteri arşiv dosyasına kayıt ekleyen fonksiyon
function ortakDbyeEkle(yeniMusteri) {
  try {
    let ortakMusteriler = [];
    if (fs.existsSync(ORTAK_DB_FILE)) {
      const icerik = fs.readFileSync(ORTAK_DB_FILE, 'utf8');
      ortakMusteriler = JSON.parse(icerik);
    }
    
    // Aynı telefon veya isim daha önce eklenmemişse veya genel arşiv için direkt ekle
    ortakMusteriler.push({
      tarih: yeniMusteri.tarih,
      saat: yeniMusteri.saat,
      musteri: yeniMusteri.musteri,
      telefon: yeniMusteri.telefon,
      personel: yeniMusteri.personel,
      kayitZamani: new Date().toISOString()
    });

    fs.writeFileSync(ORTAK_DB_FILE, JSON.stringify(ortakMusteriler, null, 2), 'utf8');
  } catch (err) {
    console.error("Ortak DB kayıt hatası:", err);
  }
}

const server = http.createServer((req, res) => {
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
  const db = dbOku();

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
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(db[sayfa] || []));
      return;
    }
    
    // Tüm berberlerin randevularından tekilleştirilmiş müşteri listesini döndüren API
    if (pathname === '/api/tumMusterileriGetir') {
      let tumMusterilerMap = {};
      const berberSayfalari = ['Randevular', 'Randevular1', 'Randevular2', 'Randevular3', 'Randevular4'];
      
      berberSayfalari.forEach(sayfa => {
        if (db[sayfa] && Array.isArray(db[sayfa])) {
          db[sayfa].forEach(r => {
            if (r.musteri && r.telefon) {
              let temizIsim = r.musteri.trim().toLowerCase();
              tumMusterilerMap[temizIsim] = {
                musteri: r.musteri.trim(),
                telefon: r.telefon.trim()
              };
            }
          });
        }
      });

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(Object.values(tumMusterilerMap)));
      return;
    }

    if (pathname === '/api/personelleriGetir') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(db.Ayarlar || []));
      return;
    }
  }

  if (req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body || '{}');

        if (data.islem === 'giris') {
          const girilenKadi = (data.kadi || '').trim().toLowerCase();
          const girilenSifre = (data.sifre || '').trim();
          const kullanici = db.Ayarlar.find(u => u.kacinci.toLowerCase() === girilenKadi && u.sifre === girilenSifre);

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
          const personel = db.Ayarlar.find(u => u.sayfaAdi === data.sayfaAdi);
          if (personel) {
            personel.gorunenAd = data.gorunenAd;
            personel.kacinci = data.kacinci;
            personel.sifre = data.sifre;
            dbYaz(db);
          }
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ success: true }));
          return;
        }

        if (data.islem === 'randevuEkle') {
          const sayfa = data.sayfa || 'Randevular';
          if (!db[sayfa]) db[sayfa] = [];
          const yeniRandevu = {
            satir: Date.now(),
            tarih: data.tarih,
            saat: data.saat,
            musteri: data.musteri,
            telefon: data.telefon,
            personel: data.personel
          };
          
          db[sayfa].push(yeniRandevu);
          dbYaz(db);

          // Arka planda ortak veritabanına da kaydet (kullanıcıyı yormaz)
          ortakDbyeEkle(yeniRandevu);

          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ success: true }));
          return;
        }

        if (data.islem === 'sil') {
          const sayfa = data.sayfa || 'Randevular';
          if (db[sayfa]) {
            db[sayfa] = db[sayfa].filter(r => r.satir !== data.satir);
            dbYaz(db);
          }
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

server.listen(4000, () => {
  console.log('Sunucu çalışıyor: http://localhost:4000 adresini tarayıcınıza yazın.');
});