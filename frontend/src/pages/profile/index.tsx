import { FormEvent, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Calendar, MessageCircle, Settings, Star, UploadCloud } from 'lucide-react'
import {
  getGetMeQueryKey,
  useGetUserComments,
  useGetUserFavorites,
  useGetUserPublic,
  useGetUserRatings,
  useGetUserUploads,
  usePatchMe,
  useUploadMyAvatar,
} from 'shared/api/generated/users/users'
import { MediaCard } from 'entities/media/ui'
import { useSession } from 'features/auth/session'
import { PERMISSIONS } from 'shared/config/permissions'
import { Seo } from 'shared/seo'
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  Field,
  Panel,
  Select,
  Skeleton,
  Tabs,
  TextArea,
  TextInput,
  Toolbar,
} from 'shared/ui'
import { useToast } from 'utils/useToast'

type ProfileTab = 'uploads' | 'favorites' | 'ratings' | 'comments' | 'settings'
type Sort = 'new' | 'old'
type MediaTypeFilter = 'all' | 'IMAGE' | 'VIDEO'

const visibleTabs: Array<{ id: ProfileTab; label: string }> = [
  { id: 'uploads', label: 'Uploads' },
  { id: 'favorites', label: 'Favorites' },
  { id: 'ratings', label: 'Ratings' },
  { id: 'comments', label: 'Comments' },
]

