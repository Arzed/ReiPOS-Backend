import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL,
    },
  },
});

function formatIDR(amount: number): string {
  return 'Rp ' + amount.toLocaleString('id-ID');
}

function centerText(text: string, width = 32): string {
  if (text.length >= width) return text.substring(0, width);
  const leftPadding = Math.floor((width - text.length) / 2);
  return ' '.repeat(leftPadding) + text;
}

function line(char = '=', width = 32): string {
  return char.repeat(width);
}

function row2(left: string, right: string, width = 32): string {
  const space = width - left.length - right.length;
  if (space <= 0) {
    return left.substring(0, width - right.length - 1) + ' ' + right;
  }
  return left + ' '.repeat(space) + right;
}

async function previewReceipt() {
  console.log('Fetching latest order from database...\n');
  const order = await prisma.order.findFirst({
    orderBy: { createdAt: 'desc' },
    include: {
      store: true,
      items: {
        include: {
          product: true,
        },
      },
    },
  });

  if (!order) {
    console.log('⚠️ Belum ada pesanan / transaksi di database. Silakan buat transaksi di aplikasi POS.');
    await prisma.$disconnect();
    return;
  }

  const storeName = order.store?.name || 'Toko ReiPOS';
  const invoiceNo = '#' + order.id.substring(0, 8).toUpperCase();
  const dateStr = new Date(order.createdAt).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const width = 32; // Standard 58mm thermal printer width (32 chars)
  const lines: string[] = [];

  lines.push(line('=', width));
  lines.push(centerText(storeName.toUpperCase(), width));
  lines.push(centerText('Struk Pembelian Kasir', width));
  lines.push(line('=', width));
  lines.push(row2('No. Struk :', invoiceNo, width));
  lines.push(row2('Tanggal   :', dateStr, width));
  lines.push(row2('Kasir     :', order.cashierName || 'Syarif (Owner)', width));
  lines.push(row2('Metode    :', order.paymentMethod.toUpperCase(), width));
  lines.push(line('-', width));

  lines.push(row2('PRODUK', 'SUBTOTAL', width));
  lines.push(line('-', width));

  let subtotalCalculated = 0;
  for (const item of order.items) {
    const pName = item.product?.name || 'Produk';
    const itemTotal = item.price * item.quantity;
    subtotalCalculated += itemTotal;

    lines.push(pName);
    lines.push(row2(`  ${item.quantity} x ${formatIDR(item.price)}`, formatIDR(itemTotal), width));
  }

  lines.push(line('-', width));
  lines.push(row2('Subtotal', formatIDR(subtotalCalculated), width));

  const taxAmount = order.totalAmount > subtotalCalculated ? order.totalAmount - subtotalCalculated : 0;
  if (taxAmount > 0) {
    lines.push(row2('Pajak (PPN 10%)', formatIDR(taxAmount), width));
  }

  lines.push(line('=', width));
  lines.push(row2('TOTAL BAYAR', formatIDR(order.totalAmount), width));

  if (order.paymentMethod.toLowerCase().includes('cash') || order.paymentMethod.toLowerCase().includes('tunai') || order.cashReceived) {
    const cashRec = order.cashReceived || order.totalAmount;
    const cashChg = order.cashChange || 0;
    lines.push(row2('Uang Diterima', formatIDR(cashRec), width));
    lines.push(row2('Uang Kembalian', formatIDR(cashChg), width));
  }

  lines.push(line('=', width));
  lines.push(centerText('Terima Kasih Atas Kunjungan Anda!', width));
  lines.push(centerText('Barang Yang Sudah Dibeli', width));
  lines.push(centerText('Tidak Dapat Ditukar/Dikembalikan', width));
  lines.push(line('=', width));

  console.log('==== HASIL PREVIEW STRUK THERMAL (58mm / 32 Karakter) ====\n');
  console.log(lines.join('\n'));
  console.log('\n==========================================================');

  await prisma.$disconnect();
}

previewReceipt().catch((err) => {
  console.error('Error Preview Receipt:', err);
  prisma.$disconnect();
});
