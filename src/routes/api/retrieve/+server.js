import { json } from '@sveltejs/kit';
import fetch from 'node-fetch';

export async function POST({ request }) {
    const { query } = await request.json();

    const vectorDBResponse = await fetch('vectorstore.db', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query })
    });

    const contextChunks = await vectorDBResponse.json();

    return json(contextChunks);
}