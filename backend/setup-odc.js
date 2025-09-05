#!/usr/bin/env node

/**
 * Setup script to help configure OWASP Dependency Check
 */

import { ODCBridge } from './src/services/odcBridge.js';
import { spawn } from 'child_process';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

console.log('🔍 OWASP Dependency Check Setup Helper\n');

// Test if ODC is available via PATH
console.log('Testing if dependency-check.bat is in PATH...');
try {
  const testProcess = spawn('dependency-check.bat', ['--version'], { 
    shell: true, 
    stdio: 'pipe' 
  });
  
  let output = '';
  testProcess.stdout.on('data', (data) => {
    output += data.toString();
  });
  
  testProcess.on('close', (code) => {
    if (code === 0 && output.includes('dependency-check')) {
      console.log('✅ ODC found in PATH!');
      console.log(`Version: ${output.trim()}`);
      console.log('\n🚀 You can use: ENABLE_ODC=true in your .env file');
    } else {
      console.log('❌ ODC not found in PATH');
      showPathInstructions();
    }
  });
  
  testProcess.on('error', (error) => {
    console.log('❌ ODC not found in PATH');
    showPathInstructions();
  });
  
} catch (error) {
  console.log('❌ ODC not found in PATH');
  showPathInstructions();
}

function showPathInstructions() {
  console.log('\n📋 Setup Instructions:');
  console.log('1. Download ODC from: https://owasp.org/www-project-dependency-check/');
  console.log('2. Extract to a folder (e.g., C:\\tools\\dependency-check)');
  console.log('3. Either:');
  console.log('   a) Add the bin folder to your Windows PATH, OR');
  console.log('   b) Set ODC_PATH environment variable');
  console.log('\n💡 Example .env configuration:');
  console.log('ENABLE_ODC=true');
  console.log('ODC_PATH=C:\\tools\\dependency-check\\bin\\dependency-check.bat');
  console.log('\n🔧 Test your setup by running this script again');
}

// Test ODC Bridge
setTimeout(async () => {
  console.log('\n🧪 Testing ODC Bridge...');
  try {
    const bridge = new ODCBridge();
    const available = await bridge.isAvailable();
    console.log(`ODC Bridge Detection: ${available ? '✅ Success' : '❌ Failed'}`);
    
    if (!available) {
      console.log('\n💭 Troubleshooting:');
      console.log('- Check that dependency-check.bat --version works in your terminal');
      console.log('- Set ODC_PATH environment variable if ODC is not in PATH');
      console.log('- Restart your development server after setting environment variables');
    }
  } catch (error) {
    console.error('❌ ODC Bridge Error:', error.message);
  }
}, 2000);
