// refactor-prompt.mjs
import { chat } from './models/deepseek.mjs';
import fs from 'fs/promises';
import path from 'path';

const DEFAULT_ANALYSIS_PROMPT = `Analyze the following function for clarity, correctness, and efficiency. 
Determine if it needs refactoring. If it does, provide a specific prompt that would guide an AI 
to refactor it appropriately. Consider:
- Function complexity and documentation
- Pure function principles and error handling
- Performance implications
- Edge cases and potential bugs
- Common logical errors (off-by-one, type issues, etc.)
- Security risks and input validation`;


/**
 * REFACTOR:
 * Refactor the function `buildAnalysisPrompt` to improve clarity, correctness, and efficiency. Ensure the function handles edge cases such as `userFeatureRequest` being `null`, `undefined`, or an empty string. Add input validation to prevent potential security risks from untrusted input. Document the function with clear comments explaining its purpose, parameters, and return value. Consider making the function pure by ensuring it does not rely on external state like `DEFAULT_ANALYSIS_PROMPT` without explicitly passing it as a parameter. Optimize the string concatenation for better performance if necessary. Finally, test the function for common logical errors such as off-by-one mistakes or type issues.
 */
function buildAnalysisPrompt(userFeatureRequest) {
  const basePrompt = DEFAULT_ANALYSIS_PROMPT;
  const featureRequest = userFeatureRequest 
    ? `\nAdditional requirements:\n${userFeatureRequest}`
    : '';

  return `${basePrompt}${featureRequest}

Return your analysis in this exact JSON format without any markdown formatting or code blocks:
{
  "needsRefactor": boolean,
  "refactorPrompt": string or null
}`;
}

async 
/**
 * REFACTOR:
 * Refactor the `extractFunctions` function to improve clarity, correctness, and efficiency. Ensure the function is pure by handling errors properly and validating inputs. Add comprehensive documentation to describe its purpose, parameters, and return values. Consider edge cases such as empty files, invalid file paths, and files without functions. Optimize the regular expression for better performance and ensure it correctly captures all function definitions. Add input validation to prevent security risks like path traversal. Finally, ensure the function handles asynchronous operations correctly and returns a meaningful structure, such as an array of function names or an object with metadata.
 */
function extractFunctions(filePath) {
  const content = await fs.readFile(filePath, 'utf-8');
  const functionRegex = /function\s+(\w+)\s*\([^)]*\)\s*{[^}]*}/g;
  const functions = [];
  let lastIndex = 0;
  
  let match;
  while ((match = functionRegex.exec(content)) !== null) {
    // Store the text before this function
    const preText = content.slice(lastIndex, match.index);
    lastIndex = match.index + match[0].length;
    
    functions.push({
      name: match[1],
      code: match[0],
      preText,
      startIndex: match.index,
      endIndex: lastIndex
    });
  }
  
  // Get the remaining text after the last function
  const postText = content.slice(lastIndex);
  
  return { functions, postText, originalContent: content };
}

async 
/**
 * REFACTOR:
 * Refactor the function `analyzeFunctionForRefactoring` to improve clarity, correctness, and efficiency. Ensure the function adheres to pure function principles by avoiding side effects and ensuring deterministic outputs. Add comprehensive documentation to describe the function's purpose, parameters, and return values. Implement proper error handling to manage invalid inputs or unexpected states. Optimize performance by reducing unnecessary computations or redundant checks. Address edge cases such as empty or malformed inputs, and ensure type safety by validating input types. Consider security risks by sanitizing inputs to prevent injection attacks or other vulnerabilities. Finally, test the refactored function thoroughly to ensure it handles all potential logical errors, such as off-by-one mistakes or type coercion issues.
 */
function analyzeFunctionForRefactoring(functionCode, analysisPrompt) {
  const messages = [
    { 
      role: 'system', 
      content: 'You are a code analysis assistant focused on functional programming principles. Always return JSON without markdown formatting.' 
    },
    { 
      role: 'user', 
      content: `${analysisPrompt}\n\nFunction to analyze:\n${functionCode}` 
    }
  ];

  let analysisResult = '';
  const response = await chat({
    messages,
    stream: true
  });

  for await (const chunk of response) {
    analysisResult += chunk;
  }

  try {
    const cleanedResult = analysisResult
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '')
      .trim();

    const start = cleanedResult.indexOf('{');
    const end = cleanedResult.lastIndexOf('}') + 1;
    
    if (start === -1 || end === 0) {
      throw new Error('No valid JSON object found in response');
    }

    const jsonStr = cleanedResult.slice(start, end);
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error('Failed to parse analysis result:', error);
    console.error('Raw response:', analysisResult);
    return {
      needsRefactor: false,
      refactorPrompt: null
    };
  }
}

