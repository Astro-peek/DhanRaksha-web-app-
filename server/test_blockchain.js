import blockchain from './src/lib/blockchain.js';

async function runTests() {
  console.log("=========================================");
  console.log("Starting Blockchain Integration Tests...");
  console.log("=========================================");

  try {
    // 1. Test deployChitGroup
    console.log("\n1. Testing deployChitGroup...");
    const groupResult = await blockchain.deployChitGroup(
      'group-uuid-12345',
      10,
      12
    );
    console.log("✓ deployChitGroup returned:", groupResult);

    // 2. Test settleCycleOnChain
    console.log("\n2. Testing settleCycleOnChain...");
    const settleResult = await blockchain.settleCycleOnChain(
      'group-uuid-12345',
      1,
      '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', // winner address
      1000000000000000000n, // winnerReceives (1 ETH/MATIC in wei)
      50000000000000000n,    // organiserCommission
      10000000000000000n,     // dividendPerMember
      { cycleId: 'cycle-uuid-1', reason: 'settlement' }
    );
    console.log("✓ settleCycleOnChain returned:", settleResult);

    // 3. Test issueCertificateOnChain
    console.log("\n3. Testing issueCertificateOnChain...");
    const certResult = await blockchain.issueCertificateOnChain(
      'SK-CERT1234',
      'user-uuid-abc',
      15000,
      '2026-05-26T12:00:00.000Z',
      '2026-08-26T12:00:00.000Z'
    );
    console.log("✓ issueCertificateOnChain returned:", certResult);

    // 4. Test verifyCertificateOnChain
    console.log("\n4. Testing verifyCertificateOnChain...");
    const verifyResult = await blockchain.verifyCertificateOnChain(
      'SK-CERT1234',
      certResult.hash
    );
    console.log("✓ verifyCertificateOnChain returned:", verifyResult);

    // 5. Test compatibility aliases
    console.log("\n5. Testing compatibility aliases...");
    const anchorResult = await blockchain.anchorCertificateHash('SK-CERT5678', '0xabc123');
    console.log("✓ anchorCertificateHash returned:", anchorResult);

    const verifyAliasResult = await blockchain.verifyCertificateHash('SK-CERT5678', '0xabc123');
    console.log("✓ verifyCertificateHash returned:", verifyAliasResult);

    console.log("\n=========================================");
    console.log("✓ All Blockchain Integration Tests Passed!");
    console.log("=========================================");
  } catch (err) {
    console.error("❌ Test failed with error:", err);
    process.exit(1);
  }
}

runTests();
