<script>
    import { writable } from 'svelte/store';
    // import { onMount } from 'svelte';

    // Store API Key securely in memory
    export const apiKey = writable('');

    let tempKey = '';

    // User needs to login first
    // This information is stored in the session as well as database
    const saveApiKey = () => {
        if (tempKey) {
            apiKey.set(tempKey);
            alert('API Key saved!');
        } else {
            alert('Please enter a valid API Key');
        }
    };


    let query = '';
    let chatHistory = writable([]);

    async function handleSubmit() {
        const key = $apiKey;
        if (!key) {
            alert('Please provide your API key.');
            return;
        }

        const response = await fetch('/api/query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, apiKey: key })
        });

        const data = await response.json();
        chatHistory.update((history) => [
            ...history,
            { user: query, bot: data.choices[0].message.content }
        ]);
        query = ''; // Clear the input field
    }
</script>

<div>
    <input type="password" placeholder="Enter your LLM API Key" bind:value={tempKey} />

    <button on:click={saveApiKey}>Save API Key</button>
</div>

<div>
    <div>
        {#each $chatHistory as message}
            <p><strong>You:</strong> {message.user}</p>
            <p><strong>Bot:</strong> {message.bot}</p>
        {/each}
    </div>

    <input type="text" bind:value={query} placeholder="Enter your query" />
    <button on:click={handleSubmit}>Ask</button>
</div>