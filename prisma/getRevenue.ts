import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient()

async function getRevenue() {
    const start = new Date(new Date().setHours(0, 0, 0, 0));
    const end = new Date();
    const orders = await prisma.order.findMany({
        where: {
            storeId: "all",
            paymentStatus: 'PAID',
            createdAt: { gte: start, lte: end },
        },
        include: { store: true },
    });
    const total = orders.reduce((sum, o) => sum + o.totalAmount, 0);
    const breakdown: Record<string, number> = {};
    orders.forEach(o => {
        breakdown[o.store.name] = (breakdown[o.store.name] || 0) + o.totalAmount;
    });
    return {
        totalRevenue: total,
        count: orders.length,
        period: `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`,
        breakdown
    };
}

getRevenue().then(console.log);