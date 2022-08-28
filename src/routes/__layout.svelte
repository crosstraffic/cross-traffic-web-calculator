<script>
  import '../app.css';
</script>

<header>
<div class="navbar bg-base-300">
  <div class="navbar-start">
    <div class="dropdown">
      <label tabindex="0" class="btn btn-ghost lg:hidden">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h8m-8 6h16" /></svg>
      </label>
      <ul tabindex="0" class="menu menu-compact dropdown-content mt-3 p-2 shadow bg-base-300 rounded-box w-52">
        <li><a href="/">Home</a></li>
        <!-- <li><a href="/about">About</a></li> -->
        <li tabindex="0">
          <div class="justify-between">
            Chapters
            <svg class="fill-current" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M8.59,16.58L13.17,12L8.59,7.41L10,6L16,12L10,18L8.59,16.58Z"/></svg>
          </div>
          <ul class="p-2 bg-base-300">
            <li><a href="/hcm15">Chapter 15</a></li>
          </ul>
        </li>
      </ul>
    </div>
    <!-- Gonna be LOGO -->
    <a href="/" class="normal-case text-xl logo"><img src="hcmcalc_logo.png" alt="logo" width="180" height="400" /></a>
  </div>
  <div class="navbar-center hidden lg:flex">
    <ul class="menu menu-horizontal p-0">
      <li><a class="home_button" href="/">Home</a></li>
      <!-- <li><a href="/about">About</a></li> -->
      <li tabindex="0">
        <div class="chap_button">
          Chapters
          <svg class="fill-current" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><path d="M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z"/></svg>
        </div>
        <ul class="p-2 bg-base-300 chap_button">
          <li><a href="/hcm15">Chapter 15</a></li>
        </ul>
      </li>
    </ul>
  </div>
  <!-- <div class="navbar-end">
    <a class="btn">Login</a>
  </div> -->
</div>

</header>
<main>
<slot />
</main>

<footer>
  <!-- add contact c to footer -->
</footer>