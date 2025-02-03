<script lang="ts">
	import { onMount } from 'svelte'
	import { goto } from '$app/navigation'
	import { page } from '$app/stores'
	import { loginSession } from '../../stores'
	import { focusOnFirstError } from '$lib/focus'
	import { initializeGoogleAccounts, renderGoogleButton } from '$lib/google'
	import type { Credentials } from 'google-auth-library';

	let focusedField: HTMLInputElement | undefined = $state()
	let message = $state('')
	// Could add username: '',
	const credentials: Credentials = $state({
		email: '',
		password: ''
	})

	async function login() {
		message = ''
		const form = document.getElementById('signIn') as HTMLFormElement

		if (form.checkValidity()) {
			try {
				await loginLocal(credentials)
				// await signInWithEmail(credentials)
			} catch (err) {
				if (err instanceof Error) {
					console.error('Login error', err.message)
					message = err.message
				}
			}
		} else {
			form.classList.add('was-validated')
			focusOnFirstError(form)
		}
	}

	onMount(() => {
		initializeGoogleAccounts()
		renderGoogleButton()

		focusedField?.focus()
	})

	async function loginLocal(credentials: Credentials) {
		try {
			const res = await fetch('/auth/login', {
				method: 'POST',
				body: JSON.stringify(credentials),
				headers: {
					'Content-Type': 'application/json'
				}
			})
			const fromEndpoint = await res.json()
			if (res.ok) {
				loginSession.set(fromEndpoint.user)
				const { role } = fromEndpoint.user
				const referrer = $page.url.searchParams.get('referrer')
				if (referrer) goto(referrer)
				switch (role) {
					case 'base':
						goto('/base')
						break
					case 'advanced':
						goto('/advanced')
						break
					case 'admin':
						goto('/admin')
						break
					default:
						goto('/')
				}
			} else {
				throw new Error(fromEndpoint.message)
			}
		} catch (err) {
			if (err instanceof Error) {
				console.error('Login error', err)
			}
		}
	}

	// function validate() {
	// 	let isValid = true;

	// 	// Reset errors
	// 	errors = {username: '', email: '', password: ''};

	// 	// Username validation
	// 	if (!form.username) {
	// 		errors.username = 'Username is required.';
	// 		isValid = false;
	// 	} else if (form.username.length < 3) {
	// 		errors.username = 'Username must be at least 3 characters.';
	// 		isValid = false;
	// 	}

	// 	// Email validation
	// 	const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	// 	if (!form.email) {
	// 		errors.email = 'Email is required.';
	// 		isValid = false;
	// 	} else if (!emailPattern.test(form.email)) {
	// 		errors.email = 'Email is invalid.';
	// 		isValid = false;
	// 	}

	// 	// Password validation
	// 	if (!form.password) {
	// 		errors.password = 'Password is required.';
	// 		isValid = false;
	// 	} else if (form.password.length < 8) {
	// 		errors.password = 'Password must be at least 8 characters.';
	// 		isValid = false;
	// 	}
	// }
</script>

<svelte:head>
	<title>Login Form</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="w-full max-w-xs">
	<form method="POST" action="?/login" class="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4" id="signIn" autocomplete="on" novalidate>
		<h4><strong>Sign In</strong></h4>
		
		<div>
			<div class="mb-3">
				<div id="googleButton"></div>
			</div>
			<div class="text-centered">
				<div class="strike">
					<span>or</span>
				</div>
			</div>
			<div class="mb-4">
				<label class="form-label block text-gray-700 text-sm font-bold mb-2" for="email">Email</label>
				<input
					type="email"
					name="email"
					class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 form-control leading-tight focus:outline-none focus:shadow-outline"
					bind:this={focusedField}
					bind:value={credentials.email}
					required
					placeholder="Email"
					autocomplete="email"
				/>
				{#if credentials.email}
					<p class="mt-1 text-sm text-red-500">Email address required</p>
				{/if}
			</div>
			<div class="mb-4">
				<label class="form-label block text-gray-700 text-sm font-bold mb-2" for="password">Password</label>
				<input
					class="form-control shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 form-control leading-tight focus:outline-none focus:shadow-outline"
					name="password"
					type="password"
					bind:value={credentials.password}
					required
					minlength="8"
					maxlength="80"
					placeholder="Password"
					autocomplete="current-password"
				/>
				{#if credentials.password}
					<p class="mt-1 text-sm text-red-500">Password with 8 chars or more required</p>
				{/if}
				<div class="form-text">
					Password minimum length 8, must have one capital letter, 1 number, and one unique
					character.
				</div>
			</div>
			<!-- <div>
				<a href="/forgot" class="text-black-50">Forgot Password?</a><br />
				<br />
			</div> -->
			<!-- {#if message}
				<p class="text-danger">{message}</p>
			{/if} -->
			<!-- <button
				type="submit"
				onclick={login}
				class="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
			> -->
			<button
				class="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
			>
				Submit
			</button>
			<button formaction="?/signup">Sign up</button>
		</div>
	</form>
	<!-- <button formaction="?/signup">Don't have an account?</button> -->
	<!-- <div class="card-footer text-center bg-white">
		<a formaction class="text-black-50">Don't have an account?</a>
	</div> -->
</div>

<style>
	.card-body {
		width: 25rem;
	}

	.strike {
		display: block;
		text-align: center;
		overflow: hidden;
		white-space: nowrap;
	}

	.strike > span {
		position: relative;
		display: inline-block;
	}

	.strike > span:before,
	.strike > span:after {
		content: '';
		position: absolute;
		top: 50%;
		width: 9999px;
		height: 1px;
		background: darkgray;
	}

	.strike > span:before {
		right: 100%;
		margin-right: 10px;
	}

	.strike > span:after {
		left: 100%;
		margin-left: 10px;
	}
</style>