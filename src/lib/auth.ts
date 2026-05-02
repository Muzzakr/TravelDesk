import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { prisma } from './prisma'
import bcrypt from 'bcryptjs'
import { writeAuditLog } from './audit'
import type { Role } from '@/types/user'

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  providers: [
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
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.companyId = (user as { companyId: string }).companyId
        token.role = (user as { role: Role }).role
        token.mfaEnabled = (user as { mfaEnabled: boolean }).mfaEnabled
        token.mfaVerified = false
      }
      return token
    },
    async session({ session, token }) {
      session.user.id = token.id as string
      session.user.companyId = token.companyId as string
      session.user.role = token.role as Role
      session.user.mfaEnabled = token.mfaEnabled as boolean
      session.user.mfaVerified = token.mfaVerified as boolean
      return session
    },
  },
})
