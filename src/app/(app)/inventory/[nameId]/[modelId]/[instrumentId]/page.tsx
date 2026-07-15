import { InstrumentTransactionClient } from './InstrumentTransactionClient'

interface Props {
  params: Promise<{ nameId: string; modelId: string; instrumentId: string }>
}

export default async function InstrumentTransactionPage({ params }: Props) {
  const { nameId, modelId, instrumentId } = await params
  return <InstrumentTransactionClient nameId={nameId} modelId={modelId} instrumentId={instrumentId} />
}
