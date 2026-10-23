import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import * as argon2 from "argon2";
import { SignJWT, jwtVerify } from "jose";
import { DatabaseService } from "../../database/prisma.service.js";
import type { AccessContext } from "../../common/auth/access-context.js";

const DAY = 24 * 60 * 60 * 1000;
const ACCESS_SECONDS = 600;
const REFRESH_DAYS = 7;
const roles = { BUYER: ["BUYER"], ADMIN: ["ADMIN"] } as const;
type ClientPlatform = "WEB" | "ANDROID" | "IOS" | "WINDOWS" | "MACOS";

@Injectable()
export class AuthService {
  private readonly limiter = new Map<string, { count: number; reset: number }>();

  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
  ) {}

  async csrf(): Promise<{ csrfToken: string; cookie: string }> {
    const token = randomBytes(32).toString("base64url");
    const signature = this.signCsrf(token);
    return { csrfToken: `${token}.${signature}`, cookie: `${token}.${signature}` };
  }

  verifyCsrf(cookie: string | undefined, header: string | undefined): boolean {
    if (!cookie || !header || cookie !== header) return false;
    const [token, signature] = cookie.split(".");
    if (!token || !signature) return false;
    const expected = this.signCsrf(token);
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  async register(input: {
    email: string;
    password: string;
    fullName: string;
    clientPlatform: ClientPlatform;
  }) {
    this.rateLimit(`register:${input.email.toLowerCase()}`, 5);
    const email = input.email.trim().toLowerCase();
    if (input.password.length < 12 || input.password.length > 128) {
      throw new UnprocessableEntityException({
        code: "INVALID_PASSWORD",
        message: "Password must contain 12 to 128 characters.",
      });
    }
    const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
    try {
      const user = await this.db.prisma.user.create({
        data: {
          emailNormalized: email,
          passwordHash,
          displayName: input.fullName.trim(),
          systemRole: "BUYER",
        },
      });
      return await this.createSession(user, input.clientPlatform);
    } catch (error) {
      if (this.isUniqueError(error))
        throw new ConflictException({
          code: "EMAIL_TAKEN",
          message: "An account with this email already exists.",
        });
      throw error;
    }
  }

  async login(input: { email: string; password: string; clientPlatform: ClientPlatform }) {
    this.rateLimit(`login:${input.email.toLowerCase()}`, 10);
    const user = await this.db.prisma.user.findUnique({
      where: { emailNormalized: input.email.trim().toLowerCase() },
    });
    if (!user || !(await argon2.verify(user.passwordHash, input.password))) {
      throw new UnauthorizedException({
        code: "INVALID_CREDENTIALS",
        message: "Email or password is incorrect.",
      });
    }
    if (user.status !== "ACTIVE")
      throw new ForbiddenException({ code: "ACCOUNT_LOCKED", message: "This account is locked." });
    return this.createSession(user, input.clientPlatform);
  }

  async refresh(refreshToken: string | undefined, clientPlatform: ClientPlatform) {
    this.rateLimit("refresh", 30);
    if (!refreshToken) throw new UnauthorizedException();
    const hash = this.hashRefresh(refreshToken);
    let reused = false;
    const result = await this.db.prisma.$transaction(async (tx) => {
      const sessions = await tx.$queryRaw<
        Array<{
          id: string;
          user_id: string;
          platform: string;
          client_platform: ClientPlatform;
          family_id: string;
          expires_at: Date;
          revoked_at: Date | null;
          replaced_by_session_id: string | null;
        }>
      >`
        SELECT id, user_id, platform, client_platform, family_id, expires_at, revoked_at, replaced_by_session_id FROM sessions WHERE refresh_hash = ${hash} FOR UPDATE`;
      const old = sessions[0];
      if (!old) return null;
      if (old.revoked_at || old.replaced_by_session_id) {
        await tx.session.updateMany({
          where: { familyId: old.family_id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        reused = true;
        return null;
      }
      if (old.expires_at <= new Date()) return null;
      const user = await tx.user.findUnique({ where: { id: old.user_id } });
      if (!user || user.status !== "ACTIVE") return null;
      const nextSecret = randomBytes(48).toString("base64url");
      const next = await tx.session.create({
        data: {
          userId: old.user_id,
          platform: old.platform as "WEB" | "MOBILE" | "DESKTOP",
          clientPlatform,
          refreshHash: this.hashRefresh(nextSecret),
          familyId: old.family_id,
          expiresAt: old.expires_at,
        },
      });
      await tx.session.update({
        where: { id: old.id },
        data: { revokedAt: new Date(), replacedBySessionId: next.id },
      });
      return { user, session: next, refreshToken: nextSecret };
    });
    if (!result)
      throw new UnauthorizedException({
        code: reused ? "REFRESH_REUSE" : "INVALID_REFRESH",
        message: "Refresh credential is invalid.",
      });
    return this.tokenResponse(result.user, result.session.id, result.refreshToken);
  }

  async logout(context: AccessContext, refreshToken?: string): Promise<void> {
    await this.db.prisma.session.updateMany({
      where: { id: context.sessionId, userId: context.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (refreshToken)
      await this.db.prisma.session.updateMany({
        where: {
          userId: context.userId,
          refreshHash: this.hashRefresh(refreshToken),
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });
  }

  async accessContext(token: string): Promise<AccessContext> {
    try {
      const secret = this.jwtSecret();
      const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
      if (
        typeof payload.sub !== "string" ||
        typeof payload.sid !== "string" ||
        typeof payload.ver !== "number"
      )
        throw new Error("invalid");
      const session = await this.db.prisma.session.findFirst({
        where: {
          id: payload.sid,
          userId: payload.sub,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        include: { user: true },
      });
      if (!session || session.user.status !== "ACTIVE" || session.user.authVersion !== payload.ver)
        throw new Error("inactive");
      await this.db.prisma.session.update({
        where: { id: session.id },
        data: { lastSeenAt: new Date() },
      });
      return {
        userId: session.userId,
        sessionId: session.id,
        systemRole: session.user.systemRole,
        authVersion: session.user.authVersion,
      };
    } catch {
      throw new UnauthorizedException({
        code: "INVALID_ACCESS_TOKEN",
        message: "Access token is invalid or expired.",
      });
    }
  }

  async me(userId: string) {
    const user = await this.db.prisma.user.findUnique({
      where: { id: userId },
      include: { avatarAsset: true },
    });
    if (!user) throw new NotFoundException();
    return this.projectUser(user);
  }

  async patchProfile(
    userId: string,
    input: { fullName?: string; phone?: string | null; avatarAssetId?: string | null },
  ) {
    if (input.avatarAssetId) {
      const asset = await this.db.prisma.asset.findFirst({
        where: {
          id: input.avatarAssetId,
          uploaderUserId: userId,
          purpose: "AVATAR",
          status: "VERIFIED",
          shopId: null,
        },
      });
      if (!asset)
        throw new NotFoundException({
          code: "ASSET_NOT_FOUND",
          message: "The avatar asset is not available to this account.",
        });
    }
    const data: Record<string, unknown> = {};
    if (input.fullName !== undefined) data.displayName = input.fullName.trim();
    if (input.phone !== undefined) data.phone = input.phone;
    if (input.avatarAssetId !== undefined) data.avatarAssetId = input.avatarAssetId;
    await this.db.prisma.user.update({ where: { id: userId }, data });
    return this.me(userId);
  }

  async changePassword(
    context: AccessContext,
    input: { currentPassword: string; newPassword: string },
  ) {
    const user = await this.db.prisma.user.findUnique({ where: { id: context.userId } });
    if (!user || !(await argon2.verify(user.passwordHash, input.currentPassword)))
      throw new UnprocessableEntityException({
        code: "CURRENT_PASSWORD_INCORRECT",
        message: "Current password is incorrect.",
      });
    if (input.newPassword.length < 12 || input.newPassword.length > 128)
      throw new UnprocessableEntityException({
        code: "INVALID_PASSWORD",
        message: "Password must contain 12 to 128 characters.",
      });
    const passwordHash = await argon2.hash(input.newPassword, { type: argon2.argon2id });
    await this.db.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { passwordHash, authVersion: { increment: 1 } },
      });
      await tx.session.updateMany({
        where: { userId: user.id, id: { not: context.sessionId }, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });
    return;
  }

  async addresses(userId: string) {
    return this.db.prisma.address.findMany({
      where: { userId, deletedAt: null },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    });
  }

  async createAddress(userId: string, input: Record<string, unknown>) {
    return this.db.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE`;
      if (input.isDefault)
        await tx.address.updateMany({
          where: { userId, deletedAt: null, isDefault: true },
          data: { isDefault: false },
        });
      return tx.address.create({ data: { userId, ...input } as never });
    });
  }

  async updateAddress(userId: string, id: string, input: Record<string, unknown>) {
    return this.db.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE`;
      const current = await tx.address.findFirst({ where: { id, userId, deletedAt: null } });
      if (!current) throw new NotFoundException();
      if (input.isDefault === true)
        await tx.address.updateMany({
          where: { userId, deletedAt: null, isDefault: true },
          data: { isDefault: false },
        });
      return tx.address.update({ where: { id }, data: input as never });
    });
  }

  async deleteAddress(userId: string, id: string) {
    const address = await this.db.prisma.address.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!address) throw new NotFoundException();
    await this.db.prisma.address.update({
      where: { id },
      data: { deletedAt: new Date(), isDefault: false },
    });
  }

  tokenResponse(
    user: {
      id: string;
      emailNormalized: string;
      displayName: string;
      phone: string | null;
      systemRole: "BUYER" | "ADMIN";
      status: "ACTIVE" | "LOCKED";
      authVersion: number;
      createdAt: Date;
      updatedAt: Date;
    },
    sessionId: string,
    refreshToken: string,
  ) {
    const userProjection = this.projectUser(user);
    return this.signAccess(user, sessionId).then((accessToken) => ({
      accessToken,
      expiresIn: ACCESS_SECONDS,
      sessionId,
      user: userProjection,
      refreshToken,
    }));
  }

  private async createSession(
    user: {
      id: string;
      emailNormalized: string;
      displayName: string;
      phone: string | null;
      systemRole: "BUYER" | "ADMIN";
      status: "ACTIVE" | "LOCKED";
      authVersion: number;
      createdAt: Date;
      updatedAt: Date;
    },
    clientPlatform: ClientPlatform,
  ) {
    const refreshToken = randomBytes(48).toString("base64url");
    const session = await this.db.prisma.session.create({
      data: {
        userId: user.id,
        platform:
          clientPlatform === "WEB"
            ? "WEB"
            : clientPlatform === "ANDROID" || clientPlatform === "IOS"
              ? "MOBILE"
              : "DESKTOP",
        clientPlatform,
        refreshHash: this.hashRefresh(refreshToken),
        familyId: randomUUID(),
        expiresAt: new Date(Date.now() + REFRESH_DAYS * DAY),
      },
    });
    return this.tokenResponse(user, session.id, refreshToken);
  }

  private async signAccess(
    user: { id: string; authVersion: number; systemRole: "BUYER" | "ADMIN" },
    sessionId: string,
  ): Promise<string> {
    return new SignJWT({ sid: sessionId, ver: user.authVersion, role: roles[user.systemRole] })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setSubject(user.id)
      .setIssuedAt()
      .setExpirationTime(`${ACCESS_SECONDS}s`)
      .sign(this.jwtSecret());
  }

  private projectUser(user: {
    id: string;
    emailNormalized: string;
    displayName: string;
    phone: string | null;
    systemRole: "BUYER" | "ADMIN";
    status: "ACTIVE" | "LOCKED";
    authVersion: number;
    createdAt: Date;
    updatedAt: Date;
    avatarAsset?: {
      id: string;
      objectKey: string;
      mimeType: string;
      byteSize: number;
      width: number;
      height: number;
    } | null;
  }) {
    const base = this.config.get<string>("ASSET_PUBLIC_READ_BASE")?.replace(/\/$/, "");
    return {
      id: user.id,
      email: user.emailNormalized,
      fullName: user.displayName,
      phone: user.phone,
      avatar:
        user.avatarAsset && base
          ? {
              id: user.avatarAsset.id,
              url: `${base}/${user.avatarAsset.objectKey}`,
              mimeType: user.avatarAsset.mimeType,
              byteSize: user.avatarAsset.byteSize,
              width: user.avatarAsset.width,
              height: user.avatarAsset.height,
            }
          : null,
      roles: roles[user.systemRole],
      status: user.status,
      version: user.authVersion,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  private jwtSecret(): Uint8Array {
    const configured = this.config.get<string>("JWT_SIGNING_SECRET")?.trim();
    if (configured && configured.length >= 32) return new TextEncoder().encode(configured);
    if (process.env.NODE_ENV === "test")
      return new TextEncoder().encode("local-test-signing-secret-at-least-32-characters");
    throw new Error("JWT_SIGNING_SECRET must contain at least 32 characters");
  }

  private signCsrf(value: string): string {
    const key =
      this.config.get<string>("JWT_SIGNING_SECRET")?.trim() ||
      "local-csrf-secret-at-least-32-characters";
    return createHmac("sha256", key).update(value).digest("base64url");
  }
  private hashRefresh(value: string): string {
    return createHash("sha256").update(value).digest("hex");
  }
  private rateLimit(key: string, limit: number): void {
    const now = Date.now();
    const current = this.limiter.get(key);
    if (!current || current.reset < now) this.limiter.set(key, { count: 1, reset: now + 60_000 });
    else if (++current.count > limit)
      throw new HttpException(
        { code: "RATE_LIMITED", message: "Too many requests. Try again shortly." },
        HttpStatus.TOO_MANY_REQUESTS,
      );
  }
  private isUniqueError(error: unknown): boolean {
    return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
  }
}
