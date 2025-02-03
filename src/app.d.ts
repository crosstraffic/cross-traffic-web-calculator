/* eslint-disable @typescript-eslint/no-explicit-any */
import { SupabaseClient, Session, User } from '@supabase/supabase-js'

// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
// and what to do when importing types
declare global {
	namespace App {
		interface Locals {
			supabase: SupabaseClient
			safeGetSession: () => Promise<{ session: Session | null, user: User | null }>
			session: Session | null
			user: User | null
		}

		interface PageData { 
			session: Session | null
		}

		// interface Platform {}

		// interface PrivateEnv {
		// 	// $env/static/private
		// 	DATABASE_URL: string
		// 	DOMAIN: string
		// 	JWT_SECRET: string
		// 	SENDGRID_KEY: string
		// 	SENDGRID_SENDER: string
		// }

		// interface PublicEnv {
		// 	// $env/static/public
		// 	PUBLIC_GOOGLE_CLIENT_ID: string
		// 	PUBLIC_SUPABASE_PROJECT_URL: string
		// 	PUBLIC_SUPABASE_ANON_KEY: string
		// }
	}
}

interface AuthenticationResult {
	statusCode: NumericRange<400, 599>
	status: string
	user: User
	sessionId: string
}

interface Credentials {
	// username: string
	email: string
	password: string
}

interface CredentialsRegistration extends Credentials {
	first_name: string
	last_name: string
	role: 'base' | 'advanced' | 'admin'
}

interface UserProperties {
	id: number
	created_at?: string // ISO-8601 datetime
	username?: string
	first_name?: string
	last_name?: string
	email_address?: string
	role: 'base' | 'advanced' | 'admin'
	password?: string
}

type User = UserProperties | undefined | null

interface UserSession {
	id: string
	user: User
}

export {}