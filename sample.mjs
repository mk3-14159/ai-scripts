// refactor.mjs
import { chat } from './models/deepseek.mjs';

// Example usage to call deepseek chat:
const response = await chat({
  messages: [
    { role: 'system', content: 'You are deepseek' },
    { role: 'user', content: 'Hello, how are you?' }
  ],
  stream: true  // for streaming output
});
