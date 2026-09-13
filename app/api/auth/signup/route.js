import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSession, publicUser } from "@/lib/auth";

export async function POST(request) {
  try {
    const body = await request.json();
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (name.length < 2 || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8) {
      return NextResponse.json({ error: "Use a name, valid email, and password of at least 8 characters." }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const role = email === (process.env.ADMIN_EMAIL || "admin@gst.com").toLowerCase() ? "ADMIN" : "USER";
    const user = await prisma.user.create({ data: { name, email, passwordHash, role } });
    await createSession(user.id);
    return NextResponse.json({ user: publicUser(user) }, { status: 201 });
  } catch (error) {
    if (error.code === "P2002") {
      return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
    }
    return NextResponse.json({ error: "Unable to create your account." }, { status: 500 });
  }
}
