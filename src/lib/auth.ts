import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import Google from 'next-auth/providers/google'
import { prisma } from './prisma'
import bcrypt from 'bcryptjs'
import { writeAuditLog } from './audit'
import { createVerificationToken, hashToken } from './tokens'
import { sendGoogleVerificationEmail } from './mail'
import { rateLimit } from './rate-limit'
import { checkNewDevice } from './device'
import type { Role } from '@/types/user'

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  providers: [
    Google({
      clientId:     process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        companySlug: { label: 'Company', type: 'text' },
      },
      async authorize(credentials, request) {
        if (!credentials?.email || !credentials?.password || !credentials?.companySlug) {
          return null
        }

        // Brute-force protection: max 10 attempts per account per 15 minutes
        const rlKey = `login:${credentials.companySlug}:${(credentials.email as string).toLowerCase()}`
        if (!(await rateLimit(rlKey, 10, 15 * 60_000))) return null

        const company = await prisma.company.findUnique({
          where: { slug: credentials.companySlug as string },
        })
        if (!company) return null

        // Companies that enforce SSO don't allow password sign-in — the
        // login page also proactively hides the password field once it
        // learns this via /api/auth/sso/check, so this is a backstop.
        const ssoConfig = await prisma.companySsoConfig.findUnique({
          where: { companyId: company.id },
          select: { enforced: true },
        })
        if (ssoConfig?.enforced) return null

        const user = await prisma.user.findUnique({
          where: {
            companyId_email: {
              companyId: company.id,
              email: credentials.email as string,
            },
          },
        })

        if (!user || !user.isActive || !user.passwordHash) return null

        const valid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        )
        if (!valid) return null

        try {
          await writeAuditLog({
            companyId: company.id,
            actorId: user.id,
            action: 'LOGIN',
            entityType: 'User',
            entityId: user.id,
            payload: { email: user.email, role: user.role },
          })
        } catch (err) {
          console.error('Audit log failed:', err)
        }

        await checkNewDevice(user.id, company.id, user.name, user.email, request)

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          companyId: company.id,
          role: user.role as Role,
          mfaEnabled: user.mfaEnabled,
        }
      },
    }),
    // Passwordless sign-in via emailed one-time link. Token security:
    // 256-bit random, SHA-256 hashed at rest, 15 min expiry, single use.
    // MFA still applies — the jwt callback sets mfaVerified=false as usual.
    Credentials({
      id: 'magic-link',
      name: 'magic-link',
      credentials: { token: { label: 'Token', type: 'text' } },
      async authorize(credentials) {
        const raw = credentials?.token
        if (!raw || typeof raw !== 'string') return null

        const record = await prisma.verificationToken.findUnique({
          where: { token: hashToken(raw) },
        })
        if (!record || record.type !== 'MAGIC_LINK' || record.expiresAt < new Date()) return null

        // Single use — consume before signing in
        await prisma.verificationToken.delete({ where: { id: record.id } })

        const user = await prisma.user.findUnique({ where: { id: record.userId } })
        if (!user || !user.isActive) return null

        // Backstop — /api/auth/magic-link already skips sending to an
        // enforced company, but a token issued before enforcement was
        // turned on must not still be redeemable after.
        const ssoConfig = await prisma.companySsoConfig.findUnique({
          where: { companyId: user.companyId },
          select: { enforced: true },
        })
        if (ssoConfig?.enforced) return null

        try {
          await writeAuditLog({
            companyId: user.companyId,
            actorId: user.id,
            action: 'LOGIN_MAGIC_LINK',
            entityType: 'User',
            entityId: user.id,
            payload: { email: user.email, role: user.role },
          })
        } catch (err) {
          console.error('Audit log failed:', err)
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          companyId: user.companyId,
          role: user.role as Role,
          mfaEnabled: user.mfaEnabled,
        }
      },
    }),
    // Bridges an already-verified enterprise SSO (OIDC) sign-in into a real
    // NextAuth session. The actual identity proving happens outside NextAuth
    // in /api/auth/sso/authorize + /api/auth/sso/callback (a full OIDC
    // authorization-code exchange with the company's own IdP) — by the time
    // this provider runs, the token has already been validated once and
    // just needs to be redeemed. Structurally identical to magic-link above.
    Credentials({
      id: 'sso-credentials',
      name: 'sso-credentials',
      credentials: { token: { label: 'Token', type: 'text' } },
      async authorize(credentials, request) {
        const raw = credentials?.token
        if (!raw || typeof raw !== 'string') return null

        const record = await prisma.verificationToken.findUnique({
          where: { token: hashToken(raw) },
        })
        if (!record || record.type !== 'SSO_SESSION' || record.expiresAt < new Date()) return null

        // Single use — consume before signing in
        await prisma.verificationToken.delete({ where: { id: record.id } })

        const user = await prisma.user.findUnique({ where: { id: record.userId } })
        if (!user || !user.isActive) return null

        try {
          await writeAuditLog({
            companyId: user.companyId,
            actorId: user.id,
            action: 'LOGIN_SSO',
            entityType: 'User',
            entityId: user.id,
            payload: { email: user.email, role: user.role },
          })
        } catch (err) {
          console.error('Audit log failed:', err)
        }

        await checkNewDevice(user.id, user.companyId, user.name, user.email, request)

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          companyId: user.companyId,
          role: user.role as Role,
          mfaEnabled: user.mfaEnabled,
        }
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== 'google') return true

      // Only trust addresses Google itself has verified — an unverified
      // Google account must not be able to claim someone else's email.
      if ((profile as { email_verified?: boolean } | undefined)?.email_verified !== true) {
        return '/login?google=notfound'
      }

      // The same email can exist in several companies. Google gives us no
      // company context, so an ambiguous match must not sign in to a
      // company chosen at random — send those users to password/magic-link.
      const matches = await prisma.user.findMany({
        where: { email: user.email!, isActive: true },
        take: 2,
      })
      if (matches.length === 0) return '/login?google=notfound'
      if (matches.length > 1) return '/login?google=ambiguous'
      const dbUser = matches[0]

      const ssoConfig = await prisma.companySsoConfig.findUnique({
        where: { companyId: dbUser.companyId },
        select: { enforced: true },
      })
      if (ssoConfig?.enforced) return '/login?sso=enforced'

      if (!dbUser.googleVerified) {
        // Max 3 verification emails per account per 15 minutes — repeated
        // clicks reuse the banner without sending yet another email
        if (await rateLimit(`gverify:${dbUser.id}`, 3, 15 * 60_000)) {
          try {
            const raw = await createVerificationToken(dbUser.id, 'GOOGLE_VERIFY')
            await sendGoogleVerificationEmail(dbUser.email, dbUser.name, raw, dbUser.companyId)
          } catch (err) {
            console.error('Google verification email failed:', err)
          }
        }
        return '/login?google=pending'
      }

      try {
        await writeAuditLog({
          companyId: dbUser.companyId,
          actorId: dbUser.id,
          action: 'LOGIN_GOOGLE',
          entityType: 'User',
          entityId: dbUser.id,
          payload: { email: dbUser.email, role: dbUser.role },
        })
      } catch {}

      return true
    },

    async jwt({ token, user, account }) {
      if (account?.provider === 'google') {
        // Mirrors the signIn guard: only an unambiguous match gets a session
        const matches = await prisma.user.findMany({
          where: { email: token.email!, isActive: true },
          take: 2,
        })
        const dbUser = matches.length === 1 ? matches[0] : null
        if (dbUser) {
          token.id         = dbUser.id
          token.companyId  = dbUser.companyId
          token.role       = dbUser.role
          token.mfaEnabled = dbUser.mfaEnabled
          token.mfaVerified = false
          token.authTime   = Math.floor(Date.now() / 1000)
        }
      } else if (user) {
        token.id         = user.id
        token.companyId  = (user as { companyId: string }).companyId
        token.role       = (user as { role: Role }).role
        token.mfaEnabled = (user as { mfaEnabled: boolean }).mfaEnabled
        token.mfaVerified = false
        token.authTime   = Math.floor(Date.now() / 1000)
      }

      // Kill sessions whose password changed after sign-in (or whose user was
      // deactivated). Checked against the DB at most every 5 minutes so a
      // stolen session survives a password reset for a few minutes at most.
      const now = Math.floor(Date.now() / 1000)
      const lastCheck = (token.revalidatedAt as number | undefined) ?? 0
      if (token.id && now - lastCheck > 300) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { isActive: true, passwordChangedAt: true },
        })
        if (!dbUser?.isActive) return null
        const authTime = (token.authTime as number | undefined) ?? 0
        if (dbUser.passwordChangedAt && Math.floor(dbUser.passwordChangedAt.getTime() / 1000) > authTime) {
          return null
        }
        token.revalidatedAt = now
      }
      return token
    },

    async session({ session, token }) {
      session.user.id         = token.id as string
      session.user.companyId  = token.companyId as string
      session.user.role       = token.role as Role
      session.user.mfaEnabled = token.mfaEnabled as boolean
      session.user.mfaVerified = token.mfaVerified as boolean
      return session
    },
  },
})
