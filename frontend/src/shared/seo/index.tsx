import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const SITE_NAME = 'neobooru'
const DEFAULT_TITLE = SITE_NAME
const DEFAULT_DESCRIPTION = 'Поиск, просмотр и каталогизация медиа по тегам.'

interface SeoProps {
  title?: string
  description?: string | null
  image?: string | null
  type?: 'website' | 'article' | 'profile'
  noIndex?: boolean
}

function upsertMeta(selector: string, attributes: Record<string, string>) {
  let element = document.head.querySelector<HTMLMetaElement>(selector)

  if (!element) {
    element = document.createElement('meta')
    document.head.appendChild(element)
  }

  Object.entries(attributes).forEach(([name, value]) => {
    element?.setAttribute(name, value)
  })
}

function upsertCanonical(href: string) {
  let element = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')

  if (!element) {
    element = document.createElement('link')
    element.rel = 'canonical'
    document.head.appendChild(element)
  }

  element.href = href
}

function removeMeta(selector: string) {
  document.head.querySelector(selector)?.remove()
}

export function Seo({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  image,
  type = 'website',
  noIndex = false,
}: SeoProps) {
  const location = useLocation()

  useEffect(() => {
    const resolvedTitle = title === SITE_NAME ? SITE_NAME : `${title} | ${SITE_NAME}`
    const resolvedDescription = description || DEFAULT_DESCRIPTION
    const canonical = `${window.location.origin}${location.pathname}`

    document.title = resolvedTitle
    upsertCanonical(canonical)

    upsertMeta('meta[name="description"]', {
      name: 'description',
      content: resolvedDescription,
    })
    upsertMeta('meta[name="robots"]', {
      name: 'robots',
      content: noIndex ? 'noindex,nofollow' : 'index,follow',
    })
    upsertMeta('meta[property="og:site_name"]', {
      property: 'og:site_name',
      content: SITE_NAME,
    })
    upsertMeta('meta[property="og:title"]', {
      property: 'og:title',
      content: resolvedTitle,
    })
    upsertMeta('meta[property="og:description"]', {
      property: 'og:description',
      content: resolvedDescription,
    })
    upsertMeta('meta[property="og:type"]', {
      property: 'og:type',
      content: type,
    })
    upsertMeta('meta[property="og:url"]', {
      property: 'og:url',
      content: canonical,
    })
    upsertMeta('meta[name="twitter:card"]', {
      name: 'twitter:card',
      content: image ? 'summary_large_image' : 'summary',
    })
    upsertMeta('meta[name="twitter:title"]', {
      name: 'twitter:title',
      content: resolvedTitle,
    })
    upsertMeta('meta[name="twitter:description"]', {
      name: 'twitter:description',
      content: resolvedDescription,
    })

    if (image) {
      upsertMeta('meta[property="og:image"]', {
        property: 'og:image',
        content: image,
      })
      upsertMeta('meta[name="twitter:image"]', {
        name: 'twitter:image',
        content: image,
      })
    } else {
      removeMeta('meta[property="og:image"]')
      removeMeta('meta[name="twitter:image"]')
    }
  }, [description, image, location.pathname, noIndex, title, type])

  return null
}
