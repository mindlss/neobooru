import { FormEvent, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Flag, Heart, MessageCircle, Star, Trash2, X } from 'lucide-react'
import {
  useCreateMediaComment,
  useDeleteCommentById,
  useListComments,
} from 'shared/api/generated/comments/comments'
import { useFavorite, useUnfavorite } from 'shared/api/generated/favorites/favorites'
import { getGetMediaQueryKey, useGetMedia } from 'shared/api/generated/media/media'
import { useRateMedia, useUnrateMedia } from 'shared/api/generated/ratings/ratings'
import { useCreate as useCreateReport } from 'shared/api/generated/reports/reports'
import { useGetUserPublic } from 'shared/api/generated/users/users'
import type { CommentDTO } from 'shared/api/generated/model'
import { useSession } from 'features/auth/session'
import { PERMISSIONS } from 'shared/config/permissions'
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  Field,
  IconButton,
  Panel,
  Select,
  Skeleton,
  TextArea,
  TextInput,
} from 'shared/ui'
import { useToast } from 'utils/useToast'

export default function MediaPage() {
  const { id = '' } = useParams()
  const queryClient = useQueryClient()
  const session = useSession()
  const { addToast } = useToast()
  const media = useGetMedia(id)
  const [comment, setComment] = useState('')
  const [reportReason, setReportReason] = useState('rule_violation')
  const [reportDescription, setReportDescription] = useState('')

  const comments = useListComments(
    id,
    { limit: 50 },
    {
      query: {
        enabled: session.hasPermission(PERMISSIONS.commentsRead),
        retry: false,
      },
    },
  )

  const invalidateMedia = () => {
    void queryClient.invalidateQueries({ queryKey: getGetMediaQueryKey(id) })
  }
  const invalidateComments = () => {
    void queryClient.invalidateQueries({ queryKey: comments.queryKey })
  }

  const favorite = useFavorite({ mutation: { onSuccess: invalidateMedia } })
  const unfavorite = useUnfavorite({ mutation: { onSuccess: invalidateMedia } })
  const rate = useRateMedia({
    mutation: {
      onSuccess: () => {
        invalidateMedia()
        addToast({ message: 'Рейтинг сохранен', type: 'success' })
      },
      onError: () => addToast({ message: 'Не удалось сохранить рейтинг', type: 'error' }),
    },
  })
  const unrate = useUnrateMedia({
    mutation: {
      onSuccess: () => {
        invalidateMedia()
        addToast({ message: 'Рейтинг удален', type: 'success' })
      },
      onError: () => addToast({ message: 'Не удалось удалить рейтинг', type: 'error' }),
    },
  })
  const deleteComment = useDeleteCommentById({
    mutation: {
      onSuccess: () => {
        invalidateComments()
        invalidateMedia()
      },
      onError: () => addToast({ message: 'Не удалось удалить комментарий', type: 'error' }),
    },
  })
  const createComment = useCreateMediaComment({
    mutation: {
      onSuccess: () => {
        setComment('')
        invalidateComments()
        invalidateMedia()
      },
    },
  })
  const createReport = useCreateReport({
    mutation: {
      onSuccess: () => {
        setReportDescription('')
        addToast({ message: 'Репорт отправлен', type: 'success' })
      },
      onError: () =>
        addToast({ message: 'Не удалось отправить репорт', type: 'error' }),
    },
  })

  const item = media.data
  const originalUrl = item && 'originalUrl' in item ? item.originalUrl : null
  const source = originalUrl || item?.previewUrl || ''
  const ratingValues = useMemo(() => Array.from({ length: 10 }, (_, i) => i + 1), [])

  const submitComment = (event: FormEvent) => {
    event.preventDefault()
    if (!comment.trim()) return
    createComment.mutate({ id, data: { content: comment.trim() } })
  }

  const submitReport = (event: FormEvent) => {
    event.preventDefault()
    createReport.mutate({
      data: {
        type: 'media',
        targetId: id,
        reason: reportReason,
        description: reportDescription.trim() || undefined,
      },
    })
  }

  if (media.isLoading) return <Skeleton count={3} />
  if (!item) return <EmptyState>Медиа не найдено.</EmptyState>

  return (
    <div className="detail-layout">
      <section className="viewer-panel">
        {source ? (
          item.type === 'VIDEO' ? (
            <video controls src={source} />
          ) : (
            <img src={source} alt={item.description ?? item.id} />
          )
        ) : (
          <div className="media-placeholder large">{item.type}</div>
        )}
      </section>

      <aside className="detail-sidebar">
        <Panel>
          <div className="section-heading compact">
            <div>
              <h1>{item.id.slice(0, 8)}</h1>
              <p>{new Date(item.createdAt).toLocaleString()}</p>
            </div>
            <Badge tone={item.isExplicit ? 'danger' : 'accent'}>
              {item.isExplicit ? '18+' : item.type}
            </Badge>
          </div>
          <p className="description">{item.description || 'Без описания'}</p>
          <div className="stats-row">
            <span>
              <Star size={15} /> {item.ratingAvg.toFixed(1)} / {item.ratingCount}
            </span>
            <span>
              <MessageCircle size={15} /> {item.commentCount}
            </span>
          </div>
          {'moderationStatus' in item && (
            <div className="meta-table">
              <div><span>Status</span><strong>{item.moderationStatus}</strong></div>
              <div><span>Size</span><strong>{(item.size / 1024 / 1024).toFixed(2)} MB</strong></div>
              <div><span>Type</span><strong>{item.contentType}</strong></div>
              {item.width && item.height && (
                <div><span>Resolution</span><strong>{item.width}x{item.height}</strong></div>
              )}
            </div>
          )}
          <div className="tag-row expanded">
            {item.tags.map((tag) => (
              <span key={tag.id} style={{ color: tag.color }}>
                {tag.name}
              </span>
            ))}
          </div>
        </Panel>

        {session.isAuthenticated && (
          <Panel>
            <h2>Действия</h2>
            <div className="button-row">
              {session.hasPermission(PERMISSIONS.favoritesAdd) &&
                !item.favorite && (
                  <Button disabled={favorite.isPending} onClick={() => favorite.mutate({ id })}>
                    <Heart size={16} /> В избранное
                  </Button>
                )}
              {session.hasPermission(PERMISSIONS.favoritesRemove) &&
                item.favorite && (
                  <Button disabled={unfavorite.isPending} variant="ghost" onClick={() => unfavorite.mutate({ id })}>
                    <Heart size={16} /> Убрать
                  </Button>
                )}
            </div>
            {session.hasPermission(PERMISSIONS.ratingsSet) && (
              <div className="rating-box">
                <div className="rating-summary">
                  <strong>Моя оценка: {item.myRating ?? 'нет'}</strong>
                  {session.hasPermission(PERMISSIONS.ratingsRemove) && item.myRating && (
                    <Button disabled={unrate.isPending} type="button" variant="ghost" onClick={() => unrate.mutate({ id })}>
                      <X size={16} /> Снять
                    </Button>
                  )}
                </div>
                <div className="rating-row ten">
                  {ratingValues.map((value) => (
                    <button
                      className={item.myRating === value ? 'active' : ''}
                      disabled={rate.isPending}
                      key={value}
                      type="button"
                      onClick={() => rate.mutate({ id, data: { value } })}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </Panel>
        )}

        {session.hasPermission(PERMISSIONS.reportsCreate) && (
          <Panel>
            <h2>Репорт</h2>
            <form className="stack" onSubmit={submitReport}>
              <Select
                value={reportReason}
                onChange={(event) => setReportReason(event.target.value)}
              >
                <option value="rule_violation">Нарушение правил</option>
                <option value="duplicate">Дубликат</option>
                <option value="wrong_tags">Неверные теги</option>
              </Select>
              <TextArea
                rows={3}
                value={reportDescription}
                onChange={(event) => setReportDescription(event.target.value)}
              />
              <Button disabled={createReport.isPending} type="submit">
                <Flag size={16} /> Отправить
              </Button>
            </form>
          </Panel>
        )}
      </aside>

      <section className="comments-column">
        <Panel>
          <h2>Комментарии</h2>
          {session.hasPermission(PERMISSIONS.commentsCreate) && (
            <form className="stack" onSubmit={submitComment}>
              <TextArea
                rows={3}
                value={comment}
                onChange={(event) => setComment(event.target.value)}
              />
              <Button disabled={!comment.trim() || createComment.isPending}>
                Написать
              </Button>
            </form>
          )}
          {comments.data?.data.length ? (
            <div className="comment-list">
              {comments.data.data.map((entry) => (
                <CommentRow
                  comment={entry}
                  isDeleting={deleteComment.isPending}
                  key={entry.id}
                  onDelete={(reason) =>
                    deleteComment.mutate({ id: entry.id, data: { reason } })
                  }
                />
              ))}
            </div>
          ) : (
            <p className="muted-text">Комментариев пока нет.</p>
          )}
        </Panel>
      </section>
    </div>
  )
}

function CommentRow({
  comment,
  isDeleting,
  onDelete,
}: {
  comment: CommentDTO
  isDeleting: boolean
  onDelete: (reason?: string) => void
}) {
  const session = useSession()
  const [isReasonOpen, setIsReasonOpen] = useState(false)
  const [reason, setReason] = useState('')
  const author = useGetUserPublic(comment.user.id, {
    query: { retry: false, staleTime: 60_000 },
  })
  const isOwner = session.user?.id === comment.userId
  const canDeleteOwn =
    isOwner && session.hasPermission(PERMISSIONS.commentsDeleteOwn)
  const canDeleteAny =
    !isOwner && session.hasPermission(PERMISSIONS.commentsDeleteAny)
  const canDelete = !comment.isDeleted && (canDeleteOwn || canDeleteAny)

  return (
    <article className="comment-item">
      <div className="comment-author">
        <Avatar alt={comment.user.username} src={author.data?.avatarUrl} />
        <div>
          <strong>
            <Link to={`/users/${comment.user.id}`}>{comment.user.username}</Link>
          </strong>
          <span>{new Date(comment.createdAt).toLocaleString()}</span>
        </div>
        {canDelete && (
          <IconButton
            aria-label="Удалить комментарий"
            disabled={isDeleting}
            type="button"
            onClick={() => {
              if (canDeleteAny) setIsReasonOpen((value) => !value)
              else onDelete()
            }}
          >
            <Trash2 size={16} />
          </IconButton>
        )}
      </div>
      <p>{comment.isDeleted ? 'Комментарий удален' : comment.content}</p>
      {comment.deletedReason && <p className="muted-text">Reason: {comment.deletedReason}</p>}
      {isReasonOpen && (
        <div className="delete-reason-row">
          <Field label="Moderator reason">
            <TextInput value={reason} onChange={(event) => setReason(event.target.value)} />
          </Field>
          <Button type="button" variant="danger" onClick={() => onDelete(reason.trim() || undefined)}>
            Удалить
          </Button>
        </div>
      )}
    </article>
  )
}
