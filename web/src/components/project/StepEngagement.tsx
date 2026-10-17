import { useState, type ReactElement } from 'react'
import Paper from '@mui/material/Paper'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Button from '@mui/material/Button'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Switch from '@mui/material/Switch'
import FormControlLabel from '@mui/material/FormControlLabel'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import Collapse from '@mui/material/Collapse'
import AddRounded from '@mui/icons-material/AddRounded'
import RadioButtonChecked from '@mui/icons-material/RadioButtonCheckedOutlined'
import CheckBoxOutlined from '@mui/icons-material/CheckBoxOutlined'
import ShortText from '@mui/icons-material/ShortTextRounded'
import StarOutline from '@mui/icons-material/StarOutlineRounded'
import ArrowUpward from '@mui/icons-material/ArrowUpwardRounded'
import ArrowDownward from '@mui/icons-material/ArrowDownwardRounded'
import DeleteOutline from '@mui/icons-material/DeleteOutlineRounded'
import CloseRounded from '@mui/icons-material/CloseRounded'
import QuizOutlined from '@mui/icons-material/QuizOutlined'
import type { Demographic, Question, QuestionType } from '../../api/projects'
import FieldGroup from './FieldGroup'
import type { StepProps } from './StepBasics'

const questionTypes: Record<QuestionType, { label: string; hint: string; icon: ReactElement }> = {
  single_choice: { label: 'Poll', hint: 'Pick one option', icon: <RadioButtonChecked fontSize="small" /> },
  multiple_choice: { label: 'Multiple choice', hint: 'Pick any that apply', icon: <CheckBoxOutlined fontSize="small" /> },
  short_text: { label: 'Written answer', hint: 'A sentence or two', icon: <ShortText fontSize="small" /> },
  rating: { label: 'Rating', hint: '1 to 5 stars', icon: <StarOutline fontSize="small" /> },
}

/** Asked on every project when "default questions" is on. */
const DEFAULT_QUESTIONS = [
  'Overall, how do you feel about this project? (Strongly oppose → Strongly support)',
  'How often do you use or pass through this area?',
  'Is there anything we should know before deciding?',
]

const demographics: { value: Demographic; label: string }[] = [
  { value: 'age_range', label: 'Age range' },
  { value: 'postcode_area', label: 'Postcode area' },
  { value: 'connection', label: 'Connection to area (live, work, visit)' },
  { value: 'gender', label: 'Gender' },
  { value: 'ethnicity', label: 'Ethnicity' },
  { value: 'disability', label: 'Disability' },
]

function QuestionCard({
  q,
  index,
  count,
  error,
  onChange,
  onMove,
  onRemove,
}: {
  q: Question
  index: number
  count: number
  error?: string
  onChange: (q: Question) => void
  onMove: (delta: number) => void
  onRemove: () => void
}) {
  const meta = questionTypes[q.type]
  const hasOptions = q.type === 'single_choice' || q.type === 'multiple_choice'
  const setOption = (i: number, value: string) => onChange({ ...q, options: q.options.map((o, j) => (j === i ? value : o)) })

  return (
    <Paper variant="outlined" sx={{ p: 2, borderColor: error ? 'error.main' : 'divider' }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1.5 }}>
        <Chip size="small" icon={meta.icon} label={meta.label} sx={{ fontWeight: 600, borderRadius: 1.5 }} />
        <Typography variant="caption" color="text.secondary">
          Question {index + 1}
        </Typography>
        <Box sx={{ flexGrow: 1 }} />
        <IconButton size="small" aria-label="Move up" disabled={index === 0} onClick={() => onMove(-1)}>
          <ArrowUpward fontSize="small" />
        </IconButton>
        <IconButton size="small" aria-label="Move down" disabled={index === count - 1} onClick={() => onMove(1)}>
          <ArrowDownward fontSize="small" />
        </IconButton>
        <IconButton size="small" aria-label="Delete question" onClick={onRemove}>
          <DeleteOutline fontSize="small" />
        </IconButton>
      </Stack>

      <TextField
        placeholder="Type your question"
        value={q.prompt}
        onChange={(e) => onChange({ ...q, prompt: e.target.value })}
        error={Boolean(error)}
        helperText={error}
        fullWidth
        multiline
        autoFocus={!q.prompt}
        slotProps={{ htmlInput: { maxLength: 500 } }}
      />

      {hasOptions && (
        <Stack spacing={1} sx={{ mt: 1.5, pl: { sm: 1 } }}>
          {q.options.map((o, i) => (
            <Stack key={i} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <Box sx={{ color: 'text.secondary', display: 'flex' }}>
                {q.type === 'single_choice' ? <RadioButtonChecked fontSize="small" /> : <CheckBoxOutlined fontSize="small" />}
              </Box>
              <TextField
                size="small"
                placeholder={`Option ${i + 1}`}
                value={o}
                onChange={(e) => setOption(i, e.target.value)}
                fullWidth
              />
              <IconButton
                size="small"
                aria-label="Remove option"
                onClick={() => onChange({ ...q, options: q.options.filter((_, j) => j !== i) })}
              >
                <CloseRounded fontSize="small" />
              </IconButton>
            </Stack>
          ))}
          {q.options.length < 20 && (
            <Button
              size="small"
              startIcon={<AddRounded />}
              onClick={() => onChange({ ...q, options: [...q.options, ''] })}
              sx={{ alignSelf: 'flex-start', py: 0.5 }}
            >
              Add option
            </Button>
          )}
        </Stack>
      )}

      {q.type === 'rating' && (
        <Stack direction="row" spacing={0.5} sx={{ mt: 1.5, color: 'text.disabled' }} aria-hidden>
          {Array.from({ length: 5 }, (_, i) => (
            <StarOutline key={i} />
          ))}
        </Stack>
      )}

      <FormControlLabel
        control={<Switch size="small" checked={q.required} onChange={(e) => onChange({ ...q, required: e.target.checked })} />}
        label={<Typography variant="body2">Required</Typography>}
        sx={{ mt: 1, ml: 0, gap: 1 }}
      />
    </Paper>
  )
}

