import { error, json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { OAuth2Client } from 'google-auth-library'
import { query } from '$lib/server/supabaseClient'
import { PUBLIC_GOOGLE_CLIENT_ID } from '$env/static/public'
import type { User } from '@supabase/supabase-js'

// Verify JWT per https://developers.google.com/identity/gsi/web/guides/verify-google-id-token
async function getGoogleUserFromJWT(token: string): Promise<Partial<User>> {
    try{
        const client = new OAuth2Client(PUBLIC_GOOGLE_CLIENT_ID)
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: PUBLIC_GOOGLE_CLIENT_ID
        })
        const payload = ticket.getPayload()
        if (!payload) error(500, 'Google authentication did not get the expected payload')

        return {
            firstName: payload['given_name'] || 'UnknownFirstName',
            lastName: payload['family_name'] || 'UnknownLastName',
            email: payload['email'] || 'UnknownEmail',
        }
    } catch (err) {
        let message = ''
        if (err instanceof Error) message = err.message
        error(500, `Google user could not be authenticated: ${message}`)
    }

}

// Upsert user and get session ID
async function upsertGoogleUser(user: Partial<User>): Promise<UserSession> {
    const sql = `SELECT start_gmail_user_session($1) AS user_session;`
    const { rows } = await query(sql, [JSON.stringify(user)])

    if (!rows?.length) {
        throw new Error('No session data returned from database.');
    }

    return <UserSession>rows[0].user_session;
}

export const POST: RequestHandler = async event => {
    const { cookies } = event

    try {
        const { token } = await event.request.json()
        const user = await getGoogleUserFromJWT(token)
        const userSession = await upsertGoogleUser(user)

        // Prevent hooks.server.ts:handle() from deleting session cookie thinking no one has authenticated
        event.locals.user = userSession.user

        cookies.set('session', userSession.id, { httpOnly: true, sameSite: 'lax', path: '/' })
        return json({ message: 'Successful Google Sign-In.', user: userSession.user})
    } catch (err) {
        let message = 'Authentication failed.';
        if (err instanceof Error) message = err.message
        return json ({ error: message }, { status: 401 });
   }
}