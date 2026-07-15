import { InstrumentDetailClient } from './InstrumentDetailClient'

interface Props {
  params: Promise<{ nameId: string; modelId: string }>
}

export default async function InstrumentDetailPage({ params }: Props) {
  const { nameId, modelId } = await params
  return <InstrumentDetailClient nameId={nameId} modelId={modelId} />
}
