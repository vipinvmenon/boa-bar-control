import { createClient } from '@supabase/supabase-js'

type Request = {
  method?: string
  headers: Record<string, string | string[] | undefined>
  body?: unknown
}

type Response = {
  status: (code: number) => Response
  json: (body: unknown) => void
}

type InviteBody = {
  email?: string
  displayName?: string
  role?: 'crew' | 'warehouse' | 'bar_lead' | 'manager' | 'auditor' | 'admin'
  locationId?: string | null
  venueId?: string
}

type AuthUserClient = {
  getUser: (token: string) => Promise<{ data: { user: { id: string; email?: string } | null }; error: { message: string } | null }>
}

type AuthAdminClient = {
  admin: {
    inviteUserByEmail: (email: string, options: { redirectTo: string; data: { needs_password: boolean } }) => Promise<{
      data: { user: { id: string } | null }
      error: { message: string } | null
    }>
  }
}

const OPERATORS = new Set(['vipinmenon16@gmail.com', 'salman@bangaloreopenair.com'])

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  if (!serviceKey || !supabaseUrl || !publishableKey) return res.status(503).json({ error: 'Invitation service is not configured' })

  const authorization = req.headers.authorization
  const token = Array.isArray(authorization) ? authorization[0] : authorization
  if (!token?.startsWith('Bearer ')) return res.status(401).json({ error: 'Authentication required' })

  const callerClient = createClient(supabaseUrl, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const adminClient = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: caller, error: callerError } = await (callerClient.auth as unknown as AuthUserClient).getUser(token.slice(7))
  if (callerError || !caller.user?.email) return res.status(401).json({ error: 'Authentication required' })
  if (!OPERATORS.has(caller.user.email.toLowerCase())) return res.status(403).json({ error: 'Only BOA operators may invite staff' })

  const body = (req.body ?? {}) as InviteBody
  const email = body.email?.trim().toLowerCase() ?? ''
  const displayName = body.displayName?.trim() ?? ''
  const role = body.role ?? 'crew'
  if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address' })
  if (!displayName || displayName.length > 60) return res.status(400).json({ error: 'Enter a name between 1 and 60 characters' })
  if (!body.venueId) return res.status(400).json({ error: 'A venue is required' })
  if (role === 'admin' || role === 'manager') return res.status(403).json({ error: 'Management access must be granted separately' })

  const { data: operatorMembership, error: membershipError } = await adminClient
    .from('boa_bar_membership')
    .select('venue_id, role')
    .eq('venue_id', body.venueId)
    .eq('user_id', caller.user.id)
    .eq('active', true)
    .in('role', ['admin', 'manager'])
    .maybeSingle()
  if (membershipError || !operatorMembership) return res.status(403).json({ error: 'You cannot invite staff to this venue' })

  const originHeader = req.headers.origin
  const hostHeader = req.headers['x-forwarded-host'] ?? req.headers.host
  const protoHeader = req.headers['x-forwarded-proto'] ?? 'https'
  const origin = Array.isArray(originHeader) ? originHeader[0] : originHeader
  const host = Array.isArray(hostHeader) ? hostHeader[0] : hostHeader
  const proto = Array.isArray(protoHeader) ? protoHeader[0] : protoHeader
  const redirectTo = `${origin || `${proto}://${host}`}/`
  const { data: invited, error: inviteError } = await (adminClient.auth as unknown as AuthAdminClient).admin.inviteUserByEmail(email, {
    redirectTo,
    data: { needs_password: true },
  })
  if (inviteError || !invited.user) return res.status(400).json({ error: inviteError?.message ?? 'Could not send invitation' })

  const { error: addMembershipError } = await adminClient.from('boa_bar_membership').upsert({
    venue_id: operatorMembership.venue_id,
    user_id: invited.user.id,
    role,
    location_id: body.locationId || null,
    active: true,
  }, { onConflict: 'venue_id,user_id,role,location_id' })
  if (addMembershipError) return res.status(500).json({ error: 'Invitation sent, but access could not be assigned' })

  const { error: addPersonError } = await adminClient.from('boa_bar_person').upsert({
    venue_id: operatorMembership.venue_id,
    user_id: invited.user.id,
    display_name: displayName,
  }, { onConflict: 'venue_id,user_id' })
  if (addPersonError) return res.status(500).json({ error: 'Invitation sent, but the staff name could not be saved' })

  return res.status(200).json({ ok: true })
}
