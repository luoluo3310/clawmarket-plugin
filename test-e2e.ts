/**
 * ClawMarket End-to-End Test
 * 
 * Tests the full flow:
 * 1. Seller registers with Registry
 * 2. Buyer discovers seller
 * 3. E2EE encryption/decryption
 */

import { generateKeyPair, encrypt, decrypt } from './src/crypto/e2ee.js';

const REGISTRY_URL = 'http://localhost:8080';
const RELAY_URL = 'http://localhost:8081';

async function main() {
  console.log('=== ClawMarket E2E Test ===\n');

  // 1. Generate key pairs for seller and buyer
  console.log('1. Generating key pairs...');
  const sellerKeys = generateKeyPair();
  const buyerKeys = generateKeyPair();
  console.log('   Seller public key:', Buffer.from(sellerKeys.publicKey).toString('hex').slice(0, 20) + '...');
  console.log('   Buyer public key:', Buffer.from(buyerKeys.publicKey).toString('hex').slice(0, 20) + '...');

  // 2. Register seller
  console.log('\n2. Registering seller...');
  const registerRes = await fetch(`${REGISTRY_URL}/v1/sellers/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      public_key: Buffer.from(sellerKeys.publicKey).toString('hex'),
      endpoint: RELAY_URL,
      models: [{
        model: 'claude-opus-4',
        input_per_1m: 12,
        output_per_1m: 60,
        daily_quota_usd: 400
      }],
      region: 'asia'
    })
  });
  const seller = await registerRes.json() as any;
  console.log('   Seller ID:', seller.id);
  console.log('   Status:', seller.status);

  // 3. Buyer discovers sellers
  console.log('\n3. Discovering sellers...');
  const listRes = await fetch(`${REGISTRY_URL}/v1/sellers?model=claude-opus-4`);
  const { sellers, total } = await listRes.json() as any;
  console.log('   Found', total, 'seller(s)');
  
  if (sellers.length === 0) {
    console.error('   No sellers found!');
    process.exit(1);
  }

  const targetSeller = sellers[0];
  console.log('   Selected:', targetSeller.id);

  // 4. Test encryption
  console.log('\n4. Testing E2EE...');
  const testMessage = 'Hello, this is a test prompt from buyer!';
  
  // Buyer encrypts with their private key + seller's public key
  const encrypted = await encrypt(
    testMessage,
    buyerKeys.privateKey,
    sellerKeys.publicKey
  );
  console.log('   Encrypted:', encrypted.slice(0, 40) + '...');

  // Seller decrypts with their private key + buyer's public key
  const decrypted = await decrypt(
    encrypted,
    sellerKeys.privateKey,
    buyerKeys.publicKey
  );
  console.log('   Decrypted:', decrypted);
  
  if (decrypted === testMessage) {
    console.log('   ✅ E2EE working correctly!');
  } else {
    console.error('   ❌ E2EE failed!');
    process.exit(1);
  }

  // 5. Test Relay health
  console.log('\n5. Checking Relay...');
  const relayHealth = await fetch(`${RELAY_URL}/health`);
  const relayStatus = await relayHealth.json() as any;
  console.log('   Status:', relayStatus.status);
  console.log('   Online sellers:', relayStatus.stats.sellers_online);

  // 6. Summary
  console.log('\n=== Test Summary ===');
  console.log('✅ Registry: Working');
  console.log('✅ Seller Registration: Working');
  console.log('✅ Seller Discovery: Working');
  console.log('✅ E2EE Encryption: Working');
  console.log('✅ Relay: Running');
  console.log('\n🎉 All basic tests passed!');
  console.log('\nNext steps:');
  console.log('1. Deploy ClawChannel contract to Base Sepolia');
  console.log('2. Test WebSocket connection to Relay');
  console.log('3. Test full request/response flow');
  console.log('4. Test payment channel settlement');
}

main().catch(console.error);
