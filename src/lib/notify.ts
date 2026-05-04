import { sendSlack } from './slack'

export async function notifyTravelRequestCreated(params: {
  employeeName: string
  origin: string
  destination: string
  departureDate: string
  estimatedCostUsd?: number | null
  status: string
  requestId: string
}) {
  const cost = params.estimatedCostUsd ? ` · Est. $${Number(params.estimatedCostUsd).toFixed(0)}` : ''
  const next = params.status === 'PENDING_MANAGER' ? 'Awaiting manager approval.' : 'Awaiting agent booking.'
  await sendSlack(
    `✈️ *New travel request* from *${params.employeeName}*\n` +
    `${params.origin} → ${params.destination}, departs ${params.departureDate}${cost}\n` +
    `${next}`
  )
}

export async function notifyTravelRequestStatusChanged(params: {
  employeeName: string
  destination: string
  nextStatus: string
  actorName: string
  rejectionNote?: string | null
  confirmationNumber?: string | null
}) {
  const { employeeName, destination, nextStatus, actorName, rejectionNote, confirmationNumber } = params

  if (nextStatus === 'APPROVED') {
    await sendSlack(`✅ *${employeeName}*'s trip to *${destination}* has been approved by ${actorName}.`)
  } else if (nextStatus === 'PENDING_AGENT') {
    await sendSlack(`📋 Manager ${actorName} approved *${employeeName}*'s trip to *${destination}*. Agent: please provide booking options.`)
  } else if (nextStatus === 'REJECTED') {
    const note = rejectionNote ? `\nReason: _${rejectionNote}_` : ''
    await sendSlack(`❌ *${employeeName}*'s trip to *${destination}* was rejected by ${actorName}.${note}`)
  } else if (nextStatus === 'BOOKING_CONFIRMED') {
    const ref = confirmationNumber ? ` Ref: \`${confirmationNumber}\`` : ''
    await sendSlack(`🎉 Booking confirmed for *${employeeName}*'s trip to *${destination}*.${ref}`)
  } else if (nextStatus === 'CANCELLED') {
    await sendSlack(`🚫 *${employeeName}*'s trip to *${destination}* has been cancelled.`)
  }
}

export async function notifyOptionsProvided(params: {
  employeeName: string
  destination: string
  optionCount: number
}) {
  await sendSlack(
    `📋 *${params.optionCount} booking option${params.optionCount > 1 ? 's' : ''}* ready for *${params.employeeName}*'s trip to *${params.destination}*. Employee: please log in and choose.`
  )
}

export async function notifyExpenseSubmitted(params: {
  employeeName: string
  amountUsd: number
  category: string
  description: string
  eventCode: string
}) {
  await sendSlack(
    `💳 *New expense* from *${params.employeeName}*\n` +
    `$${Number(params.amountUsd).toFixed(2)} · ${params.category.replace(/_/g, ' ')} · ${params.description}\n` +
    `Event: ${params.eventCode} · Awaiting approval.`
  )
}

export async function notifyExpenseStatusChanged(params: {
  employeeName: string
  amountUsd: number
  description: string
  newStatus: string
  actorName: string
  rejectionNote?: string | null
}) {
  const { employeeName, amountUsd, description, newStatus, actorName, rejectionNote } = params
  const amt = `$${Number(amountUsd).toFixed(2)}`

  if (newStatus === 'APPROVED') {
    await sendSlack(`✅ Expense approved: *${employeeName}* — ${amt} for _${description}_ (by ${actorName}).`)
  } else if (newStatus === 'REJECTED') {
    const note = rejectionNote ? `\nReason: _${rejectionNote}_` : ''
    await sendSlack(`❌ Expense rejected: *${employeeName}* — ${amt} for _${description}_ (by ${actorName}).${note}`)
  }
}
