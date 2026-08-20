<script>
  import { page } from '$app/stores';
</script>

<div class="error">
  <h1>{$page.status}: {$page.error.message}</h1>
</div>

<style>
  .error {
    font-size: 64pt;
    margin: 0 auto;
    text-align: center;
    padding-top: 20%;
  }
</style>
