import { Link } from 'react-router-dom'
import { MessageCircle, Star } from 'lucide-react'
import type {
  MediaVisibleDTO,
  SearchMediaItemDTO,
  SearchComicItemDTO,
} from 'shared/api/generated/model'
import { Badge } from 'shared/ui'
import { previewOf } from './model'

type MediaLike = MediaVisibleDTO | SearchMediaItemDTO

export function MediaCard({ item }: { item: MediaLike }) {
  const href = `/media/${item.id}`
  const preview = previewOf(item)

  return (
    <Link className="media-card" to={href}>
      {preview ? (
        <img src={preview} alt={item.description ?? item.id} loading="lazy" />
      ) : (
        <div className="media-placeholder">{item.type}</div>
      )}
      <div className="media-card__meta">
        <Badge tone={item.isExplicit ? 'danger' : 'accent'}>
          {item.isExplicit ? '18+' : item.type}
        </Badge>
        <span>
          <Star size={13} /> {item.ratingAvg.toFixed(1)}
        </span>
        <span>
          <MessageCircle size={13} /> {item.commentCount}
        </span>
      </div>
      {!!item.tags?.length && (
        <div className="tag-row">
          {item.tags.slice(0, 4).map((tag) => (
            <span key={tag.id} style={{ color: tag.color }}>
              {tag.name}
            </span>
          ))}
        </div>
      )}
    </Link>
  )
}

export function ComicCard({ item }: { item: SearchComicItemDTO }) {
  return (
    <div className="media-card">
      {item.previewUrl ? (
        <img src={item.previewUrl} alt={item.title} loading="lazy" />
      ) : (
        <div className="media-placeholder">COMIC</div>
      )}
      <div className="media-card__meta">
        <Badge tone={item.isExplicit ? 'danger' : 'accent'}>{item.status}</Badge>
        <span>
          <Star size={13} /> {item.ratingAvg.toFixed(1)}
        </span>
      </div>
      <strong className="comic-title">{item.title}</strong>
    </div>
  )
}
