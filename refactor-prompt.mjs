// refactor-prompt.mjs
import { chat } from './models/deepseek.mjs';
import fs from 'fs/promises';
import path from 'path';

// Configuration for batch processing
const BATCH_SIZE = 1;
const BATCH_DELAY = 1000;

const DEFAULT_ANALYSIS_PROMPT = `Analyze this function in the context of its module and suggest safe refactoring if needed.
Consider:

1. Module Context:
- Available imports and dependencies
- Module-level variables and configurations
- Related utility functions and helpers
- Type definitions and interfaces

2. Current Behavior:
- Document existing functionality and dependencies
- List external APIs and side effects 
- Identify key usage patterns that must be preserved

3. Code Quality:
- Complexity and documentation
- Error handling and edge cases
- Performance and security concerns
- Common bugs (off-by-one, type issues)

4. Refactoring (if needed):
- What must stay the same
- Step-by-step changes that won't break existing behavior
- Any unavoidable breaking changes

Please ensure suggestions maintain backward compatibility unless explicitly noted.`;

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

function chunkArray(array, size) {
  return Array.from({ length: Math.ceil(array.length / size) }, 
    (_, index) => array.slice(index * size, (index + 1) * size)
  );
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Extracts module context including imports, declarations, and full context up to a specific index
 * @param {string} content - The full module content
 * @param {number} functionEndIndex - The ending index of the function being analyzed
 * @returns {Object} Module context information
 * @throws {Error} If content is malformed or cannot be parsed
 */
function extractModuleContext(content, functionEndIndex) {
  if (typeof content !== 'string' || typeof functionEndIndex !== 'number') {
    throw new Error('Invalid arguments: content must be string and functionEndIndex must be number');
  }

  try {
    const contextCode = content.slice(0, functionEndIndex);
    
    // Enhanced import regex to handle all valid ES module import syntaxes
    const importRegex = /import(?:["'\s]*(?:[\w*${}\n\r\t, ]+)from\s*)?["'\s]["'\s](?:[@\w_\-./]+)["'\s].*?$/gm;
    const imports = Array.from(contextCode.matchAll(importRegex), match => match[0].trim());
    
    // Enhanced declaration regex to handle more cases
    const declRegex = /(?:const|let|var|type|interface)\s+\w+\s*(?:=\s*(?:{[^}]*}|[^;]+)|{[^}]*}|[^;{]+);?/gm;
    const declarations = Array.from(contextCode.matchAll(declRegex), match => match[0].trim());

    return {
      imports,
      declarations,
      fullContext: contextCode
    };
  } catch (error) {
    throw new Error(`Failed to extract module context: ${error.message}`);
  }
}

/**
 * Extracts functions and their context from a file
 * @param {string} filePath - Path to the file to analyze
 * @returns {Promise<Object>} Extracted functions and file content
 * @throws {Error} If file cannot be read or parsed
 */
async function extractFunctions(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    
    const functionRegex = /(?:\/\*\*(?:[\s\S]*?)\*\/\s*)*(?:async\s+)?(?:function\s+(\w+)|const\s+(\w+)\s*=(?:\s*async)?\s*(?:function|\([^)]*\)\s*=>))\s*\([^)]*\)\s*{(?:{[^}]*}|[^}])*}/g;
    const functions = [];
    let match;
    let lastIndex = 0;

    while ((match = functionRegex.exec(content)) !== null) {
      const preText = content.slice(lastIndex, match.index);
      lastIndex = match.index + match[0].length;
      
      const functionName = match[1] || match[2];
      const refactorCommentRegex = /\/\*\*\s*\n\s*\*\s*REFACTOR:[^*]*\*\//g;
      const refactorComments = Array.from(preText.matchAll(refactorCommentRegex), m => m[0]);
      
      functions.push({
        name: functionName,
        code: match[0],
        preText: refactorComments[refactorComments.length - 1] || '',
        startIndex: match.index,
        endIndex: match.index + match[0].length,
        moduleContext: extractModuleContext(content, match.index)
      });
    }
    
    return {
      functions: functions.sort((a, b) => a.startIndex - b.startIndex),
      postText: content.slice(lastIndex),
      originalContent: content
    };
  } catch (error) {
    throw new Error(`Failed to extract functions: ${error.message}`);
  }
}

/**
 * Analyzes a batch of functions using the chat API
 * @param {Array} functionBatch - Batch of functions to analyze
 * @param {string} analysisPrompt - Analysis prompt to use
 * @returns {Promise<Array>} Analysis results for the batch
 */
