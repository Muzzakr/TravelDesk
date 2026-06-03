# TravelDesk

A multi-tenant business travel management platform. Handles the full lifecycle of a business trip — from the employee's initial travel request through manager approval, agent booking, expense submission, and finance payout.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Database | PostgreSQL via Supabase |
| ORM | Prisma |
| Auth | NextAuth v5 |
| Storage | Supabase Storage |
| Styling | Tailwind CSS |
| AI / OCR | Claude Haiku (Anthropic) |
| Email | Nodemailer |
| Deployment | Vercel |

## Roles

| Role | Access |
|------|--------|
| Employee | Submit travel requests and expenses |
| Manager | Approve/reject requests and expenses |
| Travel Agent | Book trips, provide options |
| Finance Admin | Payout reports, spend analytics, policy |
| System Admin | Full access — users, events, audit log |

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

Copy `.env.example` to `.env.local` and fill in all values:

```bash
cp .env.example .env.local
```

Required variables:

```env
# Database
DATABASE_URL=

# Auth
NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost:3003

# Supabase Storage
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

# Anthropic (OCR)
ANTHROPIC_API_KEY=

# Email
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=
```

### 3. Run database migrations

```bash
npx prisma migrate deploy
npx prisma generate
```

### 4. Start development server

```bash
npm run dev
```

App runs on [http://localhost:3003](http://localhost:3003)

## Scripts

```bash
npm run dev          # Start dev server (port 3003)
npm run build        # Generate Prisma client + build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run test         # Run Jest tests

npm run db:migrate   # Create and apply new migration
npm run db:generate  # Regenerate Prisma client
npm run db:seed      # Seed database with test data
npm run db:studio    # Open Prisma Studio (database GUI)
```

## Project Structure

```
src/
├── app/
│   ├── (dashboard)/         # Authenticated pages
│   │   ├── admin/           # System Admin dashboard
│   │   ├── employee/        # Employee — travel requests & expenses
│   │   ├── manager/         # Manager — approvals
│   │   ├── agent/           # Travel Agent — bookings
│   │   └── finance/         # Finance Admin — payouts & reports
│   ├── api/                 # API routes
│   ├── login/               # Login page
│   └── signup/              # Company signup page
├── components/              # Shared UI components
├── lib/                     # Auth, Prisma, storage, mail, audit
└── types/                   # Shared TypeScript types

prisma/
├── schema.prisma            # Database schema
└── migrations/              # SQL migration files
```

## Travel Request Flow

```
Employee submits request
        ↓
Manager approves
        ↓
Travel Agent provides booking options
        ↓
Employee selects preferred option
        ↓
Manager confirms booking
        ↓
Employee submits expenses + receipts
        ↓
Finance generates payout report
```

## Multi-tenant

Every company that signs up gets a fully isolated environment. All database queries are scoped by `companyId`. No data is shared between companies.