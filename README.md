# Refactor Prompt Script

Analyze files, identifies functions that may benefit from refactoring, and generates a refactor prompt for each function that needs refactoring. 

## Installation

1. **Clone or Download:**  
   ```bash
   git clone https://github.com/deepseek-refactor/refactor-prompt-script.git
   cd deepseek-refactor
   ```
2. **Install Dependencies:**  
   ```bash
   npm install
   ```
   *or*
   ```bash
   yarn install
   ```
3. **Configure `deepseek.mjs`:**  
   - Ensure your `./models/deepseek.mjs` file is set up to interact with your chat/AI model.  
   - Confirm that any API keys or environment variables are in your ```~/.config``` file. eg. ```deepseek.token```.
   - It will probably work with chatgpt and claude api calls too.

---

## Usage

```bash
node refactor-prompt.mjs <file-path> [custom-prompt]
```

- **file-path**: The path to the JavaScript file you want to analyze.
- **custom-prompt** (optional): Additional instructions or requirements for the refactoring process.

## Outputs 

The output includes a ```<file>.refactor.<extension>```. Paste it into chatgpt or claude to get the refactored version.

