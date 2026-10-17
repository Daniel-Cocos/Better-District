import { Box, Chip, Stack, Typography } from '@mui/material'
import { issuePhotoUrl, type CommunityIssue } from '../../api/issues'

export default function IssueDetails({ issue }: { issue: CommunityIssue }) {
  return <Stack spacing={2} sx={{ p: 2 }}>
    <Typography variant="overline" color="text.secondary">Community issue #{issue.id}</Typography>
    <Typography variant="h5" component="h2">{issue.title}</Typography>
    <Box component="img" src={issuePhotoUrl(issue.id)} alt={issue.title} sx={{ width: '100%', maxHeight: 280, objectFit: 'contain', borderRadius: 2 }} />
    <Typography sx={{ whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}>{issue.description}</Typography>
    <Chip label={issue.status} sx={{ alignSelf: 'flex-start', textTransform: 'capitalize' }} />
    <Typography variant="caption" color="text.secondary">{new Date(issue.created_at.replace(' ', 'T') + 'Z').toLocaleString()} · {issue.latitude.toFixed(5)}, {issue.longitude.toFixed(5)}</Typography>
  </Stack>
}
