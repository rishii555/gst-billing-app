import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  const currentUser = await getSessionUser();
  if (!currentUser) {
    return NextResponse.json({ error: "You must be signed in to view invoices." }, { status: 401 });
  }

  const invoices = await prisma.invoice.findMany({
    where: { createdById: currentUser.id },
    include: { items: true },
    orderBy: { createdAt: "desc" }
  });

  return NextResponse.json({ invoices });
}

export async function POST(request) {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser) {
      return NextResponse.json({ error: "You must be signed in to create an invoice." }, { status: 401 });
    }

    const body = await request.json();
    const number = String(body.number || "").trim();
    const customerName = String(body.customerName || "Walk-in Customer").trim();
    const items = Array.isArray(body.items) ? body.items : [];

    if (!number || items.length === 0) {
      return NextResponse.json({ error: "An invoice number and at least one stock item are required." }, { status: 400 });
    }

    const invoice = await prisma.$transaction(async (transaction) => {
      for (const item of items) {
        const stockItemId = Number(item.stockItemId);
        const quantity = Number(item.quantity);
        if (!Number.isInteger(stockItemId) || !Number.isFinite(quantity) || quantity <= 0) {
          throw new Error("Invalid invoice item.");
        }

        const result = await transaction.stockItem.updateMany({
          where: { id: stockItemId, quantity: { gte: quantity } },
          data: { quantity: { decrement: quantity } }
        });
        if (result.count !== 1) {
          throw new Error(`Insufficient stock for item ${stockItemId}.`);
        }
      }

      return transaction.invoice.create({
        data: {
          number,
          customerName,
          subtotal: Number(body.subtotal) || 0,
          gstAmount: Number(body.gstAmount) || 0,
          discountAmount: Number(body.discountAmount) || 0,
          total: Number(body.total) || 0,
          createdById: currentUser.id,
          items: {
            create: items.map((item) => ({
              stockItemId: Number(item.stockItemId),
              name: String(item.name),
              quantity: Number(item.quantity),
              unitPrice: Number(item.unitPrice) || 0,
              gstPercent: Number(item.gstPercent) || 0,
              discountPercent: Number(item.discountPercent) || 0,
              total: Number(item.total) || 0
            }))
          }
        },
        include: { items: true }
      });
    });

    return NextResponse.json(invoice, { status: 201 });
  } catch (error) {
    const status = error.code === "P2002" ? 409 : 400;
    return NextResponse.json({ error: error.message || "Unable to create invoice." }, { status });
  }
}
