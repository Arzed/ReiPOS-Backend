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
  const referer = process.env.GOOGLE_SEARCH_REFERER || 'http://localhost:3000/';

  // 1. Coba Google Custom Search API jika credential tersedia
  if (apiKey && cx) {
    console.log('📌 [1] Menggunakan Google Custom Search API...');
    try {
      const googleUrl = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(query + ' produk')}&cx=${cx}&key=${apiKey}&searchType=image&num=3&safe=active`;
      const res = await axios.get(googleUrl, {
        headers: {
          'Referer': referer,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 8000
      });
      if (res.data && res.data.items && res.data.items.length > 0) {
        console.log('✅ [Google Search] Gambar produk profesional ditemukan!\n');
        res.data.items.forEach((item, index) => {
          console.log(`[${index + 1}] ${item.title}`);
          console.log(`    🔗 URL Gambar: ${item.link}`);
          console.log(`    📐 Ukuran    : ${item.image?.width || '?'}x${item.image?.height || '?'} px\n`);
        });
        return res.data.items[0].link;
      }
    } catch (err) {
      const errMsg = err.response?.data?.error?.message || err.message;
      console.error('⚠️ Google API Error:', errMsg);
      if (errMsg.includes('Requests from referer') || errMsg.includes('blocked')) {
        console.log('💡 Petunjuk: Google API Key Anda membatasi HTTP Referer.');
        console.log('   Tambahkan GOOGLE_SEARCH_REFERER di file .env sesuai domain/referrer yang didaftarkan di Google Cloud Console.');
      }
      console.log('🔄 Beralih ke pencarian alternatif...\n');
    }
  } else {
    console.log('ℹ️ Google API Key tidak terdeteksi di .env. Menggunakan pencarian web alternatif...\n');
  }

  // 2. Fallback: Bing Image Search
  console.log('📌 [2] Menggunakan Bing Image Search (Alternatif)...');
  try {
    const bingUrl = `https://www.bing.com/images/search?q=${encodeURIComponent(query + ' product')}&form=HDRSC2`;
    const bingRes = await axios.get(bingUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      timeout: 8000
    });

    const matches = [];
    const regex = /murl&quot;:&quot;(https?:\/\/[^&]+)&quot;/g;
    let match;
    while ((match = regex.exec(bingRes.data)) !== null) {
      if (!matches.includes(match[1])) {
        matches.push(match[1]);
      }
    }

    if (matches.length > 0) {
      console.log('✅ [Bing Search] Gambar profesional ditemukan!\n');
      matches.slice(0, 3).forEach((url, index) => {
        console.log(`[${index + 1}] Gambar #${index + 1}`);
        console.log(`    🔗 URL Gambar: ${url}\n`);
      });
      return matches[0];
    }
  } catch (err) {
    console.error('⚠️ Bing Search Error:', err.message);
  }

  // 3. Fallback: Wikimedia Commons API
  console.log('📌 [3] Menggunakan Wikimedia Commons API (Alternatif 2)...');
  try {
    const wikiUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrnamespace=6&prop=imageinfo&iiprop=url&format=json&gsrlimit=3`;
    const wikiRes = await axios.get(wikiUrl, {
      headers: { 'User-Agent': 'AiCommerceApp/1.0' },
      timeout: 6000
    });

    const pages = wikiRes.data?.query?.pages;
    if (pages) {
      const items = Object.values(pages).map(p => p.imageinfo?.[0]?.url).filter(Boolean);
      if (items.length > 0) {
        console.log('✅ [Wikimedia Search] Gambar ditemukan!\n');
        items.forEach((url, index) => {
          console.log(`[${index + 1}] 🔗 URL Gambar: ${url}`);
        });
        return items[0];
      }
    }
  } catch (err) {
    console.error('⚠️ Wikimedia Error:', err.message);
  }

  // 4. Fallback: DuckDuckGo Image Search
  console.log('📌 [4] Menggunakan DuckDuckGo Image Search...');
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
        console.log('✅ [DuckDuckGo Search] Gambar profesional ditemukan!\n');
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
