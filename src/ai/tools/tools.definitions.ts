import OpenAI from 'openai';

export function getAiToolsDefinitions(allowedTools?: string[]): OpenAI.Chat.Completions.ChatCompletionTool[] {
  const allTools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
    {
      type: 'function',
      function: {
        name: 'getRevenue',
        description: 'Mengambil total omzet/pendapatan dalam rentang tanggal tertentu.',
        parameters: {
          type: 'object',
          properties: {
            startDate: { type: 'string', description: 'Format ISO (YYYY-MM-DD)' },
            endDate: { type: 'string', description: 'Format ISO (YYYY-MM-DD)' },
            allStores: { type: 'boolean', description: 'Ambil omzet dari semua cabang toko milik Owner' },
            storeName: { type: 'string', description: 'Nama cabang toko tertentu (misal: Jakarta, Bandung)' },
          },
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'getOrders',
        description: 'Mengambil pesanan terbaru.',
        parameters: {
          type: 'object',
          properties: {
            limit: { type: 'number', description: 'Jumlah pesanan maksimal yang diambil (default 5)' },
            allStores: { type: 'boolean', description: 'Ambil pesanan dari semua cabang toko milik Owner' },
            storeName: { type: 'string', description: 'Nama cabang toko tertentu (misal: Jakarta, Bandung)' },
          },
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'createProduct',
        description: 'Menambahkan produk baru ke toko.',
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Nama produk' },
            price: { type: 'number', description: 'Harga jual produk' },
            costPrice: { type: 'number', description: 'Harga modal/beli produk' },
            stock: { type: 'number', description: 'Stok awal produk' },
            barcode: { type: 'string', description: 'Barcode atau SKU produk' },
            storeName: { type: 'string', description: 'Nama cabang toko' },
          },
          required: ['name', 'price', 'costPrice', 'stock', 'storeName'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'updateStock',
        description: 'Memperbarui stok produk yang sudah ada.',
        parameters: {
          type: 'object',
          properties: {
            barcodeOrId: { type: 'string', description: 'Barcode atau ID dari produk' },
            stock: { type: 'number', description: 'Jumlah stok baru' },
          },
          required: ['barcodeOrId', 'stock'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'deleteProduct',
        description: 'Menghapus produk dari toko.',
        parameters: {
          type: 'object',
          properties: {
            barcodeOrId: { type: 'string', description: 'Barcode atau ID produk yang ingin dihapus' },
          },
          required: ['barcodeOrId'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'lowStock',
        description: 'Mendapatkan daftar produk dengan stok menipis (di bawah ambang batas).',
        parameters: {
          type: 'object',
          properties: {
            threshold: { type: 'number', description: 'Batas minimal stok (default 5)' },
          },
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'getProduct',
        description: 'Mencari rincian produk berdasarkan nama atau barcode.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Nama atau barcode produk' },
          },
          required: ['query'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'profitReport',
        description: 'Menghitung total estimasi keuntungan bersih (laba kotor/bersih) berdasarkan pesanan yang sudah dibayar.',
        parameters: {
          type: 'object',
          properties: {
            period: { type: 'string', description: 'HariIni, MingguIni, BulanIni, atau Total' },
            allStores: { type: 'boolean', description: 'Ambil laporan profit dari semua cabang toko milik Owner' },
          },
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'forecastSales',
        description: 'Memprediksi berapa hari lagi stok suatu produk akan habis berdasarkan rata-rata penjualan harian.',
        parameters: {
          type: 'object',
          properties: {
            barcodeOrId: { type: 'string', description: 'Barcode atau ID dari produk' },
          },
          required: ['barcodeOrId'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'checkMonthlyTarget',
        description: 'Mengecek pencapaian target penjualan bulanan toko dan memberikan saran produk bermargin tinggi.',
        parameters: {
          type: 'object',
          properties: {
            storeName: { type: 'string', description: 'Nama cabang toko tertentu' },
          },
        },
      },
    },
  ];

  if (!allowedTools || allowedTools.length === 0) {
    return allTools;
  }

  return allTools.filter(
    (tool) => tool.type === 'function' && allowedTools.includes(tool.function.name),
  );
}
