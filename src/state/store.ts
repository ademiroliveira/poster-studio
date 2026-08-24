import { useCallback, useEffect, useMemo, useReducer } from 'react'
import { generateAxes, randomSeed, setAxis } from '../poster/harmonics'
import type {
  Axes,
  ContentLayer,
  LayoutId,
  MovementId,
  PhysicsLayer,
  PosterState,
  TypographyLayer,
} from '../poster/types'
import { DEFAULT_STATE } from './defaults'

/**
 * Poster state with undo/redo.
 *
 * The PoC mutated a global `Engine.State` in place and re-rendered by
 * reassigning `innerHTML`, which meant no history, no persistence, and no way
 * to reason about what changed. Here every action produces a new immutable
 * state, so undo is a stack operation and persistence is `JSON.stringify`.
 */

export type Action =
  | { type: 'setContent'; key: keyof ContentLayer; value: string }
  | { type: 'setTitleLine'; index: 0 | 1; value: string }
  | { type: 'setStackLine'; index: 0 | 1 | 2 | 3; value: string }
  | { type: 'setMovement'; value: MovementId }
  | { type: 'setLayout'; value: LayoutId }
  | { type: 'setPaper'; value: string }
  | { type: 'setSignature'; value: string }
  | { type: 'reseed' }
  | { type: 'setSeed'; value: number }
  | { type: 'setPhysics'; key: 'bg' | 'ink' | 'accent' | 'microGrid'; value: string }
  | { type: 'setPhysicsNumber'; key: 'margin' | 'gridOpacity' | 'noise'; value: number }
  | { type: 'setAxis'; key: keyof Axes; value: number }
  | { type: 'setTypography'; key: keyof TypographyLayer; value: number }
  | { type: 'replace'; value: PosterState }
  | { type: 'undo' }
  | { type: 'redo' }

interface History {
  past: PosterState[]
  present: PosterState
  future: PosterState[]
  /** Identifies the last edit so rapid tweaks to one control collapse into one undo step. */
  lastTouch: string | null
  lastTouchAt: number
}

const COALESCE_MS = 700
const MAX_HISTORY = 100

/** Continuous controls; dragging one should not fill the undo stack. */
function touchKey(action: Action): string | null {
  switch (action.type) {
    case 'setContent':
      return `content:${action.key}`
    case 'setTitleLine':
      return `title:${action.index}`
    case 'setStackLine':
      return `stack:${action.index}`
    case 'setSignature':
      return 'signature'
    case 'setPhysics':
      return `physics:${action.key}`
    case 'setPhysicsNumber':
      return `physics:${action.key}`
    case 'setAxis':
      return `axis:${action.key}`
    case 'setTypography':
      return `type:${action.key}`
    default:
      return null
  }
}

function applyAction(state: PosterState, action: Action): PosterState {
  switch (action.type) {
    case 'setContent':
      return { ...state, content: { ...state.content, [action.key]: action.value } }

    case 'setTitleLine': {
      const title: [string, string] = [...state.content.title]
      title[action.index] = action.value
      return { ...state, content: { ...state.content, title } }
    }

    case 'setStackLine': {
      const stack: [string, string, string, string] = [...state.content.stack]
      stack[action.index] = action.value
      return { ...state, content: { ...state.content, stack } }
    }

    case 'setMovement':
      return { ...state, style: { movement: action.value } }

    case 'setLayout': {
      // Regenerate the whole axis set for the new layout. The PoC assigned only
      // the axes a layout happened to use, leaving stale values from the
      // previous layout still influencing the render.
      const layout = action.value
      return {
        ...state,
        architecture: { ...state.architecture, layout },
        physics: { ...state.physics, axes: generateAxes(layout, state.architecture.seed) },
      }
    }

    case 'setPaper':
      return { ...state, paperId: action.value }

    case 'setSignature':
      return { ...state, signature: action.value }

    case 'reseed':
    case 'setSeed': {
      const seed = action.type === 'reseed' ? randomSeed() : action.value >>> 0
      return {
        ...state,
        architecture: { ...state.architecture, seed },
        physics: { ...state.physics, axes: generateAxes(state.architecture.layout, seed) },
      }
    }

    case 'setPhysics':
      return { ...state, physics: { ...state.physics, [action.key]: action.value } as PhysicsLayer }

    case 'setPhysicsNumber':
      return { ...state, physics: { ...state.physics, [action.key]: action.value } }

    case 'setAxis':
      return {
        ...state,
        physics: { ...state.physics, axes: setAxis(state.physics.axes, action.key, action.value) },
      }

    case 'setTypography':
      return { ...state, typography: { ...state.typography, [action.key]: action.value } as TypographyLayer }

    case 'replace':
      return action.value

    default:
      return state
  }
}

