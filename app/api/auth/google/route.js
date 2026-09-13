import { OAuth2Client } from "google-auth-library";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSession, publicUser } from "@/lib/auth";

export async function POST(request) {
  const clientId = process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "Google login is not configured yet." }, { status: 503 });
  }

  try {
    const { credential } = await request.json();
    const client = new OAuth2Client(clientId);
    const ticket = await client.verifyIdToken({ idToken: credential, audience: clientId });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email || !payload.email_verified) {
      return NextResponse.json({ error: "Google account verification failed." }, { status: 401 });
    }

    let user = await prisma.user.findUnique({ where: { googleId: payload.sub } });
    if (!user) {
      user = await prisma.user.upsert({
        where: { email: payload.email.toLowerCase() },
        update: { googleId: payload.sub, name: payload.name || payload.email.split("@")[0] },
        create: { googleId: payload.sub, email: payload.email.toLowerCase(), name: payload.name || payload.email.split("@")[0] }
      });
    }

    await createSession(user.id);
    return NextResponse.json({ user: publicUser(user) });
  } catch {
    return NextResponse.json({ error: "Unable to sign in with Google." }, { status: 401 });
  }
}
