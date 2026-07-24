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

async function main() {
  // ─── 1. Clean database ─────────────────────────────────────────────────────
  await prisma.orderItem.deleteMany({});
  await prisma.order.deleteMany({});
  await (prisma as any).startingCash.deleteMany({});
  await (prisma as any).chatMessage.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.store.deleteMany({});
  await prisma.owner.deleteMany({});
  console.log('✓ Database cleared');

  // ─── 2. Create Owner ───────────────────────────────────────────────────────
  const hashedPassword = await bcrypt.hash('password123', 10);
  const owner = await prisma.owner.create({
    data: {
      name: 'Budi Santoso (Owner)',
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
  const stores = [];
  for (const s of storesData) {
    const store = await prisma.store.create({ data: { ownerId: owner.id, ...s } });
    stores.push(store);
  }
  console.log(`✓ Stores created: ${stores.map((s) => s.name).join(', ')}`);

  // ─── 3b. Create Employee Accounts ──────────────────────────────────────────
  const employeeHashedPassword = await bcrypt.hash('password123', 10);
  const empJakarta = await prisma.owner.create({
    data: {
      name: 'Andi Wijaya',
      email: 'pegawai.jakarta@toko.com',
      password: employeeHashedPassword,
      pin: '111111',
      whatsappNum: '6289999999001',
      role: 'employee',
      storeId: stores[0].id,
    },
  });

  const empBandung = await prisma.owner.create({
    data: {
      name: 'Budi Staff',
      email: 'pegawai.bandung@toko.com',
      password: employeeHashedPassword,
      pin: '222222',
      whatsappNum: '6289999999002',
      role: 'employee',
      storeId: stores[1].id,
    },
  });

  const empSurabaya = await prisma.owner.create({
    data: {
      name: 'Siti Aminah',
      email: 'pegawai.surabaya@toko.com',
      password: employeeHashedPassword,
      pin: '333333',
      whatsappNum: '6289999999003',
      role: 'employee',
      storeId: stores[2].id,
    },
  });

  console.log('✓ Employee accounts seeded: Andi Wijaya, Budi Staff, Siti Aminah');

  // Map of available cashiers per store
  const storeCashiers: Record<string, { id: string; name: string }[]> = {
    [stores[0].id]: [
      { id: empJakarta.id, name: 'Andi Wijaya' },
      { id: empJakarta.id, name: 'Andi Wijaya' },
      { id: empJakarta.id, name: 'Andi Wijaya' }, // 60% weight
      { id: owner.id, name: 'Budi Santoso (Owner)' },
      { id: owner.id, name: 'Budi Santoso (Owner)' },
    ],
    [stores[1].id]: [
      { id: empBandung.id, name: 'Budi Staff' },
      { id: empBandung.id, name: 'Budi Staff' },
      { id: empBandung.id, name: 'Budi Staff' }, // 60% weight
      { id: owner.id, name: 'Budi Santoso (Owner)' },
      { id: owner.id, name: 'Budi Santoso (Owner)' },
    ],
    [stores[2].id]: [
      { id: empSurabaya.id, name: 'Siti Aminah' },
      { id: empSurabaya.id, name: 'Siti Aminah' },
      { id: empSurabaya.id, name: 'Siti Aminah' }, // 70% weight
      { id: empSurabaya.id, name: 'Siti Aminah' },
      { id: owner.id, name: 'Budi Santoso (Owner)' },
    ],
  };

  // ─── 4. Product catalog ────────────────────────────────────────────────────
  const productCatalog = [
    // Kopi & Teh
    { name: 'Kopi Arabica Premium 250g', category: 'Kopi & Teh', price: 95000, costPrice: 68000, stock: rand(30, 80) },
    { name: 'Kopi Robusta Giling 500g', category: 'Kopi & Teh', price: 52000, costPrice: 36000, stock: rand(25, 60) },
    { name: 'Teh Melati Wangi Kotak', category: 'Kopi & Teh', price: 8500, costPrice: 5500, stock: rand(80, 200) },
    { name: 'Teh Hijau Premium Sachets', category: 'Kopi & Teh', price: 14000, costPrice: 9500, stock: rand(40, 100) },
    { name: 'Kopi ABC', category: 'Kopi & Teh', price: 18000, costPrice: 9000, stock: rand(60, 150) },
    { name: 'Cappuccino Instan Kaleng', category: 'Kopi & Teh', price: 22000, costPrice: 15000, stock: rand(30, 80) },
    { name: 'Teh Celup Kotak 25 Pcs', category: 'Kopi & Teh', price: 11500, costPrice: 8000, stock: rand(50, 120) },
    // Minuman
    { name: 'Aqua', category: 'Minuman', price: 4000, costPrice: 1500, stock: rand(150, 400) },
    { name: 'Air Mineral 1.5L', category: 'Minuman', price: 6500, costPrice: 4200, stock: rand(100, 250) },
    { name: 'Minuman Isotonik 500ml', category: 'Minuman', price: 8000, costPrice: 5500, stock: rand(80, 200) },
    { name: 'Susu UHT Full Cream 250ml', category: 'Minuman', price: 7000, costPrice: 5000, stock: rand(80, 180) },
    // Makanan Ringan
    { name: 'Indomie', category: 'Makanan Ringan', price: 3500, costPrice: 1000, stock: rand(200, 500) },
    { name: 'Mie Instan Ayam Bawang', category: 'Makanan Ringan', price: 3500, costPrice: 2600, stock: rand(200, 500) },
    { name: 'Kerupuk Udang Besar', category: 'Makanan Ringan', price: 12000, costPrice: 8500, stock: rand(40, 100) },
    { name: 'Snack Kentang Goreng 60g', category: 'Makanan Ringan', price: 11000, costPrice: 7500, stock: rand(50, 120) },
    // Sembako
    { name: 'Beras Putih Premium 5kg', category: 'Sembako', price: 78000, costPrice: 65000, stock: rand(20, 50) },
    { name: 'Minyak Goreng Sawit 2L', category: 'Sembako', price: 36000, costPrice: 29000, stock: rand(15, 45) },
    { name: 'Gula Pasir Kristal 1kg', category: 'Sembako', price: 17500, costPrice: 14000, stock: rand(30, 90) },
    { name: 'Tepung Terigu Serbaguna 1kg', category: 'Sembako', price: 13000, costPrice: 9800, stock: rand(40, 100) },
  ];

  const storeProducts: Record<string, any[]> = {};
  for (const store of stores) {
    const createdProducts = [];
    for (let i = 0; i < productCatalog.length; i++) {
      const p = productCatalog[i];
      const prod = await prisma.product.create({
        data: {
          storeId: store.id,
          name: p.name,
          category: p.category,
          price: p.price,
          costPrice: p.costPrice,
          discount: 0,
          stock: p.stock,
          barcode: `899${store.id.substring(0, 3)}${i.toString().padStart(4, '0')}`,
        },
      });
      createdProducts.push(prod);
    }
    storeProducts[store.id] = createdProducts;
  }
  console.log('✓ Product catalog seeded across stores');

  // ─── 5. Create Starting Cash for Today ─────────────────────────────────────
  const todayStr = new Date().toISOString().split('T')[0];
  for (const store of stores) {
    await (prisma as any).startingCash.create({
      data: {
        storeId: store.id,
        amount: 500000,
        date: todayStr,
        createdById: owner.id,
        createdByName: owner.name,
      },
    });
  }
  console.log('✓ Starting cash seeded for today (Rp 500.000)');

  // ─── 6. Generate Orders (Last 30 Days) ─────────────────────────────────────
  const now = new Date();
  const paymentMethods = ['CASH', 'CASH', 'CASH', 'QRIS', 'QRIS'];
  let totalOrders = 0;

  const volumeConfig = [
    { store: stores[0], ordersPerDay: { min: 8, max: 15 } },
    { store: stores[1], ordersPerDay: { min: 5, max: 10 } },
    { store: stores[2], ordersPerDay: { min: 6, max: 12 } },
  ];

  for (const config of volumeConfig) {
    const { store, ordersPerDay } = config;
    const products = storeProducts[store.id];
    const cashiers = storeCashiers[store.id];

    for (let dayOffset = 30; dayOffset >= 0; dayOffset--) {
      const dayStart = new Date(now);
      dayStart.setDate(now.getDate() - dayOffset);
      dayStart.setHours(0, 0, 0, 0);

      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);

      const isWeekend = dayStart.getDay() === 0 || dayStart.getDay() === 6;
      const weekendFactor = isWeekend ? 1.3 : 1.0;

      const numOrders = Math.round(rand(ordersPerDay.min, ordersPerDay.max) * weekendFactor);

      for (let oIdx = 0; oIdx < numOrders; oIdx++) {
        const orderTime = randDate(dayStart, dayEnd);
        orderTime.setHours(rand(8, 20), rand(0, 59), rand(0, 59), 0);

        const numItems = rand(1, 4);
        const shuffled = [...products].sort(() => Math.random() - 0.5);
        const selectedProducts = shuffled.slice(0, numItems);

        const items = selectedProducts.map((p) => ({
          productId: p.id,
          quantity: rand(1, 4),
          price: p.price,
        }));

        let totalAmount = 0;
        let totalProfit = 0;

        for (const item of items) {
          const prod = products.find((p) => p.id === item.productId)!;
          totalAmount += item.price * item.quantity;
          totalProfit += (item.price - prod.costPrice) * item.quantity;
        }

        const paymentMethod = paymentMethods[rand(0, paymentMethods.length - 1)];
        const cashier = cashiers[rand(0, cashiers.length - 1)];

        await prisma.order.create({
          data: {
            storeId: store.id,
            totalAmount,
            totalProfit,
            paymentStatus: 'PAID',
            paymentMethod,
            cashierId: cashier.id,
            cashierName: cashier.name,
            createdAt: orderTime,
            items: {
              create: items.map((i) => ({
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
    console.log(`✓ ${store.name}: orders & cashier records generated`);
  }

  console.log('\n═══════════════════════════════════════════════════');
  console.log('✅ Database seeding finished successfully!');
  console.log(`   Owner     : ${owner.name} (${owner.email})`);
  console.log(`   Employees : Andi Wijaya, Budi Staff, Siti Aminah`);
  console.log(`   Outlets   : ${stores.length} cabang`);
  console.log(`   Orders    : ~${totalOrders} transaksi kasir terdaftar`);
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
