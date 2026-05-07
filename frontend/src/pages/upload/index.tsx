import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload } from 'lucide-react'
import { useUploadMedia } from 'shared/api/generated/media/media'
import { Button, Panel, TextArea, TextInput } from 'shared/ui'
import { useToast } from 'utils/useToast'

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null)
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState('')
  const navigate = useNavigate()
  const { addToast } = useToast()

  const upload = useUploadMedia({
    mutation: {
      onSuccess: (result) => {
        addToast({ message: 'Файл загружен', type: 'success' })
        navigate(`/media/${result.id}`)
      },
      onError: () =>
        addToast({ message: 'Не удалось загрузить файл', type: 'error' }),
    },
  })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!file) return
    upload.mutate({
      data: {
        file,
        description: description.trim() || undefined,
        tags: tags.trim() || undefined,
      },
    })
  }

  return (
    <div className="narrow-page">
      <Panel>
        <div className="section-heading compact">
          <div>
            <h1>Загрузка</h1>
            <p>Файл уйдет в очередь модерации, если это требуется ролями.</p>
          </div>
        </div>
        <form className="stack" onSubmit={submit}>
          <label>
            Файл
            <TextInput
              accept="image/*,video/*"
              required
              type="file"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </label>
          <label>
            Описание
            <TextArea
              rows={4}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
          <label>
            Теги
            <TextInput
              placeholder="tag_one tag_two"
              value={tags}
              onChange={(event) => setTags(event.target.value)}
            />
          </label>
          <Button disabled={!file || upload.isPending} type="submit">
            <Upload size={16} />
            Загрузить
          </Button>
        </form>
      </Panel>
    </div>
  )
}
