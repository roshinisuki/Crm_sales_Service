import { CRMSpinner } from '@/components/CRMSpinner'

export default function Loading() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem 0' }}>
      <CRMSpinner size={48} label="Loading..." />
    </div>
  )
}
