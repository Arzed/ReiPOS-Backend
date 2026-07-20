import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// Helper: random integer between min and max (inclusive)
function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Helper: random date in a date range
function randDate(start: Date, end: Date): Date {
  const ms = start.getTime() + Math.random() * (end.getTime() - start.getTime());
  return new Date(ms);
}

// Helper: get date N days ago from now
function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(rand(8, 21), rand(0, 59), rand(0, 59), 0);
  return d;
}

async function main() {
  // ─── 1. Clean database ─────────────────────────────────────────────────────
  await prisma.orderItem.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.store.deleteMany({});
  await prisma.owner.deleteMany({});
  console.log('✓ Database cleared');

  // ─── 2. Create Owner ───────────────────────────────────────────────────────
  const hashedPassword = await bcrypt.hash('password123', 10);
  const owner = await prisma.owner.create({
    data: {
      name: 'Budi Santoso',
      email: 'owner@toko.com',
      password: hashedPassword,
      pin: '123456',
      whatsappNum: '6281234567890',
    },
  });
  console.log(`✓ Owner created: ${owner.name}`);

  // ─── 3. Create 3 Stores ────────────────────────────────────────────────────
  const storesData = [
    { name: 'Toko ReiPOS - Jakarta (Pusat)', location: 'Jl. Raya Sudirman No. 42, Jakarta Pusat' },
    { name: 'Toko ReiPOS - Bandung', location: 'Jl. Dago No. 120, Bandung' },
    { name: 'Toko ReiPOS - Surabaya', location: 'Jl. Basuki Rahmat No. 5, Surabaya' },
  ];
  const stores = await Promise.all(
    storesData.map(s => prisma.store.create({ data: { ownerId: owner.id, ...s } }))
  );
  console.log(`✓ Stores created: ${stores.map(s => s.name).join(', ')}`);

  // ─── 3b. Create Employee Accounts ──────────────────────────────────────────
  const employeeHashedPassword = await bcrypt.hash('password123', 10);
  const employeesData = [
    {
      name: 'Andi Wijaya',
      email: 'pegawai.jakarta@toko.com',
      password: employeeHashedPassword,
      pin: '111111',
      whatsappNum: '6289999999001',
      role: 'employee',
      storeId: stores[0].id,
    },
    {
      name: 'Budi Staff',
      email: 'pegawai.bandung@toko.com',
      password: employeeHashedPassword,
      pin: '222222',
      whatsappNum: '6289999999002',
      role: 'employee',
      storeId: stores[1].id,
    },
    {
      name: 'Siti Aminah',
      email: 'pegawai.surabaya@toko.com',
      password: employeeHashedPassword,
      pin: '333333',
      whatsappNum: '6289999999003',
      role: 'employee',
      storeId: stores[2].id,
    },
  ];
  for (const empData of employeesData) {
    await prisma.owner.create({ data: empData });
  }
  console.log('✓ Employee accounts seeded');

  // ─── 4. Product catalog (shared base, ~33-34 products per store = ~100 total) ─
  // Categories: Kopi & Teh, Minuman Kemasan, Makanan Ringan, Sembako, Produk Segar, Kebersihan
  const productCatalog = [
    // Kopi & Teh (8 produk)
    { name: 'Kopi Arabica Premium 250g',   category: 'Kopi & Teh', price: 95000, costPrice: 68000, discount: 0,  stock: rand(30,80) },
    { name: 'Kopi Robusta Giling 500g',    category: 'Kopi & Teh', price: 52000, costPrice: 36000, discount: 5,  stock: rand(25,60) },
    { name: 'Teh Melati Wangi Kotak',      category: 'Kopi & Teh', price: 8500,  costPrice: 5500,  discount: 0,  stock: rand(80,200) },
    { name: 'Teh Hijau Premium Sachets',   category: 'Kopi & Teh', price: 14000, costPrice: 9500,  discount: 0,  stock: rand(40,100) },
    { name: 'Kopi ABC',            category: 'Kopi & Teh', price: 18000, costPrice: 9000,  discount: 0,  stock: rand(60,150) },
    { name: 'Cappuccino Instan Kaleng',    category: 'Kopi & Teh', price: 22000, costPrice: 15000, discount: 10, stock: rand(30,80) },
    { name: 'Teh Celup Kotak 25 Pcs',     category: 'Kopi & Teh', price: 11500, costPrice: 8000,  discount: 0,  stock: rand(50,120) },
    { name: 'Jahe Merah Instan Sachet',    category: 'Kopi & Teh', price: 6000,  costPrice: 4000,  discount: 0,  stock: rand(70,150) },
    // Minuman Kemasan (6 produk)
    { name: 'Aqua',                 category: 'Minuman', price: 4000,  costPrice: 1500,  discount: 0,  stock: rand(150,400) },
    { name: 'Air Mineral 1.5L',            category: 'Minuman', price: 6500,  costPrice: 4200,  discount: 0,  stock: rand(100,250) },
    { name: 'Minuman Isotonik 500ml',      category: 'Minuman', price: 8000,  costPrice: 5500,  discount: 0,  stock: rand(80,200) },
    { name: 'Jus Jeruk Kotak 250ml',       category: 'Minuman', price: 7500,  costPrice: 5000,  discount: 0,  stock: rand(60,150) },
    { name: 'Susu UHT Full Cream 250ml',   category: 'Minuman', price: 7000,  costPrice: 5000,  discount: 0,  stock: rand(80,180) },
    { name: 'Susu Kental Manis Kaleng',    category: 'Minuman', price: 12000, costPrice: 9000,  discount: 0,  stock: rand(40,100) },
    // Makanan Ringan (7 produk)
    { name: 'Indomie',              category: 'Makanan Ringan', price: 3500,  costPrice: 1000,  discount: 0,  stock: rand(200,500) },
    { name: 'Mie Instan Rasa Ayam Bawang', category: 'Makanan Ringan', price: 3500,  costPrice: 2600,  discount: 0,  stock: rand(200,500) },
    { name: 'Kerupuk Udang Besar',         category: 'Makanan Ringan', price: 12000, costPrice: 8500,  discount: 0,  stock: rand(40,100) },
    { name: 'Biskuit Cream Rasa Coklat',   category: 'Makanan Ringan', price: 9500,  costPrice: 6500,  discount: 5,  stock: rand(60,150) },
    { name: 'Snack Kentang Goreng 60g',    category: 'Makanan Ringan', price: 11000, costPrice: 7500,  discount: 0,  stock: rand(50,120) },
    { name: 'Wafer Renyah Coklat',         category: 'Makanan Ringan', price: 5000,  costPrice: 3500,  discount: 0,  stock: rand(80,200) },
    { name: 'Permen Mint Botol',           category: 'Makanan Ringan', price: 8000,  costPrice: 5500,  discount: 0,  stock: rand(60,150) },
    // Sembako (6 produk)
    { name: 'Gula Pasir Kristal 1kg',      category: 'Sembako', price: 18500, costPrice: 15000, discount: 0,  stock: 4 }, // Low stock!
    { name: 'Minyak Goreng Sawit 2L',      category: 'Sembako', price: 34000, costPrice: 28000, discount: 5,  stock: 3 }, // Low stock!
    { name: 'Beras Premium 5kg',           category: 'Sembako', price: 78000, costPrice: 63000, discount: 0,  stock: rand(15,40) },
    { name: 'Tepung Terigu Segitiga 1kg',  category: 'Sembako', price: 13000, costPrice: 10000, discount: 0,  stock: rand(30,80) },
    { name: 'Garam Dapur Beryodium',       category: 'Sembako', price: 4500,  costPrice: 3000,  discount: 0,  stock: rand(60,150) },
    { name: 'Kecap Manis Botol 135ml',     category: 'Sembako', price: 9000,  costPrice: 6500,  discount: 0,  stock: rand(40,100) },
    // Produk Segar / Olahan (3 produk)
    { name: 'Telur Ayam Negeri (isi 10)',  category: 'Produk Segar', price: 28000, costPrice: 22000, discount: 0,  stock: rand(10,30) },
    { name: 'Sosis Ayam Siap Masak',       category: 'Produk Segar', price: 18500, costPrice: 13000, discount: 0,  stock: rand(20,50) },
    { name: 'Nugget Ayam Frozen 500g',     category: 'Produk Segar', price: 32000, costPrice: 24000, discount: 5,  stock: rand(15,40) },
    // Kebersihan & Perawatan (4 produk)
    { name: 'Sabun Mandi Batang',          category: 'Kebersihan', price: 6500,  costPrice: 4500,  discount: 0,  stock: rand(60,150) },
    { name: 'Sampo Sachet Rambut Hitam',   category: 'Kebersihan', price: 2500,  costPrice: 1600,  discount: 0,  stock: rand(100,300) },
    { name: 'Deterjen Bubuk 1kg',          category: 'Kebersihan', price: 22000, costPrice: 16000, discount: 0,  stock: rand(30,80) },
    { name: 'Tisu Kering Kotak 200 Lembar',category: 'Kebersihan', price: 15000, costPrice: 10500, discount: 0,  stock: rand(40,100) },
  ];
  // Total: 8+6+7+6+3+4 = 34 produk per toko × 3 toko = 102 produk total ≈ 100

  // ─── 5. Insert products per store ─────────────────────────────────────────
  const storeProducts: { [storeId: string]: any[] } = {};

  for (let sIdx = 0; sIdx < stores.length; sIdx++) {
    const store = stores[sIdx];
    const products = [];

    for (let pIdx = 0; pIdx < productCatalog.length; pIdx++) {
      const cat = productCatalog[pIdx];
      const barcode = `${10000 + sIdx * 100 + pIdx}`;
      // Slightly vary stock per store
      const stockVariance = rand(-5, 5);
      const actualStock = Math.max(1, (cat.stock as number) + stockVariance);

      const product = await prisma.product.create({
        data: {
          storeId: store.id,
          name: cat.name,
          category: cat.category,
          barcode,
          price: cat.price,
          costPrice: cat.costPrice,
          discount: cat.discount,
          stock: actualStock,
        },
      });
      products.push(product);
    }

    storeProducts[store.id] = products;
    console.log(`✓ ${store.name}: ${products.length} produk dibuat`);
  }

  // ─── 6. Generate orders for last 3 months ──────────────────────────────────
  // Jakarta: busiest, Bandung: medium, Surabaya: lower volume
  const volumeConfig = [
    { store: stores[0], ordersPerDay: { min: 8,  max: 20 } }, // Jakarta
    { store: stores[1], ordersPerDay: { min: 5,  max: 13 } }, // Bandung
    { store: stores[2], ordersPerDay: { min: 3,  max: 8  } }, // Surabaya
  ];

  const now = new Date();
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(now.getMonth() - 3);
  threeMonthsAgo.setHours(0, 0, 0, 0);

  // Payment method probability
  const paymentMethods = ['CASH', 'CASH', 'CASH', 'QRIS', 'QRIS']; // 60% cash, 40% QRIS

  let totalOrders = 0;

  for (const config of volumeConfig) {
    const { store, ordersPerDay } = config;
    const products = storeProducts[store.id];

    // Iterate day by day for 90 days
    for (let dayOffset = 90; dayOffset >= 0; dayOffset--) {
      const dayStart = new Date(now);
      dayStart.setDate(now.getDate() - dayOffset);
      dayStart.setHours(0, 0, 0, 0);

      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);

      // Weekends get 1.4x more orders
      const isWeekend = dayStart.getDay() === 0 || dayStart.getDay() === 6;
      const weekendFactor = isWeekend ? 1.4 : 1.0;

      // More recent = slightly more orders (growth trend)
      const growthFactor = 1 + (90 - dayOffset) / 90 * 0.3; // up to 30% more recent

      const numOrders = Math.round(
        rand(ordersPerDay.min, ordersPerDay.max) * weekendFactor * growthFactor
      );

      for (let oIdx = 0; oIdx < numOrders; oIdx++) {
        // Random time during business hours
        const orderTime = randDate(dayStart, dayEnd);
        orderTime.setHours(rand(7, 21), rand(0, 59), rand(0, 59), 0);

        // Each order has 1-5 different products
        const numItems = rand(1, 5);
        const shuffled = [...products].sort(() => Math.random() - 0.5);
        const selectedProducts = shuffled.slice(0, numItems);

        const items = selectedProducts.map(p => ({
          productId: p.id,
          quantity: rand(1, 5),
          price: p.price,
        }));

        let totalAmount = 0;
        let totalProfit = 0;

        for (const item of items) {
          const prod = products.find(p => p.id === item.productId)!;
          totalAmount += item.price * item.quantity;
          totalProfit += (item.price - prod.costPrice) * item.quantity;
        }

        const paymentMethod = paymentMethods[rand(0, paymentMethods.length - 1)];

        await prisma.order.create({
          data: {
            storeId: store.id,
            totalAmount,
            totalProfit,
            paymentStatus: 'PAID',
            paymentMethod,
            createdAt: orderTime,
            items: {
              create: items.map(i => ({
                productId: i.productId,
                quantity: i.quantity,
                price: i.price,
              })),
            },
          },
        });

        totalOrders++;
      }
    }

    console.log(`✓ ${store.name}: orders selesai dibuat`);
  }

  // ─── 7. Summary ────────────────────────────────────────────────────────────
  const totalProducts = Object.values(storeProducts).reduce((sum, p) => sum + p.length, 0);
  console.log('\n═══════════════════════════════════════════════════');
  console.log('✅ Database seeding selesai!');
  console.log(`   Owner     : ${owner.name} (${owner.email})`);
  console.log(`   Outlets   : ${stores.length} cabang`);
  console.log(`   Produk    : ${totalProducts} total (rata-rata ${Math.round(totalProducts / stores.length)} per cabang)`);
  console.log(`   Orders    : ~${totalOrders} transaksi (3 bulan terakhir)`);
  console.log('   Password  : password123 | PIN: 123456 | WA: 6281234567890');
  console.log('═══════════════════════════════════════════════════');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
