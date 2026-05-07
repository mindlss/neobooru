import { describe, expect, it } from 'vitest'
import { isComicItem, previewOf } from './model'

describe('media model helpers', () => {
  it('detects comic search items by title', () => {
    expect(isComicItem({ id: 'm1', type: 'IMAGE' } as never)).toBe(false)
    expect(isComicItem({ id: 'c1', title: 'Comic' } as never)).toBe(true)
  })

  it('normalizes missing previews to an empty string', () => {
    expect(previewOf({ previewUrl: 'https://cdn.test/image.jpg' })).toBe(
      'https://cdn.test/image.jpg',
    )
    expect(previewOf({ previewUrl: null })).toBe('')
  })
})
