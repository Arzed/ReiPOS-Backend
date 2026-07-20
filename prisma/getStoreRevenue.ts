import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient()

const storeRevenue = prisma.store.findUnique({
    where: {
        id: "7d30147f-4a96-4199-addf-143b150e49a2",
    },
    select: {
        name: true,
        orders: {
            where: {
                paymentStatus: 'PAID',
                createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)), lte: new Date() },
            },
        }
    }
})

storeRevenue.then(console.log)