import { useNavigate } from 'react-router'
import { Alert, Box, Button, Chip, CircularProgress, Paper, Stack, Typography } from '@mui/material'
import { useCommunityIssues } from '../hooks/useCommunityIssues'
import IssueDetails from '../components/issues/IssueDetails'

export default function CommunityIssues() {
  const { issues, loading, error, refresh } = useCommunityIssues()
  const navigate = useNavigate()
  return <Box sx={{ maxWidth: 1100, mx: 'auto' }}>
    <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
      <Typography variant="h2" component="h1">Community insights</Typography>
      <Button disabled={loading} onClick={refresh}>Refresh</Button>
    </Stack>
    <Typography color="text.secondary" sx={{ mb: 3 }}>Ideas and issues residents want the council to address.</Typography>
    <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
      <Chip label="Analysis coming later" size="small" sx={{ mb: 1 }} />
      <Typography variant="h6">What the community wants to see</Typography>
      <Typography color="text.secondary">Future analysis will identify common themes and potential projects from these reports. No automated analysis has been run yet.</Typography>
      {!loading && !error && <Typography sx={{ mt: 2, fontWeight: 600 }}>{issues.length} community report{issues.length === 1 ? '' : 's'} received</Typography>}
    </Paper>
    {error && <Alert severity="error" sx={{ mb: 2 }} action={<Button color="inherit" onClick={refresh}>Retry</Button>}>{error}</Alert>}
    {loading && <CircularProgress size={28} aria-label="Loading community issues" />}
    {!loading && !error && !issues.length && <Typography color="text.secondary">Reports submitted from the app will appear here and on the map.</Typography>}
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
      {issues.map((issue) => <Paper variant="outlined" key={issue.id}>
        <IssueDetails issue={issue} />
        <Button sx={{ m: 2, mt: 0 }} onClick={() => navigate(`/map?issue=${issue.id}`)}>View on map</Button>
      </Paper>)}
    </Box>
  </Box>
}