export default function ProfilePage() {
  const { id } = useParams()
  const session = useSession()
  const isMe = !id || id === session.user?.id
  const userId = isMe ? session.user?.id ?? '' : id ?? ''
  const publicUser = useGetUserPublic(userId, {
    query: { enabled: !!userId && !isMe, retry: false },
  })
  const user = isMe ? session.user : publicUser.data
  const [tab, setTab] = useState<ProfileTab>('uploads')

  const tabs = useMemo(
    () => [
      ...visibleTabs,
      ...(isMe ? [{ id: 'settings' as const, label: 'Settings' }] : []),
    ],
    [isMe],
  )

  if (!userId) return <EmptyState>Профиль недоступен.</EmptyState>
  if (!isMe && publicUser.isLoading) return <Skeleton count={2} />
  if (!user) return <EmptyState>Пользователь не найден.</EmptyState>

  const roles: string[] =
    'roles' in user && Array.isArray(user.roles)
      ? user.roles.filter((role): role is string => typeof role === 'string')
      : []
  const isBanned = 'isBanned' in user ? Boolean(user.isBanned) : false
  const email = 'email' in user && typeof user.email === 'string' ? user.email : null
  const uploadCount =
    'uploadCount' in user && typeof user.uploadCount === 'number'
      ? user.uploadCount
      : null
  const warningCount =
    'warningCount' in user && typeof user.warningCount === 'number'
      ? user.warningCount
      : null

  return (
    <div className="profile-dashboard">
      <Seo
        title={isMe ? 'Мой профиль' : user.username}
        description={user.bio || `Публичный профиль ${user.username} на neobooru.`}
        image={user.avatarUrl}
        type="profile"
        noIndex={isMe || isBanned}
      />
      <aside className="profile-summary">
        <Panel>
          <div className="profile-head compact">
            <Avatar alt={user.username} size="lg" src={user.avatarUrl} />
            <div>
              <h1>{user.username}</h1>
              {email && <p>{email}</p>}
              <p>
                <Calendar size={14} /> {new Date(user.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
          {user.bio && <p className="description">{user.bio}</p>}
          {user.website && (
            <a className="text-link" href={user.website} rel="noreferrer" target="_blank">
              {user.website}
            </a>
          )}
          {!!roles.length || isBanned ? (
            <div className="button-row">
              {roles.map((role) => (
                <Badge key={role} tone="accent">
                  {role}
                </Badge>
              ))}
              {isBanned && <Badge tone="danger">banned</Badge>}
            </div>
          ) : null}
          {uploadCount !== null && (
            <div className="metric-grid">
              <div>
                <strong>{uploadCount}</strong>
                <span>uploads</span>
              </div>
              <div>
                <strong>{warningCount ?? 0}</strong>
                <span>warnings</span>
              </div>
            </div>
          )}
        </Panel>
      </aside>

      <section className="profile-main">
        <Tabs items={tabs} value={tab} onChange={setTab} />
        {tab === 'uploads' && <MediaSection id={userId} kind="uploads" />}
        {tab === 'favorites' && <MediaSection id={userId} kind="favorites" />}
        {tab === 'ratings' && <RatingsSection id={userId} />}
        {tab === 'comments' && <CommentsSection id={userId} />}
        {tab === 'settings' && isMe && <SettingsSection />}
      </section>
    </div>
  )
}

function MediaSection({ id, kind }: { id: string; kind: 'uploads' | 'favorites' }) {
  const [sort, setSort] = useState<Sort>('new')
  const [type, setType] = useState<MediaTypeFilter>('all')
  const [cursor, setCursor] = useState<string | undefined>()
  const params = {
    limit: 36,
    sort,
    ...(type === 'all' ? {} : { type }),
    ...(cursor ? { cursor } : {}),
  }
  const uploads = useGetUserUploads(id, params, {
    query: { enabled: kind === 'uploads', retry: false },
  })
  const favorites = useGetUserFavorites(id, params, {
    query: { enabled: kind === 'favorites', retry: false },
  })
  const query = kind === 'uploads' ? uploads : favorites
  const items = query.data?.data ?? []

  return (
    <Panel>
      <Toolbar>
        <Field label="Sort">
          <Select
            value={sort}
            onChange={(event) => {
              setCursor(undefined)
              setSort(event.target.value as Sort)
            }}
          >
            <option value="new">new</option>
            <option value="old">old</option>
          </Select>
        </Field>
        <Field label="Type">
          <Select
            value={type}
            onChange={(event) => {
              setCursor(undefined)
              setType(event.target.value as MediaTypeFilter)
            }}
          >
            <option value="all">all</option>
            <option value="IMAGE">image</option>
            <option value="VIDEO">video</option>
          </Select>
        </Field>
      </Toolbar>
      {query.isLoading ? (
        <div className="media-grid">
          <Skeleton count={8} />
        </div>
      ) : items.length ? (
        <>
          <div className="media-grid">
            {items.map((item) => (
              <MediaCard item={item} key={item.id} />
            ))}
          </div>
          {query.data?.nextCursor && (
            <div className="center-row">
              <Button type="button" onClick={() => setCursor(query.data?.nextCursor ?? undefined)}>
                Следующая страница
              </Button>
            </div>
          )}
        </>
      ) : (
        <EmptyState>Раздел пуст или скрыт настройками приватности.</EmptyState>
      )}
    </Panel>
  )
}

function RatingsSection({ id }: { id: string }) {
  const [sort, setSort] = useState<Sort>('new')
  const [type, setType] = useState<MediaTypeFilter>('all')
  const [cursor, setCursor] = useState<string | undefined>()
  const ratings = useGetUserRatings(
    id,
    {
      limit: 36,
      sort,
      ...(type === 'all' ? {} : { type }),
      ...(cursor ? { cursor } : {}),
    },
    { query: { retry: false } },
  )

  return (
    <Panel>
      <Toolbar>
        <Field label="Sort">
          <Select
            value={sort}
            onChange={(event) => {
              setCursor(undefined)
              setSort(event.target.value as Sort)
            }}
          >
            <option value="new">new</option>
            <option value="old">old</option>
          </Select>
        </Field>
        <Field label="Type">
          <Select
            value={type}
            onChange={(event) => {
              setCursor(undefined)
              setType(event.target.value as MediaTypeFilter)
            }}
          >
            <option value="all">all</option>
            <option value="IMAGE">image</option>
            <option value="VIDEO">video</option>
          </Select>
        </Field>
      </Toolbar>
      {ratings.isLoading ? (
        <div className="media-grid">
          <Skeleton count={8} />
        </div>
      ) : ratings.data?.data.length ? (
        <>
          <div className="media-grid">
            {ratings.data.data.map((item) => (
              <div className="rated-card" key={item.media.id}>
                <Badge tone="accent">
                  <Star size={13} /> {item.value}/10
                </Badge>
                <MediaCard item={item.media} />
              </div>
            ))}
          </div>
          {ratings.data.nextCursor && (
            <div className="center-row">
              <Button type="button" onClick={() => setCursor(ratings.data?.nextCursor ?? undefined)}>
                Следующая страница
              </Button>
            </div>
          )}
        </>
      ) : (
        <EmptyState>Рейтингов нет или раздел скрыт.</EmptyState>
      )}
    </Panel>
  )
}

function CommentsSection({ id }: { id: string }) {
  const [sort, setSort] = useState<Sort>('new')
  const [cursor, setCursor] = useState<string | undefined>()
  const comments = useGetUserComments(
    id,
    { limit: 40, sort, ...(cursor ? { cursor } : {}) },
    { query: { retry: false } },
  )

  return (
    <Panel>
      <Toolbar>
        <Field label="Sort">
          <Select
            value={sort}
            onChange={(event) => {
              setCursor(undefined)
              setSort(event.target.value as Sort)
            }}
          >
            <option value="new">new</option>
            <option value="old">old</option>
          </Select>
        </Field>
      </Toolbar>
      {comments.isLoading ? (
        <Skeleton count={4} />
      ) : comments.data?.data.length ? (
        <>
          <div className="comment-list profile-comments">
            {comments.data.data.map((comment) => (
              <article key={comment.id}>
                <div>
                  <strong>
                    <Link to={`/media/${comment.mediaId}`}>media {comment.mediaId.slice(0, 8)}</Link>
                  </strong>
                  <span>{new Date(comment.createdAt).toLocaleString()}</span>
                </div>
                <p>{comment.isDeleted ? 'Комментарий удален' : comment.content}</p>
              </article>
            ))}
          </div>
          {comments.data.nextCursor && (
            <div className="center-row">
              <Button type="button" onClick={() => setCursor(comments.data?.nextCursor ?? undefined)}>
                Следующая страница
              </Button>
            </div>
          )}
        </>
      ) : (
        <EmptyState>Комментариев нет или раздел скрыт.</EmptyState>
      )}
    </Panel>
  )
}

function SettingsSection() {
  const session = useSession()
  const user = session.user
  const queryClient = useQueryClient()
  const { addToast } = useToast()
  const [bio, setBio] = useState(user?.bio ?? '')
  const [website, setWebsite] = useState(user?.website ?? '')
  const [showUploads, setShowUploads] = useState(user?.showUploads ?? true)
  const [showFavorites, setShowFavorites] = useState(user?.showFavorites ?? true)
  const [showComments, setShowComments] = useState(user?.showComments ?? true)
  const [showRatings, setShowRatings] = useState(user?.showRatings ?? true)

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() })
  }
  const patchMe = usePatchMe({
    mutation: {
      onSuccess: () => {
        invalidate()
        addToast({ message: 'Профиль обновлен', type: 'success' })
      },
      onError: () => addToast({ message: 'Не удалось обновить профиль', type: 'error' }),
    },
  })
  const uploadAvatar = useUploadMyAvatar({
    mutation: {
      onSuccess: () => {
        invalidate()
        addToast({ message: 'Аватар обновлен', type: 'success' })
      },
      onError: () => addToast({ message: 'Не удалось загрузить аватар', type: 'error' }),
    },
  })

  if (!user) return null

  const submit = (event: FormEvent) => {
    event.preventDefault()
    patchMe.mutate({
      data: {
        bio: bio.trim() || null,
        website: website.trim() || null,
        showUploads,
        showFavorites,
        showComments,
        showRatings,
      },
    })
  }

  return (
    <div className="settings-grid">
      <Panel>
        <div className="section-heading compact">
          <div>
            <h2>
              <Settings size={18} /> Profile settings
            </h2>
            <p>Bio, website and privacy controls.</p>
          </div>
        </div>
        <form className="stack" onSubmit={submit}>
          <Field label="Bio">
            <TextArea rows={4} value={bio} onChange={(event) => setBio(event.target.value)} />
          </Field>
          <Field label="Website">
            <TextInput value={website} onChange={(event) => setWebsite(event.target.value)} />
          </Field>
          <div className="checkbox-grid">
            <label><input checked={showUploads} type="checkbox" onChange={(event) => setShowUploads(event.target.checked)} /> Показывать uploads</label>
            <label><input checked={showFavorites} type="checkbox" onChange={(event) => setShowFavorites(event.target.checked)} /> Показывать favorites</label>
            <label><input checked={showComments} type="checkbox" onChange={(event) => setShowComments(event.target.checked)} /> Показывать comments</label>
            <label><input checked={showRatings} type="checkbox" onChange={(event) => setShowRatings(event.target.checked)} /> Показывать ratings</label>
          </div>
          <Button disabled={patchMe.isPending || !session.hasPermission(PERMISSIONS.usersUpdateSelf)}>
            Сохранить
          </Button>
        </form>
      </Panel>
      <Panel>
        <h2>
          <UploadCloud size={18} /> Avatar
        </h2>
        <div className="avatar-upload-row">
          <Avatar alt={user.username} size="lg" src={user.avatarUrl} />
          <TextInput
            accept="image/*"
            disabled={!session.hasPermission(PERMISSIONS.usersAvatarUpdateSelf)}
            type="file"
            onChange={(event) => {
              const avatar = event.target.files?.[0]
              if (avatar) uploadAvatar.mutate({ data: { avatar } })
            }}
          />
        </div>
      </Panel>
      <Panel>
        <h2>
          <MessageCircle size={18} /> Visibility
        </h2>
        <p className="muted-text">
          Privacy is enforced by the backend. Staff with private-profile permission may still inspect hidden sections.
        </p>
      </Panel>
    </div>
  )
}
