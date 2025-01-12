import OpenAI from 'openai';
import fs from 'fs/promises';
import path from 'path';

async function getDeepSeekKey() {
  const keyPath = path.join(process.env.HOME, '.config', 'deepseek.token');
  return (await fs.readFile(keyPath, 'utf8')).trim();
}

export async function chat({ 
  messages,
  model = 'deepseek-chat', 
  temperature = 1,
  max_tokens = 8192,
  stream = true 
}) {
  const client = new OpenAI({
    baseURL: 'https://api.deepseek.com',
    apiKey: await getDeepSeekKey()
  });

  if (stream) {
    const stream = await client.chat.completions.create({
      model,
      messages,
      max_tokens,
      temperature,
      stream: true
    });

    let fullContent = '';
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      process.stdout.write(content);
      fullContent += content;
    }
    console.log(); // Add a newline at the end
    return fullContent;
  } else {
    const completion = await client.chat.completions.create({
      model,
      messages,
      max_tokens,
      temperature
    });
    return completion.choices[0].message.content;
  }
}

