import type { LayoutServerLoad } from './$types'

export const load: LayoutServerLoad = async ({ locals: { safeGetSession }, cookies }) => {
	const { session } = await safeGetSession() // locals.user set by hooks.server.ts/handle(), undefined if not logged in

	return {
		session,
		cookies: cookies.getAll(),
	}
}