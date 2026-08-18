<svelte:head>
  <title>About | HCM Calculator</title>
</svelte:head>

<section class="about">
  <h1 class="text-3xl font-bold underline">About HCM Calculator</h1>

  <div class="desc">
    <p>
      The HCM Calculator provides quick solutions for the analysis methodologies of the
      Highway Capacity Manual (HCM), with diagrams to support understanding. Every chapter
      is validated against the manual's own published example problems, at both the compute
      core and the calculator's own interface.
    </p>

    <p>Launched in November 2022 by Rei Tamaru at the University of Wisconsin-Madison.</p>

    <p>
      The Highway Capacity Manual (7th Edition) can be found
      <a
        href="https://nap.nationalacademies.org/catalog/26432/highway-capacity-manual-7th-edition-a-guide-for-multimodal-mobility"
        target="_blank"
        rel="noreferrer">here</a
      >.
    </p>
    <p>For website inquiries, please email <a href="mailto:tamaru@wisc.edu">Rei Tamaru</a>.</p>
  </div>
</section>

<style>
  .about {
    max-width: 46rem;
    margin: 0 auto;
    padding: 1.5rem 1rem 3rem;
  }
  .desc {
    margin-top: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    line-height: 1.6;
  }
</style>