async 
/**
 * REFACTOR:
 * Refactor the function `generateRefactorFile` to ensure it is complete, handles errors appropriately, and adheres to pure function principles. Specifically: 1) Complete the function by ensuring it properly constructs the `refactorPath` and writes the refactored content to the file. 2) Add input validation to ensure `filePath`, `analysisResults`, and `originalContent` are valid and non-empty. 3) Implement error handling for file system operations, such as checking if the file exists or if the directory is writable. 4) Ensure the function is pure by avoiding side effects where possible, or clearly documenting any necessary side effects. 5) Add documentation to explain the function's purpose, parameters, and return value. 6) Consider edge cases, such as invalid file extensions, missing directories, or large file sizes, and handle them gracefully.
 */
function generateRefactorFile(filePath, analysisResults, originalContent) {
  const fileExt = path.extname(filePath);
  const baseName = path.basename(filePath, fileExt);
  const dirName = path.dirname(filePath);
  const refactorPath = path.join(dirName, `${baseName}.refactor${fileExt}`);

  let refactoredContent = originalContent.originalContent;  // Use the complete original content

  // Sort analysis results by their position in reverse order to maintain correct indices
  const sortedResults = [...analysisResults]
    .sort((a, b) => b.startIndex - a.startIndex)
    .filter(result => result.analysis.needsRefactor);

  // Insert refactor comments before each function that needs refactoring
  for (const result of sortedResults) {
    if (result.analysis.refactorPrompt) {
      const commentLines = result.analysis.refactorPrompt
        .split('\n')
        .map(line => ` * ${line.trim()}`)
        .join('\n');

      const refactorComment = `\n/**\n * REFACTOR:\n${commentLines}\n */\n`;
      
      refactoredContent = 
        refactoredContent.slice(0, result.startIndex) +
        refactorComment +
        refactoredContent.slice(result.startIndex);
    }
  }

  await fs.writeFile(refactorPath, refactoredContent, 'utf-8');
  return refactorPath;
}


/**
 * REFACTOR:
 * Refactor the `printUsage` function to improve clarity and maintainability. Ensure the function is pure by avoiding direct side effects like `console.log`. Instead, return the usage message as a string, allowing the caller to decide how to display it. Add JSDoc comments to document the function's purpose and return value. Consider edge cases such as handling non-string inputs or ensuring the function works in environments where `console.log` might not be available. Additionally, validate the function's output to ensure it adheres to the expected format and is free from logical errors.
 */
function printUsage() {
  console.log(`
Usage: node refactor-prompt.mjs <file-path> [custom-prompt]

Arguments:
  file-path       Path to the JavaScript file to analyze
  custom-prompt   Optional additional analysis requirements or feature requests

Example:
  node refactor-prompt.mjs ./src/utils.js
  node refactor-prompt.mjs ./src/utils.js "Check for proper TypeScript types"
`);
}

async 
/**
 * REFACTOR:
 * Refactor the `main` function to improve clarity, correctness, and efficiency. Ensure the function adheres to pure function principles where applicable, includes proper error handling, and validates inputs. Specifically: 1. Add detailed documentation explaining the function's purpose, parameters, and behavior. 2. Validate `process.argv` to ensure it contains the expected number of arguments and handle cases where it does not. 3. Separate concerns by moving the `printUsage` logic into a separate function and avoid side effects like `process.exit` within the main logic. 4. Consider edge cases such as empty or malformed inputs, and handle them gracefully. 5. Add input validation for `filePath` to ensure it is a valid file path and handle potential security risks (e.g., path traversal). 6. Improve error handling by providing meaningful error messages and avoiding abrupt exits. 7. Ensure the function is testable by minimizing side effects and dependencies on global state like `process.argv`.
 */
function main() {
  try {
    const [,, filePath, userPrompt] = process.argv;
    
    if (!filePath || filePath === '--help' || filePath === '-h') {
      printUsage();
      process.exit(filePath ? 0 : 1);
    }

    const analysisPrompt = buildAnalysisPrompt(userPrompt);
    const fileContent = await extractFunctions(filePath);
    const analysisResults = [];

    console.log('Analysis configuration:');
    console.log('- File:', filePath);
    if (userPrompt) {
      console.log('- Additional requirements:', userPrompt);
    }

    for (const func of fileContent.functions) {
      process.stdout.write(`  [Analyzing..] ${func.name}...\r`);
      
      const analysis = await analyzeFunctionForRefactoring(func.code, analysisPrompt);
      analysisResults.push({
        ...func,
        analysis
      });
      
      // Clear the current line and move to the next
      process.stdout.write('\r\x1b[K');
    }

    const needsRefactoring = analysisResults.some(result => result.analysis.needsRefactor);
    
    if (needsRefactoring) {
      const refactorPath = await generateRefactorFile(filePath, analysisResults, fileContent);
      console.log(`\nRefactoring prompts have been written to: ${refactorPath}`);
      
      const refactorCount = analysisResults.filter(r => r.analysis.needsRefactor).length;
      console.log(`Found ${refactorCount} function(s) that need refactoring.`);
    } else {
      console.log('\nNo functions require refactoring!');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();