import { FormEvent, useMemo, useState } from 'react'
import { Link, NavLink, Navigate, useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import {
  Check,
  ExternalLink,
  FileWarning,
  Play,
  ShieldCheck,
  Tags,
  X,
} from 'lucide-react'
import { useListJobs, useRunJob } from 'shared/api/generated/jobs/jobs'
import { getGetMediaQueryKey, useGetMedia } from 'shared/api/generated/media/media'
import { useApprove, useGetQueue, useReject } from 'shared/api/generated/moderation/moderation'
import {
  useAdminList,
  useAdminPatch,
  useAdminTargets,
} from 'shared/api/generated/reports/reports'
import {
  useCreateTagAlias,
  useDeleteTagAlias,
  useListTagAliases,
  usePatch,
  useSearchTags,
} from 'shared/api/generated/tags/tags'
import { previewOf } from 'entities/media/model'
import { useSession } from 'features/auth/session'
import { PERMISSIONS, STAFF_PERMISSIONS } from 'shared/config/permissions'
import { Seo } from 'shared/seo'
import {
  Badge,
  Button,
  EmptyState,
  Field,
  InlinePreview,
  Panel,
  Select,
  Skeleton,
  TextInput,
  Toolbar,
} from 'shared/ui'
import { useToast } from 'utils/useToast'

type AdminSection = 'moderation' | 'reports' | 'tags' | 'jobs'
type ReportStatus = 'pending' | 'reviewing' | 'resolved' | 'rejected'
type ReportType = 'all' | 'media' | 'comment'

const SECTIONS: Array<{
  id: AdminSection
  label: string
  permissions: string[]
}> = [
  {
    id: 'moderation',
    label: 'Moderation',
    permissions: [
      PERMISSIONS.moderationQueueRead,
      PERMISSIONS.moderationMediaApprove,
      PERMISSIONS.moderationMediaReject,
    ],
  },
  {
    id: 'reports',
    label: 'Reports',
    permissions: [PERMISSIONS.reportsAdminRead, PERMISSIONS.reportsAdminUpdate],
  },
  {
    id: 'tags',
    label: 'Tags',
    permissions: [PERMISSIONS.tagsManage, PERMISSIONS.tagsAliasesManage],
  },
  { id: 'jobs', label: 'Jobs', permissions: [PERMISSIONS.jobsRun] },
]

export default function AdminPage() {
  const { section } = useParams()
  const session = useSession()
  const allowedSections = SECTIONS.filter((item) =>
    session.hasAnyPermission(item.permissions),
  )
  const active = (section as AdminSection | undefined) ?? allowedSections[0]?.id

  if (!session.hasAnyPermission(STAFF_PERMISSIONS)) {
    return <EmptyState>Админ-панель недоступна для текущего пользователя.</EmptyState>
  }

  if (!section && active) return <Navigate to={`/admin/${active}`} replace />

  return (
    <div className="admin-layout">
      <Seo title="Admin" description="Административный раздел neobooru." noIndex />
      <aside className="admin-nav">
        <h1>Admin</h1>
        {allowedSections.map((item) => (
          <NavLink key={item.id} to={`/admin/${item.id}`}>
            {item.label}
          </NavLink>
        ))}
      </aside>
      <section className="admin-content">
        {active === 'moderation' && <ModerationSection />}
        {active === 'reports' && <ReportsSection />}
        {active === 'tags' && <TagsSection />}
        {active === 'jobs' && <JobsSection />}
      </section>
    </div>
  )
}

function ModerationSection() {
  const queryClient = useQueryClient()
  const session = useSession()
  const [cursor, setCursor] = useState<string | undefined>()
  const [cursorHistory, setCursorHistory] = useState<string[]>([])
  const queue = useGetQueue(
    { limit: 24, ...(cursor ? { cursor } : {}) },
    { query: { enabled: session.hasPermission(PERMISSIONS.moderationQueueRead) } },
  )
  const [notes, setNotes] = useState<Record<string, string>>({})
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: queue.queryKey })
  }
  const approve = useApprove({ mutation: { onSuccess: invalidate } })
  const reject = useReject({ mutation: { onSuccess: invalidate } })

  return (
    <Panel>
      <div className="section-heading compact">
        <div>
          <h1>Moderation queue</h1>
          <p>Pending media. The current API does not expose uploader filters.</p>
        </div>
        <Badge tone="muted">{queue.data?.data.length ?? 0} loaded</Badge>
      </div>
      {queue.isLoading ? (
        <Skeleton count={6} />
      ) : queue.data?.data.length ? (
        <div className="admin-card-list">
          {queue.data.data.map((item) => (
            <article className="admin-card" key={item.id}>
              <MediaQuickPreview id={item.id} />
              <div className="admin-card__body">
                <div className="admin-card__title">
                  <strong>{item.id}</strong>
                  <Badge tone={item.isExplicit ? 'danger' : 'accent'}>
                    {item.moderationStatus}
                  </Badge>
                </div>
                <p>
                  {item.type} · {item.contentType} · {(item.size / 1024 / 1024).toFixed(2)} MB ·{' '}
                  {new Date(item.createdAt).toLocaleString()}
                </p>
                <TextInput
                  placeholder="moderation notes"
                  value={notes[item.id] ?? ''}
                  onChange={(event) =>
                    setNotes((prev) => ({ ...prev, [item.id]: event.target.value }))
                  }
                />
              </div>
              <div className="admin-card__actions">
                <Button className="as-link" type="button" variant="ghost">
                  <Link to={`/media/${item.id}`}>
                    <ExternalLink size={16} /> Open
                  </Link>
                </Button>
                {session.hasPermission(PERMISSIONS.moderationMediaApprove) && (
                  <Button
                    disabled={approve.isPending}
                    type="button"
                    onClick={() =>
                      approve.mutate({
                        id: item.id,
                        data: { notes: notes[item.id] || undefined },
                      })
                    }
                  >
                    <Check size={16} /> Approve
                  </Button>
                )}
                {session.hasPermission(PERMISSIONS.moderationMediaReject) && (
                  <Button
                    disabled={reject.isPending}
                    type="button"
                    variant="danger"
                    onClick={() =>
                      reject.mutate({
                        id: item.id,
                        data: { notes: notes[item.id] || undefined },
                      })
                    }
                  >
                    <X size={16} /> Reject
                  </Button>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState>Очередь пуста.</EmptyState>
      )}
      <div className="ui-pager">
        <Button
          disabled={!cursorHistory.length}
          type="button"
          variant="ghost"
          onClick={() => {
            const previous = cursorHistory[cursorHistory.length - 1]
            setCursorHistory((items) => items.slice(0, -1))
            setCursor(previous)
          }}
        >
          Назад
        </Button>
        <Button
          disabled={!queue.data?.nextCursor}
          type="button"
          variant="ghost"
          onClick={() => {
            setCursorHistory((items) => [...items, cursor ?? ''])
            setCursor(queue.data?.nextCursor ?? undefined)
          }}
        >
          Дальше
        </Button>
      </div>
    </Panel>
  )
}

function ReportsSection() {
  const queryClient = useQueryClient()
  const session = useSession()
  const [status, setStatus] = useState<ReportStatus>('pending')
  const [type, setType] = useState<ReportType>('all')
  const [order, setOrder] = useState<'old' | 'new'>('old')
  const [search, setSearch] = useState('')
  const [cursor, setCursor] = useState<string | undefined>()
  const [targetPage, setTargetPage] = useState(1)
  const reportParams = {
    limit: 36,
    status,
    order,
    ...(type === 'all' ? {} : { type }),
    ...(cursor ? { cursor } : {}),
  }
  const targetParams = {
    limit: 12,
    page: targetPage,
    status,
    order: 'count_desc' as const,
    ...(type === 'all' ? {} : { type }),
  }
  const reports = useAdminList(reportParams, {
    query: { enabled: session.hasPermission(PERMISSIONS.reportsAdminRead) },
  })
  const targets = useAdminTargets(targetParams, {
    query: { enabled: session.hasPermission(PERMISSIONS.reportsAdminRead) },
  })
  const patchReport = useAdminPatch({
    mutation: {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: reports.queryKey })
        void queryClient.invalidateQueries({ queryKey: targets.queryKey })
      },
    },
  })

  const filteredReports = useMemo(() => {
    const needle = search.trim().toLowerCase()
    const data = reports.data?.data ?? []
    if (!needle) return data
    return data.filter((report) =>
      [
        report.reportedByUsername,
        report.reportedById,
        report.targetId,
        report.reason,
      ].some((value) => value.toLowerCase().includes(needle)),
    )
  }, [reports.data?.data, search])

  return (
    <div className="stack">
      <Panel>
        <div className="section-heading compact">
          <div>
            <h1>Reports</h1>
            <p>Server filters plus page-local text filtering.</p>
          </div>
          <Badge tone="muted">{filteredReports.length} visible</Badge>
        </div>
        <Toolbar>
          <Field label="Status">
            <Select value={status} onChange={(event) => setStatus(event.target.value as ReportStatus)}>
              <option value="pending">pending</option>
              <option value="reviewing">reviewing</option>
              <option value="resolved">resolved</option>
              <option value="rejected">rejected</option>
            </Select>
          </Field>
          <Field label="Type">
            <Select value={type} onChange={(event) => setType(event.target.value as ReportType)}>
              <option value="all">all</option>
              <option value="media">media</option>
              <option value="comment">comment</option>
            </Select>
          </Field>
          <Field label="Order">
            <Select value={order} onChange={(event) => setOrder(event.target.value as 'old' | 'new')}>
              <option value="old">old</option>
              <option value="new">new</option>
            </Select>
          </Field>
          <Field label="Page filter">
            <TextInput
              placeholder="reporter, user id, target id, reason"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </Field>
        </Toolbar>
        <div className="target-grid">
          {(targets.data?.data ?? []).map((target) => (
            <div key={`${target.type}:${target.targetId}`}>
              <strong>{target.type}</strong>
              <span>{target.targetId}</span>
              <Badge tone="accent">{target.reportCount}</Badge>
            </div>
          ))}
        </div>
        <div className="ui-pager">
          <Button
            disabled={targetPage <= 1}
            type="button"
            variant="ghost"
            onClick={() => setTargetPage((page) => Math.max(1, page - 1))}
          >
            Targets назад
          </Button>
          <Button
            disabled={!targets.data || targetPage >= targets.data.totalPages}
            type="button"
            variant="ghost"
            onClick={() => setTargetPage((page) => page + 1)}
          >
            Targets дальше
          </Button>
        </div>
      </Panel>
      <Panel>
        {reports.isLoading ? (
          <Skeleton count={6} />
        ) : filteredReports.length ? (
          <div className="admin-card-list">
            {filteredReports.map((report) => (
              <article className="admin-card" key={report.id}>
                {report.type === 'media' ? (
                  <MediaQuickPreview id={report.targetId} />
                ) : (
                  <InlinePreview>
                    <FileWarning size={22} />
                    <span>comment preview unavailable</span>
                  </InlinePreview>
                )}
                <div className="admin-card__body">
                  <div className="admin-card__title">
                    <strong>{report.reason}</strong>
                    <Badge>{report.status}</Badge>
                  </div>
                  <p>
                    {report.type} · {report.targetId} · by{' '}
                    <Link className="text-link" to={`/users/${report.reportedById}`}>
                      {report.reportedByUsername}
                    </Link>
                  </p>
                  {report.description && <p>{report.description}</p>}
                  <p>
                    created {new Date(report.createdAt).toLocaleString()}
                    {report.assignedToUsername ? ` · assigned ${report.assignedToUsername}` : ''}
                  </p>
                </div>
                <div className="admin-card__actions">
                  {report.type === 'media' && (
                    <Button type="button" variant="ghost">
                      <Link to={`/media/${report.targetId}`}>
                        <ExternalLink size={16} /> Media
                      </Link>
                    </Button>
                  )}
                  {session.hasPermission(PERMISSIONS.reportsAdminUpdate) && (
                    <Select
                      value={report.status}
                      onChange={(event) =>
                        patchReport.mutate({
                          id: report.id,
                          data: { status: event.target.value as ReportStatus },
                        })
                      }
                    >
                      <option value="pending">pending</option>
                      <option value="reviewing">reviewing</option>
                      <option value="resolved">resolved</option>
                      <option value="rejected">rejected</option>
                    </Select>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState>Репорты не найдены на текущей странице.</EmptyState>
        )}
        <div className="ui-pager">
          <Button
            disabled={!cursor}
            type="button"
            variant="ghost"
            onClick={() => setCursor(undefined)}
          >
            В начало
          </Button>
          <Button
            disabled={!reports.data?.nextCursor}
            type="button"
            variant="ghost"
            onClick={() => setCursor(reports.data?.nextCursor ?? undefined)}
          >
            Следующая страница
          </Button>
        </div>
      </Panel>
    </div>
  )
}

function TagsSection() {
  const session = useSession()
  const queryClient = useQueryClient()
  const [q, setQ] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [customColor, setCustomColor] = useState('#1AB6A9')
  const [alias, setAlias] = useState('')
  const [isExplicit, setIsExplicit] = useState(false)
  const tags = useSearchTags(
    { q: q || 'a', limit: 25 },
    {
      query: {
        enabled:
          session.hasPermission(PERMISSIONS.tagsManage) ||
          session.hasPermission(PERMISSIONS.tagsAliasesManage),
      },
    },
  )
  const aliases = useListTagAliases(selectedId, {
    query: {
      enabled: !!selectedId && session.hasPermission(PERMISSIONS.tagsAliasesManage),
    },
  })
  const selected = useMemo(
    () => tags.data?.data.find((tag) => tag.canonicalId === selectedId),
    [selectedId, tags.data?.data],
  )
  const aliasItems = (aliases.data?.data ?? []) as Array<{
    id: string
    alias?: string
    name?: string
  }>
  const patchTag = usePatch({
    mutation: {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: tags.queryKey })
      },
    },
  })
  const createAlias = useCreateTagAlias({
    mutation: {
      onSuccess: () => {
        setAlias('')
        void aliases.refetch()
      },
    },
  })
  const deleteAlias = useDeleteTagAlias({
    mutation: { onSuccess: () => void aliases.refetch() },
  })

  const submitPatch = (event: FormEvent) => {
    event.preventDefault()
    if (!selectedId) return
    patchTag.mutate({ id: selectedId, data: { customColor, isExplicit } })
  }

  return (
    <div className="tag-admin">
      <Panel>
        <div className="section-heading compact">
          <div>
            <h1>Tags</h1>
            <p>Tag color, explicit flag and aliases.</p>
          </div>
        </div>
        <TextInput
          placeholder="search tags"
          value={q}
          onChange={(event) => setQ(event.target.value)}
        />
        <div className="tag-pick-list">
          {(tags.data?.data ?? []).map((tag) => (
            <button
              className={selectedId === tag.canonicalId ? 'active' : ''}
              key={`${tag.kind}:${tag.id}`}
              type="button"
              onClick={() => {
                setSelectedId(tag.canonicalId)
                setCustomColor(tag.color)
              }}
            >
              <Tags size={14} />
              <span style={{ color: tag.color }}>{tag.canonicalName}</span>
              <small>{tag.usageCount}</small>
            </button>
          ))}
        </div>
      </Panel>
      <Panel>
        <h2>{selected?.canonicalName ?? 'Выберите тег'}</h2>
        <form className="stack" onSubmit={submitPatch}>
          <Field label="Custom color">
            <TextInput
              disabled={!session.hasPermission(PERMISSIONS.tagsManage)}
              type="color"
              value={customColor}
              onChange={(event) => setCustomColor(event.target.value)}
            />
          </Field>
          <label className="inline-check">
            <input
              checked={isExplicit}
              disabled={!session.hasPermission(PERMISSIONS.tagsManage)}
              type="checkbox"
              onChange={(event) => setIsExplicit(event.target.checked)}
            />
            explicit
          </label>
          <Button
            disabled={!selectedId || !session.hasPermission(PERMISSIONS.tagsManage)}
          >
            Сохранить тег
          </Button>
        </form>
        {session.hasPermission(PERMISSIONS.tagsAliasesManage) && selectedId && (
          <div className="stack alias-box">
            <h3>Aliases</h3>
            <form
              className="inline-form"
              onSubmit={(event) => {
                event.preventDefault()
                if (alias.trim()) {
                  createAlias.mutate({
                    id: selectedId,
                    data: { alias: alias.trim() },
                  })
                }
              }}
            >
              <TextInput value={alias} onChange={(event) => setAlias(event.target.value)} />
              <Button>Create</Button>
            </form>
            {aliasItems.map((item) => (
              <div className="alias-row" key={item.id}>
                <span>{item.alias ?? item.name ?? item.id}</span>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => deleteAlias.mutate({ id: item.id })}
                >
                  delete
                </Button>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  )
}

function JobsSection() {
  const { addToast } = useToast()
  const queryClient = useQueryClient()
  const jobs = useListJobs()
  const runJob = useRunJob({
    mutation: {
      onSuccess: (result) => {
        addToast({
          message: result.data.result.message ?? 'Job completed',
          type: result.data.result.ok ? 'success' : 'warning',
        })
        void queryClient.invalidateQueries({ queryKey: jobs.queryKey })
      },
    },
  })

  return (
    <Panel>
      <div className="section-heading compact">
        <div>
          <h1>Jobs</h1>
          <p>Manual staff jobs.</p>
        </div>
      </div>
      <div className="job-grid">
        {(jobs.data?.allowedJobs ?? []).map((job) => (
          <button key={job} type="button" onClick={() => runJob.mutate({ name: job })}>
            <ShieldCheck size={18} />
            <span>{job}</span>
            <Play size={16} />
          </button>
        ))}
      </div>
    </Panel>
  )
}

function MediaQuickPreview({ id }: { id: string }) {
  const queryClient = useQueryClient()
  const media = useGetMedia(id, {
    query: {
      retry: false,
      staleTime: 30_000,
    },
  })
  const item = media.data
  const preview = item ? previewOf(item) : null

  return (
    <InlinePreview>
      {media.isLoading ? (
        <span>loading</span>
      ) : preview ? (
        item?.type === 'VIDEO' ? (
          <video muted src={preview} />
        ) : (
          <img src={preview} alt={id} loading="lazy" />
        )
      ) : (
        <span>{item?.type ?? 'no preview'}</span>
      )}
      {item && (
        <button
          type="button"
          onClick={() => void queryClient.invalidateQueries({ queryKey: getGetMediaQueryKey(id) })}
        >
          refresh
        </button>
      )}
    </InlinePreview>
  )
}
