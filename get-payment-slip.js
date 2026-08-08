const { getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
  const key = event.queryStringParameters && event.queryStringParameters.key;

  if (!key) {
    return { statusCode: 400, body: 'Missing key' };
  }

  try {
    const store = getStore('payment-slips');
    const result = await store.getWithMetadata(key, { type: 'arrayBuffer' });

    if (!result) {
      return { statusCode: 404, body: 'File not found' };
    }

    const { data, metadata } = result;
    const mimeType = (metadata && metadata.mimeType) || 'application/octet-stream';

    return {
      statusCode: 200,
      headers: {
        'Content-Type': mimeType,
        'Cache-Control': 'private, max-age=31536000',
        'Access-Control-Allow-Origin': '*',
      },
      body: Buffer.from(data).toString('base64'),
      isBase64Encoded: true,
    };
  } catch (err) {
    return { statusCode: 500, body: 'Error retrieving file' };
  }
};
