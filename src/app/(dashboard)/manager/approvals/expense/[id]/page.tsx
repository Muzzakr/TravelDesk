import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Badge, statusToBadgeVariant } from '@/components/ui/Badge'
import { ReceiptRow } from '@/components/manager/ReceiptRow'
import { ExpenseReviewPanel } from '@/components/manager/ExpenseReviewPanel'
import { BudgetBar } from '@/components/manager/BudgetBar'

const CATEGORY_LABELS: Record<string, string> = {
  MEALS: 'Meals',
  TRANSPORT: 'Transport',
  ACCOMMODATION: 'Accommodation',
  SUPPLIES: 'Supplies',
  OTHER: 'Other',
}

export default async function ApproveExpensePage({ params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.companyId) redirect('/login')
  const companyId = session.user.companyId
  const role = session.user.role ?? ''

  if (!['MANAGER', 'FINANCE_ADMIN', 'SYSTEM_ADMIN'].includes(role)) redirect('/manager')

  const expense = await prisma.expense.findFirst({
    where: { id: params.id, companyId },
    include: {
      employee: { select: { name: true, email: true } },
      event: {
        select: {
          eventName: true,
          eventCode: true,
          budgetUsd: true,
          approvedSpendUsd: true,
        },
      },
      receipts: { select: { id: true, fileName: true } },
      approvalActions: {
        include: { actor: { select: { name: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  if (!expense) notFound()

  // All expenses from same employee + event for the review panel
  const relatedRaw = await prisma.expense.findMany({
    where: { companyId, employeeId: expense.employeeId, eventId: expense.eventId },
    select: {
      id: true,
      category: true,
      description: true,
      amountUsd: true,
      status: true,
      rejectionNote: true,
      reason: true,
      personName: true,
    },
    orderBy: { createdAt: 'asc' },
  })

  // Serialise Decimal → number for client component
  const relatedExpenses = relatedRaw.map((e) => ({
    ...e,
    category: e.category as string,
    status: e.status as string,
    amountUsd: Number(e.amountUsd),
  }))

  const ev = expense.event
  const eventBudget = Number(ev.budgetUsd)
  const eventSpent = Number(ev.approvedSpendUsd)
  const expenseAmt = Number(expense.amountUsd)
  const status = expense.status as string
  const isAlreadyApproved = status === 'APPROVED'
  const projectedSpent = isAlreadyApproved ? eventSpent : eventSpent + expenseAmt
  const budgetPct = eventBudget > 0 ? Math.min(Math.round((eventSpent / eventBudget) * 100), 100) : 0
  const projectedPct = eventBudget > 0 ? Math.min(Math.round((projectedSpent / eventBudget) * 100), 100) : 0
  const budgetBarColor =
    projectedPct >= 100 ? 'bg-red-500' : projectedPct >= 80 ? 'bg-yellow-400' : 'bg-green-500'

  const submittedAt = new Date(expense.createdAt)
  const submittedLabel = `${submittedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} at ${submittedAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`

  return (
    <div className="space-y-5">
      {/* Back */}
      <Link
        href="/manager/team-expenses"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Team Expenses
      </Link>

      <div className="lg:grid lg:grid-cols-3 lg:gap-8 space-y-5 lg:space-y-0 items-start">

        {/* ── Left column: expense details ── */}
        <div className="lg:col-span-2 space-y-4">

          {/* Employee header */}
          <div className="rounded-xl border bg-white p-5 flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">
              {expense.employee.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-bold text-gray-900">{expense.employee.name}</h1>
              <p className="text-sm text-gray-500">{expense.employee.email}</p>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400">
                <span className="font-medium text-gray-600">{ev.eventName}</span>
                {ev.eventCode && <span className="font-mono">{ev.eventCode}</span>}
                <span>Submitted {submittedLabel}</span>
              </div>
            </div>
            <Badge variant={statusToBadgeVariant(status)}>{status.replace(/_/g, ' ')}</Badge>
          </div>

          {/* Expense details */}
          <div className="rounded-xl border bg-white p-5 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  {CATEGORY_LABELS[String(expense.category)] ?? String(expense.category)}
                </p>
                <h2 className="mt-1 text-lg font-semibold text-gray-900 leading-snug">
                  {expense.description}
                </h2>
                {expense.merchantName && (
                  <p className="mt-0.5 text-sm text-gray-500">{expense.merchantName}</p>
                )}
              </div>
              <p className="text-3xl font-bold text-gray-900 shrink-0 tabular-nums">
                ${expenseAmt.toFixed(2)}
              </p>
            </div>

            {/* Detail grid */}
            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4 text-sm border-t border-gray-100 pt-4">
              {expense.transactionDate && (
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                    Transaction date
                  </dt>
                  <dd className="mt-0.5 font-medium text-gray-900">
                    {new Date(expense.transactionDate).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric',
                    })}
                  </dd>
                </div>
              )}
              {expense.expenseType && (
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                    Expense type
                  </dt>
                  <dd className="mt-0.5 font-medium text-gray-900">
                    {String(expense.expenseType).replace(/_/g, ' ')}
                  </dd>
                </div>
              )}
              {expense.reason && (
                <div className="col-span-2 sm:col-span-1">
                  <dt className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                    Reason
                  </dt>
                  <dd className="mt-0.5 font-medium text-gray-900">{expense.reason}</dd>
                </div>
              )}
              {expense.personName && (
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                    Expense for
                  </dt>
                  <dd className="mt-0.5 font-medium text-gray-900">{expense.personName}</dd>
                </div>
              )}
            </dl>

            {expense.rejectionNote && (
              <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-red-500">
                  Rejection note
                </p>
                <p className="mt-1 text-sm text-red-700">{expense.rejectionNote}</p>
              </div>
            )}
          </div>

          {/* Budget impact */}
          {eventBudget > 0 && (
            <div className="rounded-xl border bg-white p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-800">Event budget — {ev.eventName}</h3>
                <span
                  className={`text-sm font-bold ${
                    projectedPct >= 100
                      ? 'text-red-600'
                      : projectedPct >= 80
                      ? 'text-yellow-600'
                      : 'text-green-600'
                  }`}
                >
                  {projectedPct}% {isAlreadyApproved ? 'used' : 'after approval'}
                </span>
              </div>
              <BudgetBar
                budgetPct={budgetPct}
                projectedPct={projectedPct}
                budgetBarColor={budgetBarColor}
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>Spent: <b className="text-gray-800">${eventSpent.toLocaleString('en-US')}</b></span>
                {!isAlreadyApproved && expenseAmt > 0 && (
                  <span>+ This: <b className="text-indigo-700">${expenseAmt.toLocaleString('en-US')}</b></span>
                )}
                <span>Budget: <b className="text-gray-800">${eventBudget.toLocaleString('en-US')}</b></span>
              </div>
            </div>
          )}

          {/* Receipts */}
          <div className="rounded-xl border bg-white p-5 space-y-3">
            <h3 className="text-sm font-semibold text-gray-800">Receipts</h3>
            {expense.receipts.length === 0 ? (
              <p className="text-sm text-gray-400">No receipts attached.</p>
            ) : (
              <div className="space-y-2">
                {expense.receipts.map((r) => (
                  <ReceiptRow key={r.id} id={r.id} fileName={r.fileName} />
                ))}
              </div>
            )}
          </div>

          {/* Approval history */}
          {expense.approvalActions.length > 0 && (
            <div className="rounded-xl border bg-white p-5 space-y-3">
              <h3 className="text-sm font-semibold text-gray-800">Approval history</h3>
              <div className="space-y-3">
                {expense.approvalActions.map((a, i) => (
                  <div key={i} className="flex items-start gap-3 text-sm">
                    <span
                      className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                        a.actionType === 'APPROVE'
                          ? 'bg-green-100 text-green-700'
                          : a.actionType === 'REJECT'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {a.actionType}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900">{a.actor.name}</p>
                      {a.note && <p className="mt-0.5 text-xs text-gray-500">{a.note}</p>}
                    </div>
                    <span className="shrink-0 text-xs text-gray-400">
                      {new Date(a.createdAt).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric',
                      })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Right column: decision panel ── */}
        <div className="lg:col-span-1">
          <div className="lg:sticky lg:top-24">
            <ExpenseReviewPanel
              expenses={relatedExpenses}
              currentExpenseId={params.id}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
