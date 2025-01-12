I want to create a script called refactor-prompt.mjs. Most of the programming I do are functional programs. Now this script basically using the deepseek-chat to analyze my functions in a file and determines whether it warrants a refactor based on the clarity, correctness and efficiency of the code. It will then stream the outputs as such

| Functions | Refactor? | Refactor Request |
| function_1() | Yes/No | <prompt for claude to refactor the code of the function> | 

// refactor-prompt.mjs
import { chat } from './models/deepseek.mjs';

// Example usage to call deepseek chat:
const response = await chat({
  messages: [
    { role: 'system', content: 'You are deepseek' },
    { role: 'user', content: 'Hello, how are you?' }
  ],
  stream: true  // for streaming output
});
