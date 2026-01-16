export interface PendingChange {
  id: string
  row: number
  col: number
  oldValue: string
  newValue: string
  reason?: string
  confidence?: number
  status: 'pending' | 'accepted' | 'rejected'
}

export interface DiffPreviewState {
  changes: PendingChange[]
  isVisible: boolean
  sourceMessage?: string
}
