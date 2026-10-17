import { useCallback, useEffect, useMemo, useState } from 'react'
import { useBlocker, useNavigate, useSearchParams } from 'react-router'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Stepper from '@mui/material/Stepper'
import Step from '@mui/material/Step'
import StepButton from '@mui/material/StepButton'
import StepLabel from '@mui/material/StepLabel'
import LinearProgress from '@mui/material/LinearProgress'
import Alert from '@mui/material/Alert'
import Snackbar from '@mui/material/Snackbar'
import CircularProgress from '@mui/material/CircularProgress'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogActions from '@mui/material/DialogActions'
import ArrowBack from '@mui/icons-material/ArrowBackRounded'
import ArrowForward from '@mui/icons-material/ArrowForwardRounded'
import PublishRounded from '@mui/icons-material/PublishRounded'
import {
  emptyProject,
  fetchDraft,
  publishProject,
  saveDraft,
  type ProjectDocument,
  type ProjectForm,
} from '../api/projects'
import { errorMessage } from '../api/client'
import StepBasics from '../components/project/StepBasics'
import StepLocation from '../components/project/StepLocation'
import StepDocuments from '../components/project/StepDocuments'
import StepTerms from '../components/project/StepTerms'
import StepEngagement from '../components/project/StepEngagement'
import { allErrors, steps } from '../components/project/validation'

