import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const items = await prisma.stockItem.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(items);
}

export async function POST(request) {
  try {
    const body = await request.json();
    const name = String(body.name || "").trim();
    const sku = String(body.sku || "").trim() || null;
    const unitPrice = Number(body.unitPrice);
    const quantity = Number(body.quantity);
    const gstPercent = Number(body.gstPercent ?? 18);

    if (!name || !Number.isFinite(unitPrice) || unitPrice < 0 || !Number.isFinite(quantity) || quantity < 0 || !Number.isFinite(gstPercent) || gstPercent < 0) {
      return NextResponse.json({ error: "Enter a valid product name, price, quantity, and GST rate." }, { status: 400 });
    }

    const item = await prisma.stockItem.create({
      data: { name, sku, unitPrice, quantity, gstPercent }
    });
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    if (error.code === "P2002") {
      return NextResponse.json({ error: "That SKU is already in stock." }, { status: 409 });
    }
    return NextResponse.json({ error: "Unable to add stock item." }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const body = await request.json();
    const id = Number(body.id);
    const data = {};
    if (body.name !== undefined) data.name = String(body.name).trim();
    if (body.sku !== undefined) data.sku = String(body.sku).trim() || null;
    if (body.unitPrice !== undefined) data.unitPrice = Number(body.unitPrice);
    if (body.quantity !== undefined) data.quantity = Number(body.quantity);
    if (body.gstPercent !== undefined) data.gstPercent = Number(body.gstPercent);

    if (!Number.isInteger(id) || Object.keys(data).length === 0 || Object.values(data).some((value) => typeof value === "number" && (!Number.isFinite(value) || value < 0))) {
      return NextResponse.json({ error: "Invalid stock update." }, { status: 400 });
    }

    const item = await prisma.stockItem.update({ where: { id }, data });
    return NextResponse.json(item);
  } catch (error) {
    return NextResponse.json({ error: "Unable to update stock item." }, { status: 500 });
  }
}
