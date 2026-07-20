import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // Clean database
  await prisma.orderItem.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.store.deleteMany({});
  await prisma.owner.deleteMany({});

  // Hash password
  const hashedPassword = await bcrypt.hash("password123", 10);

  // 1. Create Owner
  const owner = await prisma.owner.create({
    data: {
      name: "Vape Boss",
      email: "owner@vape.com",
      password: hashedPassword,
      pin: "123456",
      whatsappNum: "6281234567890",
    },
  });

  // 2. Create Outlets/Stores
  const store1 = await prisma.store.create({
    data: {
      ownerId: owner.id,
      name: "Toko Vape - Jakarta (Pusat)",
      location: "Jl. Boulevard Raya Kelapa Gading No. 12, Jakarta Utara",
    },
  });

  const store2 = await prisma.store.create({
    data: {
      ownerId: owner.id,
      name: "Toko Vape - Bandung",
      location: "Jl. Cihampelas No. 160, Bandung",
    },
  });

  const store3 = await prisma.store.create({
    data: {
      ownerId: owner.id,
      name: "Toko Vape - Surabaya",
      location: "Jl. Kertajaya Indah No. 45, Surabaya",
    },
  });

  console.log(`Owner created. Outlets created: ${store1.name}, ${store2.name}, ${store3.name}`);

  // Create products and orders for each store
  const stores = [store1, store2, store3];
  
  // Base factors to scale values for different outlets (Jakarta has 1.0x, Bandung 0.7x, Surabaya 0.4x)
  const multipliers = [1.0, 0.7, 0.4];

  for (let sIdx = 0; sIdx < stores.length; sIdx++) {
    const store = stores[sIdx];
    const mult = multipliers[sIdx];

    // Seed Products for this store
    const productsData = [
      { name: "Liquid Hexohm Oat 60ml 3mg", barcode: `${store.id.substring(0, 4)}-8992001`, price: 150000, costPrice: 110000, discount: 0, stock: Math.round(50 * mult) + 5 },
      { name: "Liquid Juta Ice Mango 60ml 3mg", barcode: `${store.id.substring(0, 4)}-8992002`, price: 85000, costPrice: 60000, discount: 0, stock: Math.round(80 * mult) + 10 },
      { name: "Coil Prebuilt Alien V2", barcode: `${store.id.substring(0, 4)}-8992003`, price: 45000, costPrice: 25000, discount: 0, stock: 4 }, // low stock warning
      { name: "Cotton Bacon Prime", barcode: `${store.id.substring(0, 4)}-8992004`, price: 50000, costPrice: 35000, discount: 5, stock: 3 },  // low stock warning
      { name: "Oxva Xlim Pro Pod Kit", barcode: `${store.id.substring(0, 4)}-8992005`, price: 320000, costPrice: 260000, discount: 0, stock: Math.round(25 * mult) + 2 },
      { name: "Cartridge Oxva Xlim V3 0.6", barcode: `${store.id.substring(0, 4)}-8992006`, price: 40000, costPrice: 28000, discount: 0, stock: Math.round(150 * mult) + 20 },
    ];

    const products = [];
    for (const item of productsData) {
      const product = await prisma.product.create({
        data: {
          ...item,
          storeId: store.id,
        },
      });
      products.push(product);
    }

    // Seed Orders spread across the last 3 days
    const now = new Date();
    const day1 = new Date(); day1.setDate(now.getDate() - 2);
    const day2 = new Date(); day2.setDate(now.getDate() - 1);
    const day3 = new Date(now); // Today

    const ordersData = [
      // Day 1
      {
        createdAt: day1,
        paymentStatus: "PAID",
        paymentMethod: "QRIS",
        items: [
          { productId: products[0].id, quantity: Math.round(2 * mult) || 1, price: 150000 },
          { productId: products[1].id, quantity: Math.round(5 * mult) || 2, price: 85000 },
        ]
      },
      {
        createdAt: day1,
        paymentStatus: "PAID",
        paymentMethod: "CASH",
        items: [
          { productId: products[4].id, quantity: Math.round(1 * mult) || 1, price: 320000 },
        ]
      },
      // Day 2
      {
        createdAt: day2,
        paymentStatus: "PAID",
        paymentMethod: "QRIS",
        items: [
          { productId: products[0].id, quantity: Math.round(3 * mult) || 1, price: 150000 },
          { productId: products[5].id, quantity: Math.round(4 * mult) || 1, price: 40000 },
        ]
      },
      {
        createdAt: day2,
        paymentStatus: "PAID",
        paymentMethod: "CASH",
        items: [
          { productId: products[3].id, quantity: Math.round(2 * mult) || 1, price: 50000 },
          { productId: products[1].id, quantity: Math.round(3 * mult) || 1, price: 85000 },
        ]
      },
      // Day 3 (Today)
      {
        createdAt: day3,
        paymentStatus: "PAID",
        paymentMethod: "QRIS",
        items: [
          { productId: products[0].id, quantity: Math.round(1 * mult) || 1, price: 150000 },
          { productId: products[2].id, quantity: Math.round(2 * mult) || 1, price: 45000 },
        ]
      }
    ];

    for (const o of ordersData) {
      let totalAmount = 0;
      let totalProfit = 0;

      for (const item of o.items) {
        const prod = products.find(p => p.id === item.productId)!;
        totalAmount += item.price * item.quantity;
        totalProfit += (item.price - prod.costPrice) * item.quantity;
      }

      const order = await prisma.order.create({
        data: {
          storeId: store.id,
          createdAt: o.createdAt,
          paymentStatus: o.paymentStatus,
          paymentMethod: o.paymentMethod,
          totalAmount,
          totalProfit,
        }
      });

      for (const item of o.items) {
        await prisma.orderItem.create({
          data: {
            orderId: order.id,
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
          }
        });
      }
    }
  }

  console.log("Database seeded successfully with Vape Shop Owner, 3 outlets, products, and orders!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
