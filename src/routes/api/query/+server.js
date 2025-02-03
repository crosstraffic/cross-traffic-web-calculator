import { json } from '@sveltejs/kit';

export async function POST({ request }) {
    const { query, apiKey } = await request.json();

    // Retrieve context (call vector database or preprocessed context)
    const vectorDBResponse = await fetch('vectorstore.db', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query, apiKey })
    });

    const contextChunks = await vectorDBResponse.json();
    const context = contextChunks.join('\n');

    // Construct prompt
    const prompt = `Answer the following query using the provided context: ${query}\n\nContext: ${context}`;

    // Query LLM with user's API key
    const llmResponse = await fetch('https://api.openai.com/v1/engines/davinci-codex/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'gpt-4',
            messages: [{ role: 'user', content: prompt }]
        })
    });

    const response = await llmResponse.json();
    return json(response);
}