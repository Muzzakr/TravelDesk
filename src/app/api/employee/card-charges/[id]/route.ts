import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'
import { uploadReceipt, buildCardReceiptKey } from '@/lib/storage'

export const maxDuration = 60

const MAX_SIZE = 10 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']

// An employee filling in the event and/or receipt on their own card
// charge. Works incrementally — either field can be provided on its own,
// so someone can tag the event today and come back for the receipt later.
// Status only becomes SUBMITTED once both are present; Finance still has
// to review and confirm (MATCHED) afterward, same as the Finance-facing
// tagging flow.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id || !session?.user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const existing = await prisma.cardTransaction.findFirst({
    where: { id: params.id, companyId: session.user.companyId, voidedAt: null },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (existing.employeeId !== session.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const formData = await req.formData()
  const eventId = (formData.get('eventId') as string | null)?.trim() || null
  const file = formData.get('file') as File | null

  if (!eventId && !file) {
    return NextResponse.json({ error: 'Provide an eventId, a receipt file, or both' }, { status: 400 })
  }

  if (eventId) {
    const event = await prisma.event.findFirst({ where: { id: eventId, companyId: session.user.companyId }, select: { id: true } })
    if (!event) return NextResponse.json({ error: 'Invalid eventId: event not found in this company' }, { status: 400 })
  }

  let receiptKey = existing.receiptKey
  if (file) {
    if (file.size > MAX_SIZE) return NextResponse.json({ error: 'File too large (max 10 MB)' }, { status: 413 })
    if (!ALLOWED_TYPES.includes(file.type)) return NextResponse.json({ error: 'File type not allowed. Use JPG, PNG, WebP or PDF.' }, { status: 415 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const key = buildCardReceiptKey(session.user.companyId, existing.id, file.name)
    try {
      await uploadReceipt(key, buffer, file.type)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed'
      return NextResponse.json({ error: msg }, { status: 500 })
    }
    receiptKey = key
  }

  const finalEventId = eventId ?? existing.eventId
  // TAGGED specifically means "event is set" elsewhere in this app (see the
  // Finance-side tag route) — a receipt with no event yet must stay
  // PENDING_TAG, not silently imply an event that was never actually set.
  const status = finalEventId && receiptKey ? 'SUBMITTED' : finalEventId ? 'TAGGED' : 'PENDING_TAG'

  const updated = await prisma.cardTransaction.update({
    where: { id: existing.id },
    data: { ...(eventId ? { eventId } : {}), ...(receiptKey ? { receiptKey } : {}), status },
  })

  await writeAuditLog({
    companyId: session.user.companyId,
    actorId: session.user.id,
    action: 'CARD_CHARGE_SELF_SERVICE_UPDATE',
    entityType: 'CardTransaction',
    entityId: existing.id,
    payload: { eventId: finalEventId, receiptAdded: !!file, status },
  })

  return NextResponse.json(updated)
}
