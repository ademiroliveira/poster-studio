import { generateAxes } from '../poster/harmonics'
import type { PosterState } from '../poster/types'
import { DEFAULT_PAPER } from '../poster/units'

export const DEFAULT_STATE: PosterState = {
  paperId: DEFAULT_PAPER.id,
  signature: 'a_o',
  content: {
    id: '001',
    concept: 'CUSTODY',
    title: ['SELF', 'CUSTODY'],
    stack: ['SE', 'LF', 'CUST', 'ODY'],
    payload: 'Architecture of Ownership',
    desc: 'Every user faces the same problem: trust. Without cryptographic self-sovereignty, assets float arbitrarily on centralized ledgers.',
    meta: 'SECP256K1',
  },
  style: { movement: 'swiss' },
  architecture: { layout: 'anchor', seed: 1 },
  physics: {
    bg: '#F4F4F4',
    ink: '#121212',
    accent: '#DE3824',
    margin: 3,
    axes: generateAxes('anchor', 1),
    microGrid: 'none',
    gridOpacity: 0.25,
    noise: 0.08,
  },
  typography: {
    titleScale: 1,
    tracking: -0.05,
    leading: 0.85,
  },
}
