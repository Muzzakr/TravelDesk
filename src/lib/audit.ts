import { prisma } from './prisma'

interface AuditParams {
  companyId: string
  actorId?: string
  action: string
  entityType: string
  entityId: string
  payload: Record<string, unknown>
  ipAddress?: string
}

export async function writeAuditLog(params: AuditParams): Promise<void> {
  await prisma.auditLog.create({
    data: {
      companyId: params.companyId,
      actorId: params.actorId ?? null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      payload: JSON.parse(JSON.stringify(params.payload)),
      ipAddress: params.ipAddress ?? null,
    },
  })
}
