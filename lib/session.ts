import { SignJWT, jwtVerify } from "jose";

const configuredSecret = process.env.AUTH_SECRET;
if (process.env.NODE_ENV === "production" && (!configuredSecret || configuredSecret.length < 32)) {
  throw new Error("AUTH_SECRET must be configured with at least 32 characters in production");
}

const JWT_SECRET = new TextEncoder().encode(
  configuredSecret || "development-secret-please-configure-auth-secret-before-deploying"
);

export interface SessionUser {
  id: number;
  name: string;
  email: string;
}

export async function createToken(user: SessionUser): Promise<string> {
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, { algorithms: ["HS256"] });
    if (
      !Number.isSafeInteger(payload.id) ||
      typeof payload.name !== "string" ||
      typeof payload.email !== "string"
    ) {
      return null;
    }

    return {
      id: payload.id as number,
      name: payload.name,
      email: payload.email,
    };
  } catch {
    return null;
  }
}
