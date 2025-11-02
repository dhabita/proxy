/**
 * Test Client untuk simulasi Backend A
 *
 * Script ini mensimulasikan backend A yang mengirim POST request
 * ke proxy server B, yang kemudian meneruskan ke pihak ketiga C
 */

const axios = require('axios');

// URL proxy server (Server B)
const PROXY_URL = 'http://localhost:3001/proxy';

async function testProxy() {
  console.log('='.repeat(60));
  console.log('🧪 Testing Proxy Server');
  console.log('='.repeat(60));
  console.log();

  try {
    // Data yang akan dikirim
    const testData = {
      nama: 'Backend A',
      timestamp: new Date().toISOString(),
      message: 'Testing proxy from backend A to C',
      data: {
        orderId: '12345',
        amount: 150000,
        currency: 'IDR',
        items: [
          { id: 1, name: 'Product A', qty: 2 },
          { id: 2, name: 'Product B', qty: 1 }
        ]
      }
    };

    console.log('📤 Sending request to Proxy Server B...');
    console.log('URL:', PROXY_URL);
    console.log('Data:', JSON.stringify(testData, null, 2));
    console.log();

    // Kirim POST request ke proxy
    const startTime = Date.now();
    const response = await axios.post(PROXY_URL, testData, {
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'test-api-key-123',
        'X-Request-ID': `req-${Date.now()}`,
      }
    });
    const duration = Date.now() - startTime;

    console.log('✅ Response received from Proxy Server B');
    console.log('Status:', response.status, response.statusText);
    console.log('Duration:', duration + 'ms');
    console.log();
    console.log('📥 Response data (yang dikembalikan dari C):');
    console.log(JSON.stringify(response.data, null, 2));
    console.log();
    console.log('='.repeat(60));
    console.log('✅ Test Berhasil!');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ Error:', error.message);

    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }

    process.exit(1);
  }
}

// Jalankan test
testProxy();
