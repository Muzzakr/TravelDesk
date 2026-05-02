import { TextractClient, AnalyzeDocumentCommand } from '@aws-sdk/client-textract'

const textract = new TextractClient({
  region: process.env.AWS_REGION ?? 'eu-north-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

export interface OcrResult {
  merchant: string | null
  amount: number | null
  date: string | null
  raw: Record<string, unknown>
}

export async function extractReceiptData(
  s3Bucket: string,
  s3Key: string
): Promise<OcrResult> {
  const command = new AnalyzeDocumentCommand({
    Document: { S3Object: { Bucket: s3Bucket, Name: s3Key } },
    FeatureTypes: ['FORMS'],
  })

  const response = await textract.send(command)
  const blocks = response.Blocks ?? []

  const keyValues: Record<string, string> = {}
  const keyMap: Record<string, string> = {}
  const valueMap: Record<string, string> = {}

  for (const block of blocks) {
    if (block.BlockType === 'KEY_VALUE_SET' && block.Id) {
      const text = getBlockText(block as { Relationships?: Array<{ Type: string; Ids?: string[] }> }, blocks)
      if (block.EntityTypes?.includes('KEY')) {
        keyMap[block.Id] = text
      } else {
        valueMap[block.Id] = text
      }
    }
  }

  for (const [keyId, keyText] of Object.entries(keyMap)) {
    const block = blocks.find((b) => b.Id === keyId)
    const valueId = block?.Relationships?.find((r) => r.Type === 'VALUE')?.Ids?.[0]
    if (valueId && valueMap[valueId]) {
      keyValues[keyText.toLowerCase()] = valueMap[valueId]
    }
  }

  const merchant = extractMerchant(keyValues, blocks)
  const amount = extractAmount(keyValues)
  const date = extractDate(keyValues)

  return { merchant, amount, date, raw: keyValues }
}

function getBlockText(
  block: { Relationships?: Array<{ Type: string; Ids?: string[] }> },
  allBlocks: Array<{ Id?: string; BlockType?: string; Text?: string }>
): string {
  const wordIds = block.Relationships?.find((r) => r.Type === 'CHILD')?.Ids ?? []
  return wordIds
    .map((id) => allBlocks.find((b) => b.Id === id)?.Text ?? '')
    .join(' ')
    .trim()
}

function extractMerchant(
  kv: Record<string, string>,
  blocks: Array<{ BlockType?: string; Text?: string; Confidence?: number }>
): string | null {
  const candidates = ['merchant', 'store', 'vendor', 'business', 'restaurant', 'company']
  for (const key of candidates) {
    const found = Object.entries(kv).find(([k]) => k.includes(key))
    if (found) return found[1]
  }
  // Fall back to first high-confidence LINE block
  const line = blocks.find(
    (b) => b.BlockType === 'LINE' && (b.Confidence ?? 0) > 90 && b.Text
  )
  return line?.Text ?? null
}

function extractAmount(kv: Record<string, string>): number | null {
  const candidates = ['total', 'amount', 'grand total', 'subtotal', 'sum']
  for (const key of candidates) {
    const found = Object.entries(kv).find(([k]) => k.includes(key))
    if (found) {
      const num = parseFloat(found[1].replace(/[^0-9.]/g, ''))
      if (!isNaN(num)) return num
    }
  }
  return null
}

function extractDate(kv: Record<string, string>): string | null {
  const candidates = ['date', 'invoice date', 'transaction date']
  for (const key of candidates) {
    const found = Object.entries(kv).find(([k]) => k.includes(key))
    if (found) return found[1]
  }
  return null
}
