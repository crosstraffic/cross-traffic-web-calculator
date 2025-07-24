import type { Secret } from 'jsonwebtoken'
import type { MailDataRequired } from '@sendgrid/mail'
import type { RequestHandler } from './$types'
import jwt from 'jsonwebtoken'
import { JWT_SECRET, DOMAIN, SENDGRID_SENDER } from '$env/static/private'
import { query } from '$lib/server/supabaseClient'
import { sendMessage } from '$lib/server/sendgrid'

export const POST: RequestHandler = async event => {
    const body = await event.request.json()
    const sql = `SELECT id as "userId" FROM users WHERE email = $1 LIMIT 1;`
    const { rows } = await query(sql, [body.email])

    if (rows.length > 0) {
        const { userId } = rows[0]
        // Create JWT with userId expiring in 30 mins
        const secret = JWT_SECRET
        const token = jwt.sign({ subject: userId }, <Secret>secret, {
            expiresIn: '30m'
        })

        // Email URL with token to user
        const message: MailDataRequired = {
            to: {email: body.email },
            from: SENDGRID_SENDER,
            subject: 'Password reset',
            categories: ['account'],
            html: `
                <a href="${DOMAIN}/auth/reset/${token}">Reset password</a>. Your browser will open and ask you to provide a 
                new password with a onfirmation then redirect you to your login page.
            `
        }
        sendMessage(message)
    }

    return new Response(undefined, { status: 204 })
}