async function analyzeFunctionBatch(functionBatch, analysisPrompt) {
  if (!functionBatch?.length || !analysisPrompt) {
    throw new Error('Invalid arguments: functionBatch must be non-empty array and analysisPrompt must be string');
  }

  const createContextMessage = (functionData) => `
Module Imports:
${functionData.moduleContext.imports.join('\n')}

Module-Level Declarations:
${functionData.moduleContext.declarations.join('\n')}

Function Definition:
${functionData.code}
`;

  const analyzeFunction = async (functionData) => {
    try {
      const messages = [
        { 
          role: 'system', 
          content: 'You are a code analysis assistant focused on functional programming principles and module-level context. Always return JSON without markdown formatting.' 
        },
        { 
          role: 'user', 
          content: `${analysisPrompt}\n\nModule Context and Function to Analyze:\n${createContextMessage(functionData)}` 
        }
      ];

      let analysisResult = '';
      const response = await chat({ messages, stream: true });

      for await (const chunk of response) {
        analysisResult += chunk;
      }

      const jsonMatch = analysisResult.match(/{[^]*}/);
      if (!jsonMatch) {
        throw new Error('No valid JSON object found in response');
      }

      return {
        ...functionData,
        analysis: JSON.parse(jsonMatch[0])
      };
    } catch (error) {
      console.error(`Failed to analyze function ${functionData.name}:`, error);
      return {
        ...functionData,
        analysis: { needsRefactor: false, refactorPrompt: null }
      };
    }
  };

  return Promise.all(functionBatch.map(analyzeFunction));
}

/**
 * Generates a refactor file based on analysis results
 * @param {string} filePath - Original file path
 * @param {Array} analysisResults - Analysis results
 * @param {Object} originalContent - Original file content
 * @returns {Promise<string|null>} Path to generated file or null if no refactoring needed
 */
async function generateRefactorFile(filePath, analysisResults, originalContent) {
  try {
    const needsRefactoring = analysisResults
      .filter(result => result.analysis.needsRefactor)
      .sort((a, b) => a.startIndex - b.startIndex);

    if (needsRefactoring.length === 0) {
      return null;
    }

    const refactorPath = path.join(
      path.dirname(filePath),
      `${path.basename(filePath, path.extname(filePath))}.refactor${path.extname(filePath)}`
    );

    const formatRefactorPrompt = (result, index) => {
      const prompt = result.analysis.refactorPrompt
        .split('\n')
        .filter(line => !line.includes('Module Context') && line.trim() !== '' && !line.includes('javascript'))
        .map(line => line.trim())
        .join(' ')
        .replace(/\s+/g, ' ');

      return `${index + 1}. Function '${result.name}': ${prompt}`;
    };

    const outputContent = `Refactor the following file, focusing on these ${needsRefactoring.length} functions:

${needsRefactoring.map((result, i) => formatRefactorPrompt(result, i)).join('\n')}

FILE CONTENT:
${originalContent.originalContent}

Return only the complete refactored code, maintaining the same exports and core functionality.`;

    await fs.writeFile(refactorPath, outputContent, 'utf-8');
    return refactorPath;
  } catch (error) {
    throw new Error(`Failed to generate refactor file: ${error.message}`);
  }
}

/**
 * Prints usage instructions for the script
 */
function printUsage() {
  const USAGE_TEXT = `
Usage: node refactor-prompt.mjs <file-path> [custom-prompt]

Arguments:
  file-path       Path to the JavaScript file to analyze
  custom-prompt   Optional additional analysis requirements or feature requests

Example:
  node refactor-prompt.mjs ./src/utils.js
  node refactor-prompt.mjs ./src/utils.js "Check for proper TypeScript types"
`;

  try {
    console.log(USAGE_TEXT);
  } catch (error) {
    process.stderr.write('Failed to print usage instructions\n');
  }
}

/**
 * Main function to coordinate the refactoring process
 */
async function main() {
  const parseArguments = () => {
    const [,, filePath, userPrompt] = process.argv;
    if (!filePath || filePath === '--help' || filePath === '-h') {
      printUsage();
      process.exit(filePath ? 0 : 1);
    }
    return { filePath, userPrompt };
  };

  const processBatches = async (functionBatches, analysisPrompt) => {
    const analysisResults = [];
    for (let i = 0; i < functionBatches.length; i++) {
      process.stdout.write(`\nProcessing batch ${i + 1}/${functionBatches.length}...\n`);
      const batchResults = await analyzeFunctionBatch(functionBatches[i], analysisPrompt);
      analysisResults.push(...batchResults);
      
      if (i < functionBatches.length - 1) {
        await sleep(BATCH_DELAY);
      }
    }
    return analysisResults;
  };

  try {
    const { filePath, userPrompt } = parseArguments();
    const analysisPrompt = buildAnalysisPrompt(userPrompt);
    const fileContent = await extractFunctions(filePath);

    console.log('Analysis configuration:');
    console.log('- File:', filePath);
    console.log(`- Found ${fileContent.functions.length} functions to analyze`);
    console.log(`- Processing in batches of ${BATCH_SIZE}`);
    if (userPrompt) {
      console.log('- Additional requirements:', userPrompt);
    }

    const functionBatches = chunkArray(fileContent.functions, BATCH_SIZE);
    const analysisResults = await processBatches(functionBatches, analysisPrompt);
    
    const needsRefactoring = analysisResults.some(result => result.analysis.needsRefactor);
    
    if (needsRefactoring) {
      const refactorPath = await generateRefactorFile(filePath, analysisResults, fileContent);
      const refactorCount = analysisResults.filter(r => r.analysis.needsRefactor).length;
      
      console.log(`\nRefactoring prompts have been written to: ${refactorPath}`);
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