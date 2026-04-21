const https = require('https');

function createTelegramClient({ token, chatId, timeoutMs = 15000 }) {
  function telegramGet(pathname) {
    return new Promise((resolve, reject) => {
      const request = https.request(
        {
          hostname: 'api.telegram.org',
          path: `/bot${token}/${pathname}`,
          method: 'GET',
          family: 4,
          timeout: timeoutMs,
        },
        (res) => {
          let data = '';

          res.on('data', (chunk) => {
            data += chunk;
          });

          res.on('end', () => {
            try {
              const parsed = JSON.parse(data);

              if (!parsed.ok) {
                reject(new Error(`Telegram API error: ${data}`));
                return;
              }

              resolve(parsed.result);
            } catch (error) {
              reject(error);
            }
          });
        }
      );

      request.on('timeout', () => {
        request.destroy(
          new Error(`Telegram request timed out after ${timeoutMs}ms`)
        );
      });

      request.on('error', reject);
      request.end();
    });
  }

  function sendMessage(text) {
    const encoded = encodeURIComponent(text);
    return telegramGet(`sendMessage?chat_id=${chatId}&text=${encoded}`);
  }

  return {
    sendMessage,
    telegramGet,
  };
}

module.exports = {
  createTelegramClient,
};
