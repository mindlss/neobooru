import { Link } from 'react-router-dom'
import { BookOpen, Search } from 'lucide-react'
import { Badge, Panel } from 'shared/ui'

const examples = [
  {
    query: 'blue_eyes rating:>=7 -comic',
    note: 'media with tag blue_eyes, rating at least 7, comics excluded',
  },
  {
    query: '(cat_ears OR fox_ears) type:image sort:rating',
    note: 'image results matching either tag, sorted by rating',
  },
  {
    query: 'comic uploaded:2026-01-01..2026-01-31 sort:last_page',
    note: 'comic mode with January 2026 uploads',
  },
  {
    query: 'ratio:16/9 width:>=1280 comments:>10',
    note: 'wide media with minimum width and active comments',
  },
]

export default function SearchHelpPage() {
  return (
    <div className="docs-layout">
      <aside className="docs-nav">
        <Panel>
          <h1>
            <BookOpen size={20} /> Search
          </h1>
          <a href="#terms">Terms</a>
          <a href="#operators">Operators</a>
          <a href="#filters">Filters</a>
          <a href="#sort">Sort</a>
          <a href="#examples">Examples</a>
        </Panel>
      </aside>
      <section className="docs-content">
        <Panel>
          <div className="section-heading compact">
            <div>
              <h1>Справка по поиску</h1>
              <p>Синтаксис соответствует backend parser.</p>
            </div>
            <Link className="ui-button" to="/">
              <Search size={16} /> Искать
            </Link>
          </div>
        </Panel>

        <Panel>
          <h2 id="terms">Теги и базовый запрос</h2>
          <div className="docs-grid">
            <div><code>blue_eyes</code><span>ищет тег, пробелы нормализуются в underscore</span></div>
            <div><code>tag1 tag2</code><span>между термами автоматически ставится AND</span></div>
            <div><code>comic</code><span>включает comic mode</span></div>
            <div><code>-comic</code><span>запрещает принудительный comic mode</span></div>
          </div>
        </Panel>

        <Panel>
          <h2 id="operators">Операторы</h2>
          <div className="docs-grid">
            <div><code>-tag</code><span>короткая форма NOT</span></div>
            <div><code>NOT tag</code><span>явное отрицание</span></div>
            <div><code>tag1 OR tag2</code><span>логическое OR</span></div>
            <div><code>tag1 | tag2</code><span>короткая форма OR</span></div>
            <div><code>(tag1 OR tag2) -tag3</code><span>группировка скобками</span></div>
          </div>
        </Panel>

        <Panel>
          <h2 id="filters">Фильтры</h2>
          <div className="docs-grid">
            <div><code>type:image</code><span>IMAGE results</span></div>
            <div><code>type:video</code><span>VIDEO results</span></div>
            <div><code>uploaded:2026-05-07</code><span>точная дата загрузки</span></div>
            <div><code>uploaded:&gt;=2026-01-01</code><span>сравнение даты</span></div>
            <div><code>uploaded:2026-01-01..2026-01-31</code><span>диапазон дат</span></div>
            <div><code>width:&gt;=1280</code><span>числовые сравнения</span></div>
            <div><code>height:720</code><span>точное числовое значение</span></div>
            <div><code>rating:7..10</code><span>числовой диапазон</span></div>
            <div><code>rating_count:&gt;20</code><span>количество оценок</span></div>
            <div><code>comments:&gt;5</code><span>количество комментариев</span></div>
            <div><code>duration:&lt;60</code><span>длительность видео</span></div>
            <div><code>size:&lt;10485760</code><span>размер файла в байтах</span></div>
            <div><code>ratio:16/9</code><span>соотношение сторон</span></div>
            <div><code>ratio:1.3..1.9</code><span>диапазон ratio</span></div>
          </div>
        </Panel>

        <Panel>
          <h2 id="sort">Сортировка</h2>
          <div className="tag-row expanded">
            {['new', 'old', 'updated', 'rating', 'rating_count', 'random', 'last_page'].map((item) => (
              <Badge key={item} tone="accent">sort:{item}</Badge>
            ))}
          </div>
        </Panel>

        <Panel>
          <h2 id="examples">Примеры</h2>
          <div className="docs-examples">
            {examples.map((example) => (
              <div key={example.query}>
                <code>{example.query}</code>
                <span>{example.note}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel>
          <h2>Visibility</h2>
          <p className="muted-text">
            Explicit, unmoderated and deleted media are filtered by backend permissions and viewer age.
            Если прав нет, такие результаты не появятся даже при точном совпадении запроса.
          </p>
        </Panel>
      </section>
    </div>
  )
}
