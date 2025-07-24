<script lang="ts">
  import { onMount } from 'svelte'
	import type { LayoutServerData, LayoutLoad } from './$types'
	import { goto, beforeNavigate, invalidate } from '$app/navigation'
	import { loginSession, toast } from '../stores'
	import { initializeGoogleAccounts } from '$lib/google'
  import { createBrowserClient, createServerClient, isBrowser } from '@supabase/ssr'
  import { PUBLIC_SUPABASE_ANON_KEY, PUBLIC_SUPABASE_PROJECT_URL } from '$env/static/public'

  import '../app.css';

  /*
  interface Props {
		data: LayoutServerData
		children?: import('svelte').Snippet
	}

	// let { data, children }: Props = $props()

  let { supabase, session } = data
  $: ({ supabase, session } = data)

	// If returning from different website, runs once (as it's an SPA) to restore user session if session cookie is still valid
	// const { user } = data
	// $loginSession = user

	// let Toast: any

	// beforeNavigate(() => {
	// 	let expirationDate = $loginSession?.expires ? new Date($loginSession.expires) : undefined

	// 	if (expirationDate && expirationDate < new Date()) {
	// 		console.log('Login session expired.')
	// 		$loginSession = null
	// 	}
	// })

	// onMount(async () => {
	// 	initializeGoogleAccounts()

	// 	if (!$loginSession) google.accounts.id.prompt()
	// })

  onMount(() => {
    const { data } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (newSession?.expires_at !== session?.expires_at) {
        invalidate('supabase:auth')
      }
    })

    return () => data.subscription.unsubscribe()
  })

  // async function logout(event: MouseEvent) {
	// 	event.preventDefault()
	// 	// Request server delete httpOnly cookie called loginSession
	// 	const url = '/auth/logout'
	// 	const res = await fetch(url, {
	// 		method: 'POST'
	// 	})
	// 	if (res.ok) {
	// 		loginSession.set(undefined) // delete loginSession.user from
	// 		goto('/login')
	// 	} else console.error(`Logout not successful: ${res.statusText} (${res.status})`)
	// }

	// const openToast = (open: boolean) => {
	// 	if (open) {
	// 		const toastDiv = document.getElementById('authToast') as HTMLDivElement
	// 		const t = new Toast(toastDiv)
	// 		t.show()
	// 	}
	// }

	// $effect(() => {
	// 	openToast($toast.isOpen)
	// })
  */

  let { data, children } = $props()
  let { session, supabase } = $derived(data)

  onMount(() => {
    const { data } = supabase.auth.onAuthStateChange((_, newSession) => {
      if (newSession?.expires_at !== session?.expires_at) {
        invalidate('supabase:auth')
      }
    })

    return () => data.subscription.unsubscribe()
  })

  // Google Analytics
  onMount(() => {
    const script = document.createElement('script')
    script.src = 'https://www.googletagmanager.com/gtag/js?id=G-LMH583TV33'
    script.async = true
    document.head.appendChild(script)

    const script2 = document.createElement('script')
    script2.innerHTML = `
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', 'G-LMH583TV33');
    `
    document.head.appendChild(script2)
  })

</script>

<!-- {@render children()} -->



<header>
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-LMH583TV33"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());

  gtag('config', 'G-LMH583TV33');
</script>
<div class="navbar bg-base-200">
  <div class="navbar-start">
    <div class="dropdown">
      <div tabindex="0" role="button" class="btn btn-ghost btn-circle">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h7" /></svg>
      </div>
      <ul tabindex="0" class="menu menu-sm dropdown-content mt-3 z-[1] p-2 shadow bg-base-300 rounded-box w-52">
        <li><a href="/">Home</a></li>
        <li>
          <div class="justify-between">
            Chapters
            <svg class="fill-current" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M8.59,16.58L13.17,12L8.59,7.41L10,6L16,12L10,18L8.59,16.58Z"/></svg>
          </div>
          <ul class="p-2 bg-base-200">
            <li><a href="/hcm15">Chapter 15</a></li>
          </ul>
        </li>
      </ul>
    </div>
    <!-- Gonna be LOGO -->
    <a href="/" class="normal-case text-xl logo"><img src="hcm_calculator_logo.png" alt="logo" style="max-width:110px;height:100%"/></a>
  </div>
  <div class="navbar-center hidden lg:flex">
    <ul class="menu menu-horizontal p-0">
      <li><a class="home_button" href="/">Home</a></li>
      <li><a class="chat_button" href="/chat">Chat</a></li>
      <!-- <li><a href="/about">About</a></li> -->
      <li>
        <div class="chap_button">
          Chapters
          <svg class="fill-current" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><path d="M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z"/></svg>
        </div>
        <ul class="p-2 bg-base-200 chap_button">
          <li><a href="/hcm15">Chapter 15</a></li>
        </ul>
      </li>
    </ul>
  </div>
  <div class="navbar-end">
    <a class="btn" href="/login">Login</a>
  </div>
</div>

</header>
<main>
  <slot />
</main>
<footer class="footer footer-center p-10 bg-base-200 text-base-content rounded">
  <div class="grid grid-flow-col gap-4">
    <a href="/" class="link link-hover">Home</a> 
    <a href="terms" class="link link-hover">Terms & Conditions</a> 
  </div> 
  <div>
    <p>Copyright © 2024 - All right reserved by Rei Tamaru and Jonathan Riel</p>
  </div>
</footer>
