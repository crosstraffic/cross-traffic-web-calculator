<script>
  import '../app.css';
</script>

<header>
  <!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-LMH583TV33"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());

    gtag('config', 'G-LMH583TV33');
  </script>

  <div class="navbar bg-base-100 shadow-md">
    <div class="navbar-start">
      <div class="dropdown">
        <div tabindex="0" role="button" class="btn btn-ghost btn-circle lg:hidden">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </div>
        <ul tabindex="0" class="menu menu-sm dropdown-content mt-3 z-[1] p-2 shadow bg-base-200 rounded-box w-52">
          <li><a href="/">Home</a></li>
          <li>
            <details>
              <summary class="justify-between">
                Chapters
                <!-- <svg class="fill-current" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M8.59,16.58L13.17,12L8.59,7.41L10,6L16,12L10,18L8.59,16.58Z"/></svg> -->
              </summary>
              <ul class="p-2 bg-base-200">
                <li><a href="/hcm15">Chapter 15</a></li>
              </ul>
            </details>
          </li>
        </ul>
      </div>
      <!-- Gonna be LOGO -->
      <a href="/" class="normal-case text-xl logo"><img src="hcm_calculator_logo.png" alt="logo" style="max-width:110px;height:100%"/></a>
    </div>
    <div class="navbar-center hidden lg:flex">
      <ul class="menu menu-horizontal p-0">
        <li><a class="home_button" href="/">Home</a></li>
        <!-- <li><a href="/about">About</a></li> -->
        <li>
          <details>
            <summary class="chap_button">
              Chapters
              <!-- <svg class="fill-current" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><path d="M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z"/></svg> -->
            </summary>
            <ul class="p-2 bg-base-200">
              <li><a href="/hcm15">Chapter 15</a></li>
            </ul>
          </details>
        </li>
      </ul>
    </div>

    <div class="navbar-end">
      <!-- <a class="btn">Login</a> -->
    </div>
  </div>
</header>

<main>
  <slot />
</main>

<footer class="footer footer-horizontal footer-center bg-base-200 text-base-content p-10">
  <div class="grid grid-flow-col gap-4">
    <a href="/" class="link link-hover">Home</a> 
    <a href="terms" class="link link-hover">Terms & Conditions</a> 
  </div> 
  <div>
    <p class="text-sm text-gray-500">Copyright © 2025 - All right reserved by Rei Tamaru and Jonathan Riel</p>
  </div>
</footer>
