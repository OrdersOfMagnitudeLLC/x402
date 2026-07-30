#!/usr/bin/env node

require('dotenv').config();
const { wrapFetchWithPaymentFromConfig } = require('@x402/fetch');
const { ExactEvmScheme } = require('@x402/evm');
const { privateKeyToAccount } = require('viem/accounts');

const BASE_URL = 'https://x402-api-production-5133.up.railway.app';
const WALLET_ADDRESS = process.env.WALLET_ADDRESS;
const WALLET_PRIVATE_KEY = process.env.WALLET_PRIVATE_KEY;

if (!WALLET_ADDRESS || !WALLET_PRIVATE_KEY) {
  console.error('ERROR: WALLET_ADDRESS and WALLET_PRIVATE_KEY must be set in .env');
  process.exit(1);
}

// Test endpoints
const ENDPOINTS = [
  { name: 'Memory', path: '/memory/get/test-key' },
  { name: 'Compute', path: '/compute/holidays/2024/US' },
  { name: 'Knowledge', path: '/knowledge/countries/MY' }
];

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m'
};

function pass() { return `${colors.green}✓${colors.reset}`; }
function fail() { return `${colors.red}✗${colors.reset}`; }

// Log storage
const testLogs = [];

function logStep(endpoint, step, data) {
  const logEntry = {
    endpoint: endpoint,
    step: step,
    timestamp: new Date().toISOString(),
    ...data
  };
  testLogs.push(logEntry);
  console.log(`${colors.dim}[${logEntry.timestamp}]${colors.reset} ${endpoint} - ${step}`);
  if (data.status) console.log(`  Status: ${data.status}`);
  if (data.headers) console.log(`  Headers: ${JSON.stringify(data.headers, null, 2).split('\n').map(l => '    ' + l).join('\n')}`);
  if (data.body) console.log(`  Body: ${JSON.stringify(data.body, null, 2).split('\n').map(l => '    ' + l).join('\n')}`);
}

