import { FormEvent, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search } from 'lucide-react'
import { useSearch } from 'shared/api/generated/search/search'
import { usePopular } from 'shared/api/generated/tags/tags'
import { isComicItem } from 'entities/media/model'
import { ComicCard, MediaCard } from 'entities/media/ui'
import { Seo } from 'shared/seo'
import { Button, EmptyState, Panel, Select, Skeleton, TextInput } from 'shared/ui'

export default function HomePage() {
  const [params, setParams] = useSearchParams()
  const [cursor, setCursor] = useState<string | undefined>()
  const q = params.get('q') ?? ''
  const sort = params.get('sort') ?? 'new'
  const requestQuery = [q, sort ? `sort:${sort}` : ''].filter(Boolean).join(' ')

  const searchQuery = useSearch({ q: requestQuery, limit: 36, cursor })
  const popular = usePopular({ limit: 28 })
  const [draft, setDraft] = useState(q)

  const items = searchQuery.data?.data ?? []

  const title = useMemo(() => {
    if (q) return `Результаты для "${q}"`
    return 'Свежие загрузки'
  }, [q])

  const submitSearch = (event: FormEvent) => {
    event.preventDefault()
    setCursor(undefined)
    setParams((next) => {
      if (draft.trim()) next.set('q', draft.trim())
      else next.delete('q')
      next.set('sort', sort)
      return next
    })
  }

  return (
    <div className="page-grid">
      <Seo
        title={q ? `Поиск: ${q}` : 'Свежие загрузки'}
        description={
          q
            ? `Результаты поиска neobooru по запросу "${q}".`
            : 'Свежие медиа, популярные теги и поиск по каталогу neobooru.'
        }
      />
      <aside className="sidebar">
        <Panel>
          <h2>Поиск</h2>
          <form className="stack" onSubmit={submitSearch}>
            <label>
              Запрос
              <TextInput
                placeholder="blue_eyes rating:safe"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
              />
            </label>
            <label>
              Сортировка
              <Select
                value={sort}
                onChange={(event) => {
                  setCursor(undefined)
                  setParams((next) => {
                    next.set('sort', event.target.value)
                    return next
                  })
                }}
              >
                <option value="new">Новые</option>
                <option value="old">Старые</option>
                <option value="random">Случайно</option>
                <option value="rating">Рейтинг</option>
              </Select>
            </label>
            <Button type="submit">
              <Search size={16} />
              Искать
            </Button>
          </form>
        </Panel>

        <Panel>
          <h2>Популярные теги</h2>
          <div className="tag-cloud">
            {(popular.data?.data ?? []).map((tag) => (
              <button
                key={tag.id}
                style={{ color: tag.color }}
                type="button"
                onClick={() => {
                  setDraft(tag.name)
                  setCursor(undefined)
                  setParams({ q: tag.name, sort })
                }}
              >
                {tag.name}
                <span>{tag.usageCount}</span>
              </button>
            ))}
          </div>
        </Panel>
      </aside>

      <section className="content-column">
        <div className="section-heading">
          <div>
            <h1>{title}</h1>
            <p>
              {searchQuery.data?.meta.comicMode
                ? 'Режим комиксов'
                : 'Медиа, теги и быстрый просмотр'}
            </p>
          </div>
          <span>{items.length} на странице</span>
        </div>

        {searchQuery.isLoading ? (
          <div className="media-grid">
            <Skeleton count={12} />
          </div>
        ) : items.length ? (
          <>
            <div className="media-grid">
              {items.map((item) =>
                isComicItem(item) ? (
                  <ComicCard item={item} key={item.id} />
                ) : (
                  <MediaCard item={item} key={item.id} />
                ),
              )}
            </div>
            {searchQuery.data?.nextCursor && (
              <div className="center-row">
                <Button onClick={() => setCursor(searchQuery.data.nextCursor!)}>
                  Следующая страница
                </Button>
              </div>
            )}
          </>
        ) : (
          <EmptyState>Ничего не найдено.</EmptyState>
        )}
      </section>
    </div>
  )
}
