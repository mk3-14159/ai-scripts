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

async function extractFunctions(filePath) {
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

async function analyzeFunctionForRefactoring(functionCode, analysisPrompt) {
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

async function generateRefactorFile(filePath, analysisResults, originalContent) {
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

async function main() {
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