function reducer(history: History, action: Action): History {
  if (action.type === 'undo') {
    const previous = history.past[history.past.length - 1]
    if (!previous) return history
    return {
      past: history.past.slice(0, -1),
      present: previous,
      future: [history.present, ...history.future],
      lastTouch: null,
      lastTouchAt: 0,
    }
  }

  if (action.type === 'redo') {
    const next = history.future[0]
    if (!next) return history
    return {
      past: [...history.past, history.present],
      present: next,
      future: history.future.slice(1),
      lastTouch: null,
      lastTouchAt: 0,
    }
  }

  const present = applyAction(history.present, action)
  if (present === history.present) return history

  const key = touchKey(action)
  const now = Date.now()
  const coalesce =
    key !== null && key === history.lastTouch && now - history.lastTouchAt < COALESCE_MS

  const past = coalesce ? history.past : [...history.past, history.present].slice(-MAX_HISTORY)

  return { past, present, future: [], lastTouch: key, lastTouchAt: now }
}

/**
 * Bump this whenever the shape or the meaning of persisted state changes.
 * Axis positions are user-editable, so they are stored rather than re-derived —
 * which means a change to how they are generated leaves old saved values behind.
 */
const STORAGE_KEY = 'poster-studio:state:v2'

function loadPersisted(): PosterState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_STATE
    const parsed = JSON.parse(raw) as Partial<PosterState>
    // Shallow-merge against defaults so a state saved by an older build, or a
    // hand-edited one, cannot leave a required field undefined.
    return {
      ...DEFAULT_STATE,
      ...parsed,
      content: { ...DEFAULT_STATE.content, ...parsed.content },
      style: { ...DEFAULT_STATE.style, ...parsed.style },
      architecture: { ...DEFAULT_STATE.architecture, ...parsed.architecture },
      physics: {
        ...DEFAULT_STATE.physics,
        ...parsed.physics,
        axes: { ...DEFAULT_STATE.physics.axes, ...parsed.physics?.axes },
      },
      typography: { ...DEFAULT_STATE.typography, ...parsed.typography },
    }
  } catch {
    return DEFAULT_STATE
  }
}

export interface Store {
  state: PosterState
  dispatch: (action: Action) => void
  canUndo: boolean
  canRedo: boolean
}

export function usePosterStore(): Store {
  const [history, dispatch] = useReducer(reducer, undefined, () => ({
    past: [],
    present: loadPersisted(),
    future: [],
    lastTouch: null,
    lastTouchAt: 0,
  }))

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(history.present))
      } catch {
        // Private browsing or a full quota; losing persistence is not fatal.
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [history.present])

  const handleKey = useCallback((e: KeyboardEvent) => {
    const meta = e.metaKey || e.ctrlKey
    if (!meta || e.key.toLowerCase() !== 'z') return
    const target = e.target as HTMLElement | null
    if (target && /^(INPUT|TEXTAREA)$/.test(target.tagName)) return
    e.preventDefault()
    dispatch({ type: e.shiftKey ? 'redo' : 'undo' })
  }, [])

  useEffect(() => {
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [handleKey])

  return useMemo(
    () => ({
      state: history.present,
      dispatch,
      canUndo: history.past.length > 0,
      canRedo: history.future.length > 0,
    }),
    [history],
  )
}