async function testEndpoint(endpoint) {
  console.log(`\n${colors.cyan}Testing ${endpoint.name} endpoint: ${endpoint.path}${colors.reset}`);
  
  const result = {
    name: endpoint.name,
    path: endpoint.path,
    initial_402: false,
    payment_sent: false,
    final_200: false,
    data_received: null
  };

  try {
    // Create x402 fetch client with wallet
    const account = privateKeyToAccount(WALLET_PRIVATE_KEY);
    
    const fetchWithPayment = wrapFetchWithPaymentFromConfig(fetch, {
      schemes: [
        {
          network: "eip155:8453", // Base Mainnet
          client: new ExactEvmScheme(account),
        },
      ],
    });

    // Step 1: Initial request (expect 402)
    logStep(endpoint.name, 'Initial Request', { url: `${BASE_URL}${endpoint.path}` });
    
    const initialResponse = await fetch(`${BASE_URL}${endpoint.path}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    logStep(endpoint.name, 'Initial Response', {
      status: initialResponse.status,
      statusText: initialResponse.statusText,
      headers: Object.fromEntries(initialResponse.headers.entries())
    });

    if (initialResponse.status === 402) {
      result.initial_402 = true;
      console.log(`${colors.green}  ✓ Received 402 Payment Required${colors.reset}`);
    } else {
      console.log(`${colors.red}  ✗ Expected 402, got ${initialResponse.status}${colors.reset}`);
      return result;
    }

    // Step 2: Parse payment requirements from 402 response
    const paymentHeaders = {
      'X-Payment-Required': initialResponse.headers.get('X-Payment-Required'),
      'X-Price': initialResponse.headers.get('X-Price'),
      'X-Asset': initialResponse.headers.get('X-Asset'),
      'X-Network': initialResponse.headers.get('X-Network'),
      'X-Facilitator': initialResponse.headers.get('X-Facilitator')
    };

    logStep(endpoint.name, 'Payment Requirements', { headers: paymentHeaders });

    // Step 3: Make paid request using x402 fetch
    console.log(`${colors.cyan}  Making paid request...${colors.reset}`);
    
    const paidResponse = await fetchWithPayment(`${BASE_URL}${endpoint.path}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    logStep(endpoint.name, 'Paid Response', {
      status: paidResponse.status,
      statusText: paidResponse.statusText,
      headers: Object.fromEntries(paidResponse.headers.entries())
    });

    if (paidResponse.status === 200) {
      result.final_200 = true;
      const data = await paidResponse.json();
      result.data_received = data;
      
      logStep(endpoint.name, 'Response Data', { body: data });
      console.log(`${colors.green}  ✓ Received 200 OK with data${colors.reset}`);
    } else {
      console.log(`${colors.red}  ✗ Expected 200, got ${paidResponse.status}${colors.reset}`);
    }

    result.payment_sent = true;

  } catch (error) {
    console.error(`${colors.red}  Error: ${error.message}${colors.reset}`);
    logStep(endpoint.name, 'Error', { error: error.message, stack: error.stack });
  }

  return result;
}

function printResults(results) {
  console.log(`\n${colors.cyan}═══════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.cyan}                    INTEGRATION TEST RESULTS${colors.reset}`);
  console.log(`${colors.cyan}═══════════════════════════════════════════════════════════════${colors.reset}\n`);

  // Print header
  console.log(`${colors.dim}Endpoint              402-Recv  Pay-Sent  200-Recv  Data${colors.reset}`);
  console.log(`${colors.dim}─────────────────────────────────────────────────────────────────${colors.reset}`);

  // Print each endpoint's results
  for (const result of results) {
    const namePad = result.name.padEnd(22);
    const p402 = result.initial_402 ? pass() : fail();
    const pay = result.payment_sent ? pass() : fail();
    const p200 = result.final_200 ? pass() : fail();
    const data = result.data_received ? pass() : fail();
    
    console.log(`${namePad}  ${p402}     ${pay}     ${p200}     ${data}`);
  }

  // Print summary
  console.log(`\n${colors.cyan}─────────────────────────────────────────────────────────────────${colors.reset}`);
  
  const p402Pass = results.filter(r => r.initial_402).length;
  const payPass = results.filter(r => r.payment_sent).length;
  const p200Pass = results.filter(r => r.final_200).length;
  const dataPass = results.filter(r => r.data_received).length;
  const totalTests = results.length * 4;
  
  console.log(`${colors.dim}Summary:${colors.reset}`);
  console.log(`  402 Received:  ${p402Pass}/${results.length} passed`);
  console.log(`  Payment Sent:  ${payPass}/${results.length} passed`);
  console.log(`  200 Received:  ${p200Pass}/${results.length} passed`);
  console.log(`  Data Received:  ${dataPass}/${results.length} passed`);
  console.log(`  Overall:        ${p402Pass + payPass + p200Pass + dataPass}/${totalTests} passed`);
  console.log(`${colors.cyan}═══════════════════════════════════════════════════════════════${colors.reset}\n`);
}

function saveLogs() {
  const fs = require('fs');
  const path = require('path');
  
  let logContent = `# x402 Integration Test Log

Generated: ${new Date().toISOString()}
Base URL: ${BASE_URL}
Wallet: ${WALLET_ADDRESS}

---

`;
  
  for (const log of testLogs) {
    logContent += `## ${log.endpoint} - ${log.step}\n\n`;
    logContent += `**Timestamp:** ${log.timestamp}\n\n`;
    
    if (log.url) logContent += `**URL:** ${log.url}\n\n`;
    if (log.status) logContent += `**Status:** ${log.status}\n\n`;
    if (log.statusText) logContent += `**Status Text:** ${log.statusText}\n\n`;
    if (log.headers) logContent += `**Headers:**\n\`\`\`json\n${JSON.stringify(log.headers, null, 2)}\n\`\`\`\n\n`;
    if (log.body) logContent += `**Body:**\n\`\`\`json\n${JSON.stringify(log.body, null, 2)}\n\`\`\`\n\n`;
    if (log.error) logContent += `**Error:** ${log.error}\n\n`;
    if (log.stack) logContent += `**Stack:**\n\`\`\`\n${log.stack}\n\`\`\`\n\n`;
    
    logContent += `---\n\n`;
  }
  
  const logFile = path.join(__dirname, 'integration_test_log.md');
  fs.writeFileSync(logFile, logContent);
  console.log(`${colors.green}Detailed logs saved to: ${logFile}${colors.reset}`);
}

async function main() {
  console.log(`${colors.cyan}╔═══════════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.cyan}║              x402 Integration Test Script                    ║${colors.reset}`);
  console.log(`${colors.cyan}╚═══════════════════════════════════════════════════════════════╝${colors.reset}`);
  console.log(`${colors.dim}Base URL: ${BASE_URL}${colors.reset}`);
  console.log(`${colors.dim}Wallet: ${WALLET_ADDRESS}${colors.reset}\n`);
  
  const results = [];
  
  for (const endpoint of ENDPOINTS) {
    const result = await testEndpoint(endpoint);
    results.push(result);
    
    // Small delay between endpoints
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  printResults(results);
  saveLogs();
}

main().catch(error => {
  console.error(`${colors.red}Fatal error: ${error.message}${colors.reset}`);
  console.error(error.stack);
  process.exit(1);
});