function SettingSwitch({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string
  hint: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <Stack direction="row" spacing={2} sx={{ justifyContent: 'space-between', alignItems: 'center', py: 1.5 }}>
      <Box>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {label}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {hint}
        </Typography>
      </Box>
      <Switch checked={checked} onChange={(e) => onChange(e.target.checked)} slotProps={{ input: { 'aria-label': label } }} />
    </Stack>
  )
}

export default function StepEngagement({ form, update, errors }: StepProps) {
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)
  const questions = form.questions
  const settings = form.engagement
  const setSettings = (patch: Partial<typeof settings>) => update({ engagement: { ...settings, ...patch } })

  function addQuestion(type: QuestionType) {
    const options = type === 'single_choice' || type === 'multiple_choice' ? ['', ''] : []
    update({ questions: [...questions, { type, prompt: '', options, required: false }] })
    setMenuAnchor(null)
  }

  function move(i: number, delta: number) {
    const next = [...questions]
    ;[next[i], next[i + delta]] = [next[i + delta], next[i]]
    update({ questions: next })
  }

  return (
    <Stack spacing={4}>
      <FieldGroup
        title="Polls, questions and surveys"
        hint="Ask residents something specific. Questions appear in order."
        action={
          <>
            <Button
              size="small"
              variant="outlined"
              startIcon={<AddRounded />}
              onClick={(e) => setMenuAnchor(e.currentTarget)}
              sx={{ py: 0.5, flexShrink: 0, bgcolor: 'background.paper' }}
            >
              Add question
            </Button>
            <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
              {(Object.keys(questionTypes) as QuestionType[]).map((type) => (
                <MenuItem key={type} onClick={() => addQuestion(type)}>
                  <ListItemIcon>{questionTypes[type].icon}</ListItemIcon>
                  <ListItemText primary={questionTypes[type].label} secondary={questionTypes[type].hint} />
                </MenuItem>
              ))}
            </Menu>
          </>
        }
      >
        {questions.length === 0 ? (
          <Stack
            spacing={1}
            sx={{ alignItems: 'center', p: 3, borderRadius: 3, border: '1.5px dashed', borderColor: 'divider', textAlign: 'center' }}
          >
            <QuizOutlined sx={{ color: 'text.secondary' }} />
            <Typography variant="body2" color="text.secondary">
              No questions yet.
            </Typography>
          </Stack>
        ) : (
          <Stack spacing={1.5}>
            {questions.map((q, i) => (
              <QuestionCard
                key={i}
                q={q}
                index={i}
                count={questions.length}
                error={errors[`question.${i}`]}
                onChange={(next) => update({ questions: questions.map((x, j) => (j === i ? next : x)) })}
                onMove={(delta) => move(i, delta)}
                onRemove={() => update({ questions: questions.filter((_, j) => j !== i) })}
              />
            ))}
          </Stack>
        )}
      </FieldGroup>

      <FieldGroup title="Comments" hint="Decide how open the discussion is.">
        <Paper variant="outlined" sx={{ px: 2.5, py: 0.5 }}>
          <SettingSwitch
            label="Default questions"
            hint="Ask the standard council questions on this project."
            checked={settings.default_questions}
            onChange={(default_questions) => setSettings({ default_questions })}
          />
          <Collapse in={settings.default_questions}>
            <Box component="ul" sx={{ m: 0, mb: 1.5, pl: 2.5, color: 'text.secondary' }}>
              {DEFAULT_QUESTIONS.map((q) => (
                <Typography component="li" variant="body2" key={q}>
                  {q}
                </Typography>
              ))}
            </Box>
          </Collapse>
          <Divider />
          <SettingSwitch
            label="Allow custom comments"
            hint="Residents can write their own comments."
            checked={settings.custom_comments}
            onChange={(custom_comments) =>
              setSettings({ custom_comments, comment_replies: custom_comments && settings.comment_replies })
            }
          />
          <Divider />
          <SettingSwitch
            label="Allow replies"
            hint="Residents can reply to each other in threads."
            checked={settings.comment_replies}
            onChange={(comment_replies) => setSettings({ comment_replies, custom_comments: comment_replies || settings.custom_comments })}
          />
        </Paper>
      </FieldGroup>

      <FieldGroup title="Optional demographics" hint="Residents can skip these.">
        <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>
          {demographics.map((d) => {
            const on = settings.demographics.includes(d.value)
            return (
              <Chip
                key={d.value}
                label={d.label}
                clickable
                color={on ? 'primary' : 'default'}
                variant={on ? 'filled' : 'outlined'}
                onClick={() =>
                  setSettings({
                    demographics: on
                      ? settings.demographics.filter((x) => x !== d.value)
                      : [...settings.demographics, d.value],
                  })
                }
                aria-pressed={on}
                sx={{ fontWeight: 500 }}
              />
            )
          })}
        </Stack>
      </FieldGroup>
    </Stack>
  )
}
