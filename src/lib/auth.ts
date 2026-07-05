import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import Google from 'next-auth/providers/google'
import { prisma } from './prisma'
import bcrypt from 'bcryptjs'
import { writeAuditLog } from './audit'
import { createVerificationToken } from './tokens'
import { sendGoogleVerificationEmail } from './mail'
import { rateLimit } from './rate-limit'
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
      async authorize(credentials) {
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
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== 'google') return true

      const dbUser = await prisma.user.findFirst({
        where: { email: user.email!, isActive: true },
      })
      if (!dbUser) return '/login?google=notfound'

      if (!dbUser.googleVerified) {
        try {
          const raw = await createVerificationToken(dbUser.id, 'GOOGLE_VERIFY')
          await sendGoogleVerificationEmail(dbUser.email, dbUser.name, raw)
        } catch (err) {
          console.error('Google verification email failed:', err)
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
        const dbUser = await prisma.user.findFirst({
          where: { email: token.email!, isActive: true },
        })
        if (dbUser) {
          token.id         = dbUser.id
          token.companyId  = dbUser.companyId
          token.role       = dbUser.role
          token.mfaEnabled = dbUser.mfaEnabled
          token.mfaVerified = false
        }
      } else if (user) {
        token.id         = user.id
        token.companyId  = (user as { companyId: string }).companyId
        token.role       = (user as { role: Role }).role
        token.mfaEnabled = (user as { mfaEnabled: boolean }).mfaEnabled
        token.mfaVerified = false
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
