import type {
  SearchComicItemDTO,
  SearchMediaItemDTO,
} from 'shared/api/generated/model'

export function isComicItem(
  item: SearchMediaItemDTO | SearchComicItemDTO,
): item is SearchComicItemDTO {
  return 'title' in item
}

export function previewOf(item: { previewUrl: string | null }) {
  return item.previewUrl || ''
}
