/**
 * Script untuk menguji pencarian gambar produk profesional di Google & DuckDuckGo.
 * 
 * Cara Penggunaan:
 * 1. Tanpa Google API Key (Menggunakan DuckDuckGo Image Search):
 *    node scripts/test-google-image-search.js "ABC Kopi Susu 30 gr"
 * 
 * 2. Dengan Google Custom Search API Key:
 *    Set environment variable GOOGLE_SEARCH_API_KEY dan GOOGLE_SEARCH_ENGINE_ID di .env
 *    Lalu jalankan:
 *    node scripts/test-google-image-search.js "Indomie Goreng Spesial 85g"
 */

const axios = require('axios');
require('dotenv').config();

async function searchProductImage(query) {
  console.log(`\n🔍 Mencari gambar profesional untuk: "${query}"...\n`);

  const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
  const cx = process.env.GOOGLE_SEARCH_ENGINE_ID;

  // 1. Coba Google Custom Search API jika credential tersedia
  if (apiKey && cx) {
    console.log('📌 Menggunakan Google Custom Search API...');
    try {
      const googleUrl = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(query + ' produk')}&cx=${cx}&key=${apiKey}&searchType=image&num=3&safe=active`;
      const res = await axios.get(googleUrl, { timeout: 8000 });
      if (res.data && res.data.items && res.data.items.length > 0) {
        console.log('\n✅ [Google Search] Gambar produk profesional ditemukan!\n');
        res.data.items.forEach((item, index) => {
          console.log(`[${index + 1}] ${item.title}`);
          console.log(`    🔗 URL Gambar: ${item.link}`);
          console.log(`    📐 Ukuran    : ${item.image.width}x${item.image.height} px\n`);
        });
        return res.data.items[0].link;
      }
    } catch (err) {
      console.error('⚠️ Google API Error:', err.response?.data?.error?.message || err.message);
      console.log('🔄 Beralih ke pencarian alternatif...\n');
    }
  } else {
    console.log('ℹ️ Google API Key tidak terdeteksi di .env. Menggunakan pencarian web alternatif (DuckDuckGo)...\n');
  }

  // 2. Fallback: DuckDuckGo Image Search (Tanpa API Key)
  try {
    const tokenUrl = `https://duckduckgo.com/?q=${encodeURIComponent(query + ' product png jpg')}`;
    const tokenRes = await axios.get(tokenUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 5000,
    });

    const vqdMatch = tokenRes.data.match(/vqd=["']([^"']+)["']/);
    if (vqdMatch) {
      const vqd = vqdMatch[1];
      const imgApiUrl = `https://duckduckgo.com/i.js?q=${encodeURIComponent(query + ' product')}&o=json&vqd=${vqd}`;
      const imgRes = await axios.get(imgApiUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        timeout: 5000,
      });

      if (imgRes.data && imgRes.data.results && imgRes.data.results.length > 0) {
        console.log('✅ [Pencarian Web Alternatif] Gambar profesional ditemukan!\n');
        imgRes.data.results.slice(0, 3).forEach((item, index) => {
          console.log(`[${index + 1}] ${item.title}`);
          console.log(`    🔗 URL Gambar: ${item.image}`);
          console.log(`    📐 Ukuran    : ${item.width}x${item.height} px\n`);
        });
        return imgRes.data.results[0].image;
      }
    }
  } catch (err) {
    console.error('⚠️ DuckDuckGo Error:', err.message);
  }

  console.log('❌ Tidak ada gambar ditemukan.');
  return null;
}

// Ambil argumen pencarian dari command line terminal
const queryArg = process.argv.slice(2).join(' ') || 'ABC Kopi Susu 30 gr';
searchProductImage(queryArg);
