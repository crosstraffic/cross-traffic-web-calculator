import { error, json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { query, supabase } from '$lib/server/supabaseClient'


export const POST: RequestHandler = async (event) => {
    const { cookies } = event
    const { slug } = event.params

    let result
    let sql
    let functionName

    try {
        switch (slug) {
            case 'logout':
                if (event.locals.user) {
                    // else they are logged out / session ended
                    // sql = `CALL auth.delete_session($1)`
                    // result = await query(sql, [event.locals.user.id])
                    functionName = 'delete_session';
                    result = await query(functionName, { input: event.locals.user.id })
                }
                cookies.delete('session', { path: '/'})
                return json({ message: 'Logout successful.' })

            case 'login':
                console.log("Called login")
                // sql = `SELECT auth.authenticate($1) AS "authenticationResult";`
                functionName = 'authenticate';
                break
            case 'register':
                console.log("Called register")
                // sql = `SELECT auth.register($1) AS "registrationResult";`
                functionName = 'register';
                break
            default:
                error(404, 'Invalid endpoint.')
        }

        // Only /auth/login and /auth/register at this point
        // const body = await event.request.json();
        const body = {"email": "admin@example.com", "password": "admin123" };
        console.log(body);

        const user = await supabase.auth.getUser();
        console.log(user.id);

        // While client checks for these to be non-null, register() in the database does not
        if (slug == 'register' && (!body.email || !body.password || !body.firstName || !body.lastName))
            error(400, 'Please supply all required fields: email, password, first and last name.')

        // console.log(JSON.stringify(body));
        // result = await query(sql, [JSON.stringify(body)])
        // result = await supabase.rpc('authenticate', { input: body })

        // result = await query(functionName, { input: body });
        result = await supabase.auth.signInWithPassword({ 
            email: 'admin@example.com',
            password: 'admin123',
        });
        console.log(result);
    } catch (err) {
        console.error(err);
        error(500, 'Could not communicate with database.')
    }

    const { authenticationResult } : { authenticationResult: AuthenticationResult } = result.rows[0]

    if (!authenticationResult.user)
        // includes when a user tries to register an existing email account with wrong password
        error(authenticationResult.statusCode, authenticationResult.status)

    // Ensures hooks.server.ts:handle() will not delete session cookie
    event.locals.user = authenticationResult.user
    cookies.set('session', authenticationResult.sessionId, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/'
    })
    return json({ message: authenticationResult.status, user: authenticationResult.user })
}