import { useRef, useState, type DragEvent } from 'react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import LinearProgress from '@mui/material/LinearProgress'
import Alert from '@mui/material/Alert'
import { alpha } from '@mui/material/styles'
import UploadFileOutlined from '@mui/icons-material/UploadFileOutlined'
import DescriptionOutlined from '@mui/icons-material/DescriptionOutlined'
import PictureAsPdfOutlined from '@mui/icons-material/PictureAsPdfOutlined'
import ImageOutlined from '@mui/icons-material/ImageOutlined'
import CloseRounded from '@mui/icons-material/CloseRounded'
import AddRounded from '@mui/icons-material/AddRounded'
import DeleteOutline from '@mui/icons-material/DeleteOutlineRounded'
import { openDocument, uploadDocument, type ProjectDocument } from '../../api/projects'
import { errorMessage } from '../../api/client'
import FieldGroup from './FieldGroup'
import type { StepProps } from './StepBasics'

const ACCEPT = '.pdf,.doc,.docx,.txt,.md,.png,.jpg,.jpeg'

const formatSize = (bytes: number) =>
  bytes >= 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`

const docIcon = (type: string) =>
  type === 'application/pdf' ? <PictureAsPdfOutlined /> : type.startsWith('image/') ? <ImageOutlined /> : <DescriptionOutlined />

interface Upload {
  key: string
  name: string
  progress: number
  error?: string
}

interface Props extends StepProps {
  documents: ProjectDocument[]
  setDocuments: (update: (docs: ProjectDocument[]) => ProjectDocument[]) => void
}

function TextArea({
  field,
  label,
  hint,
  rows,
  error,
  form,
  update,
}: {
  field: 'summary' | 'commitments'
  label: string
  hint: string
  rows: number
  error?: string
  form: StepProps['form']
  update: StepProps['update']
}) {
  return (
    <FieldGroup title={label} hint={hint}>
      <TextField
        multiline
        minRows={rows}
        value={form[field]}
        onChange={(e) => update({ [field]: e.target.value })}
        error={Boolean(error)}
        helperText={error}
        slotProps={{ htmlInput: { maxLength: 10000, 'aria-label': label } }}
        fullWidth
      />
    </FieldGroup>
  )
}

export default function StepDocuments({ form, update, errors, documents, setDocuments }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const [uploads, setUploads] = useState<Upload[]>([])
  const [dragging, setDragging] = useState(false)
  const [openError, setOpenError] = useState<string | null>(null)

  async function addFiles(files: FileList | File[]) {
    for (const file of Array.from(files)) {
      const key = `${file.name}-${crypto.randomUUID()}`
      setUploads((u) => [...u, { key, name: file.name, progress: 0 }])
      try {
        const doc = await uploadDocument(file, (progress) =>
          setUploads((u) => u.map((x) => (x.key === key ? { ...x, progress } : x))),
        )
        setUploads((u) => u.filter((x) => x.key !== key))
        setDocuments((docs) => [...docs, doc])
      } catch (err) {
        setUploads((u) => u.map((x) => (x.key === key ? { ...x, error: errorMessage(err, 'Upload failed') } : x)))
      }
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files)
  }

  const fields = form.custom_fields
  const setField = (i: number, patch: Partial<(typeof fields)[number]>) =>
    update({ custom_fields: fields.map((f, j) => (j === i ? { ...f, ...patch } : f)) })

  return (
    <Stack spacing={4}>
      <FieldGroup title="Documents" hint="PDF, Word, text or image files, up to 20 MB each.">
        <Box
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          sx={(t) => ({
            p: 3,
            borderRadius: 3,
            border: '1.5px dashed',
            borderColor: dragging ? 'primary.main' : 'divider',
            bgcolor: dragging ? alpha(t.palette.primary.main, 0.05) : 'background.default',
            textAlign: 'center',
            transition: 'all 120ms',
          })}
        >
          <UploadFileOutlined sx={{ fontSize: 32, color: 'primary.main', mb: 1 }} />
          <Typography sx={{ fontWeight: 600 }}>Drag files here</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            PDF, Word, text or images
          </Typography>
          <Button variant="outlined" onClick={() => input.current?.click()} sx={{ bgcolor: 'background.paper' }}>
            Choose files
          </Button>
          <input
            ref={input}
            type="file"
            accept={ACCEPT}
            multiple
            hidden
            onChange={(e) => {
              if (e.target.files) addFiles(e.target.files)
              e.target.value = ''
            }}
          />
        </Box>

        {(documents.length > 0 || uploads.length > 0) && (
          <Stack component="ul" spacing={1} sx={{ listStyle: 'none', p: 0, m: 0, mt: 1.5 }}>
            {documents.map((doc) => (
              <Stack
                component="li"
                key={doc.id}
                direction="row"
                spacing={1.5}
                sx={{ alignItems: 'center', p: 1.25, pl: 1.5, border: 1, borderColor: 'divider', borderRadius: 2 }}
              >
                <Box sx={{ color: 'primary.main', display: 'flex' }}>{docIcon(doc.content_type)}</Box>
                <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                  <Typography
                    variant="body2"
                    noWrap
                    component="button"
                    type="button"
                    onClick={() => openDocument(doc).catch((err) => setOpenError(errorMessage(err)))}
                    sx={{
                      display: 'block',
                      maxWidth: '100%',
                      fontWeight: 500,
                      border: 0,
                      p: 0,
                      bgcolor: 'transparent',
                      color: 'text.primary',
                      cursor: 'pointer',
                      font: 'inherit',
                      textAlign: 'left',
                      '&:hover': { textDecoration: 'underline' },
                    }}
                  >
                    {doc.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatSize(doc.size)}
                  </Typography>
                </Box>
                <IconButton
                  aria-label={`Remove ${doc.name}`}
                  onClick={() => setDocuments((docs) => docs.filter((d) => d.id !== doc.id))}
                >
                  <CloseRounded fontSize="small" />
                </IconButton>
              </Stack>
            ))}
            {uploads.map((u) => (
              <Box component="li" key={u.key} sx={{ p: 1.25, px: 1.5, border: 1, borderColor: 'divider', borderRadius: 2 }}>
                <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2" noWrap sx={{ fontWeight: 500 }}>
                    {u.name}
                  </Typography>
                  {u.error && (
                    <IconButton
                      size="small"
                      aria-label="Dismiss"
                      onClick={() => setUploads((all) => all.filter((x) => x.key !== u.key))}
                    >
                      <CloseRounded fontSize="small" />
                    </IconButton>
                  )}
                </Stack>
                {u.error ? (
                  <Typography variant="caption" color="error">
                    {u.error}
                  </Typography>
                ) : (
                  <LinearProgress variant="determinate" value={u.progress * 100} sx={{ mt: 1, borderRadius: 1 }} />
                )}
              </Box>
            ))}
          </Stack>
        )}
        {openError && (
          <Alert severity="error" variant="outlined" sx={{ mt: 1.5 }} onClose={() => setOpenError(null)}>
            {openError}
          </Alert>
        )}
      </FieldGroup>

      <TextArea
        field="summary"
        label="Summary"
        hint="What is happening, where, why and what happens next."
        rows={5}
        error={errors.summary}
        form={form}
        update={update}
      />

      <TextArea
        field="commitments"
        label="Commitments"
        hint="What the council promises residents."
        rows={4}
        form={form}
        update={update}
      />

      <FieldGroup
        title="Custom fields"
        hint="Any other details to show on the project."
        action={
          <Button
            size="small"
            startIcon={<AddRounded />}
            onClick={() => update({ custom_fields: [...fields, { label: '', value: '' }] })}
            sx={{ py: 0.5, flexShrink: 0 }}
          >
            Add field
          </Button>
        }
      >
        {fields.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
            No custom fields yet.
          </Typography>
        ) : (
          <Stack spacing={1.5}>
            {fields.map((f, i) => (
              <Stack key={i} direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: { sm: 'center' } }}>
                <TextField
                  size="small"
                  label="Label"
                  value={f.label}
                  onChange={(e) => setField(i, { label: e.target.value })}
                  sx={{ flex: { sm: '0 0 34%' } }}
                />
                <TextField
                  size="small"
                  label="Value"
                  value={f.value}
                  onChange={(e) => setField(i, { value: e.target.value })}
                  fullWidth
                />
                <IconButton
                  aria-label="Remove field"
                  onClick={() => update({ custom_fields: fields.filter((_, j) => j !== i) })}
                  sx={{ alignSelf: { xs: 'flex-end', sm: 'center' } }}
                >
                  <DeleteOutline fontSize="small" />
                </IconButton>
              </Stack>
            ))}
          </Stack>
        )}
      </FieldGroup>
    </Stack>
  )
}
