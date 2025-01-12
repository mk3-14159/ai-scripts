# Refactor Prompt Script

Analyze files, identifies functions that may benefit from refactoring, and generates a refactor prompt for each function that needs refactoring. 

## Installation

1. **Clone or Download:**  
   ```bash
   git clone https://github.com/your-repo/refactor-prompt-script.git
   cd refactor-prompt-script
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
   - Confirm that any API keys or environment variables are correctly referenced.

---

## Usage

```bash
node refactor-prompt.mjs <file-path> [custom-prompt]
```

- **file-path**: The path to the JavaScript file you want to analyze.
- **custom-prompt** (optional): Additional instructions or requirements for the refactoring process.

## Outputs 

The output includes a ```<file>.refactor.<extension>```. Paste it into chatgpt or claude to get the refactored version.