export default function NewProject() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  // Read once: later ?draft changes come from our own saves
  const [draftParam] = useState(() => Number(params.get('draft')) || undefined)

  const [form, setForm] = useState<ProjectForm>(emptyProject)
  const [documents, setDocumentsState] = useState<ProjectDocument[]>([])
  const [draftId, setDraftId] = useState<number | undefined>(draftParam)
  const [step, setStep] = useState(0)
  const [visited, setVisited] = useState(() => steps.map((_, i) => i === 0))
  const [dirty, setDirty] = useState(false)
  const [loading, setLoading] = useState(Boolean(draftParam))
  const [saving, setSaving] = useState<'draft' | 'publish' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  // Resume a draft from ?draft=<id>
  useEffect(() => {
    if (!draftParam) return
    let cancelled = false
    fetchDraft(draftParam)
      .then((d) => {
        if (cancelled) return
        setForm(d.form)
        setDocumentsState(d.documents)
        setDraftId(d.id)
        setVisited(steps.map(() => true))
      })
      .catch((err) => !cancelled && setError(errorMessage(err, 'Couldn’t open that draft.')))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [draftParam])

  const update = useCallback((patch: Partial<ProjectForm>) => {
    setForm((f) => ({ ...f, ...patch }))
    setDirty(true)
  }, [])

  const setDocuments = useCallback((change: (docs: ProjectDocument[]) => ProjectDocument[]) => {
    setDocumentsState(change)
    setDirty(true)
  }, [])

  // Documents keep their names for display; what's saved only carries their ids
  const fullForm = useMemo(() => ({ ...form, document_ids: documents.map((d) => d.id) }), [form, documents])
  const errors = useMemo(() => allErrors(fullForm), [fullForm])
  const shownErrors = visited[step] ? errors[step] : {}

  // Warn before leaving with unsaved changes
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && !saving && currentLocation.pathname !== nextLocation.pathname)
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  function goTo(next: number) {
    setVisited((v) => v.map((x, i) => x || i === step || i === next))
    setStep(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function onSaveDraft() {
    setSaving('draft')
    setError(null)
    try {
      const saved = await saveDraft(fullForm, draftId)
      setDraftId(saved.id)
      setParams({ draft: String(saved.id) }, { replace: true })
      setDirty(false)
      setToast('Draft saved')
    } catch (err) {
      setError(errorMessage(err, 'Couldn’t save the draft.'))
    } finally {
      setSaving(null)
    }
  }

  async function onPublish() {
    setVisited(steps.map(() => true))
    const firstBad = errors.findIndex((e) => Object.keys(e).length)
    if (firstBad !== -1) {
      setStep(firstBad)
      setError('A few things need fixing before this can go live. They’re highlighted below.')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    setSaving('publish')
    setError(null)
    try {
      const project = await publishProject(fullForm, draftId)
      setDirty(false)
      navigate('/', { state: { flash: `“${project.title}” is now live on the map` } })
    } catch (err) {
      setError(errorMessage(err, 'Couldn’t publish the project.'))
      setSaving(null)
    }
  }

  const stepProps = { form: fullForm, update, errors: shownErrors }
  const isLast = step === steps.length - 1

  if (loading) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', py: 12 }}>
        <CircularProgress size={28} />
      </Box>
    )
  }

  return (
    <Box sx={{ maxWidth: 1040, mx: 'auto', pb: 12 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="overline" sx={{ color: 'primary.main' }}>
          {draftId ? 'Draft' : 'New project'}
        </Typography>
        <Typography variant="h2" component="h1" sx={{ mt: 0.5 }}>
          {form.title.trim() || 'Create a project'}
        </Typography>
      </Box>

      {/* Progress: full stepper on desktop, compact bar on phones */}
      <Paper variant="outlined" sx={{ display: { xs: 'none', md: 'block' }, px: 3, py: 2.5, mb: 3 }}>
        <Stepper nonLinear activeStep={step} alternativeLabel>
          {steps.map((s, i) => {
            const bad = visited[i] && Object.keys(errors[i]).length > 0
            return (
              <Step key={s.key} completed={visited[i] && !bad && i !== step}>
                <StepButton onClick={() => goTo(i)}>
                  <StepLabel error={bad}>{s.label}</StepLabel>
                </StepButton>
              </Step>
            )
          })}
        </Stepper>
      </Paper>
      <Box sx={{ display: { md: 'none' }, mb: 3 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Step {step + 1} of {steps.length} ·{' '}
          <Box component="span" sx={{ color: 'text.primary', fontWeight: 600 }}>
            {steps[step].label}
          </Box>
        </Typography>
        <LinearProgress variant="determinate" value={((step + 1) / steps.length) * 100} sx={{ borderRadius: 1, height: 6 }} />
      </Box>

      {error && (
        <Alert severity="error" variant="outlined" sx={{ mb: 3, bgcolor: 'background.paper' }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Paper variant="outlined" sx={{ p: { xs: 2.5, sm: 4 } }}>
        <Typography variant="h6" component="h2" sx={{ fontWeight: 650 }}>
          {steps[step].label}
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 4 }}>
          {steps[step].description}
        </Typography>

        {step === 0 && <StepBasics {...stepProps} />}
        {step === 1 && <StepLocation {...stepProps} />}
        {step === 2 && <StepDocuments {...stepProps} documents={documents} setDocuments={setDocuments} />}
        {step === 3 && <StepTerms {...stepProps} />}
        {step === 4 && <StepEngagement {...stepProps} />}
      </Paper>

      {/* Sticky action bar */}
      <Box
        sx={(t) => ({
          position: 'fixed',
          left: { xs: 0, md: 252 },
          right: 0,
          bottom: 0,
          zIndex: t.zIndex.appBar,
          bgcolor: 'background.paper',
          borderTop: 1,
          borderColor: 'divider',
        })}
      >
        <Stack
          direction="row"
          spacing={1.5}
          sx={{ maxWidth: 1040, mx: 'auto', px: { xs: 2, sm: 3, lg: 4 }, py: 1.5, alignItems: 'center' }}
        >
          <Button startIcon={<ArrowBack />} onClick={() => goTo(step - 1)} disabled={step === 0} color="inherit">
            Back
          </Button>
          <Box sx={{ flexGrow: 1 }} />
          <Button variant="outlined" onClick={onSaveDraft} disabled={Boolean(saving)}>
            {saving === 'draft' ? <CircularProgress size={20} color="inherit" /> : 'Save draft'}
          </Button>
          {isLast ? (
            <Button variant="contained" startIcon={saving === 'publish' ? undefined : <PublishRounded />} onClick={onPublish} disabled={Boolean(saving)}>
              {saving === 'publish' ? <CircularProgress size={20} color="inherit" /> : 'Publish'}
            </Button>
          ) : (
            <Button variant="contained" endIcon={<ArrowForward />} onClick={() => goTo(step + 1)}>
              Next
            </Button>
          )}
        </Stack>
      </Box>

      <Snackbar
        open={Boolean(toast)}
        message={toast}
        autoHideDuration={3000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={{ bottom: { xs: 88, sm: 88 } }}
      />

      <Dialog open={blocker.state === 'blocked'} onClose={() => blocker.reset?.()}>
        <DialogTitle>Leave without saving?</DialogTitle>
        <DialogContent>
          <DialogContentText>Your latest changes to this project haven’t been saved.</DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button color="inherit" onClick={() => blocker.proceed?.()}>
            Leave
          </Button>
          <Button variant="contained" onClick={() => blocker.reset?.()}>
            Keep editing
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
