const rawPort = process.env.ENL_TEST_PORT;
const testPort = rawPort === undefined || rawPort === '' ? 4173 : Number(rawPort);

if (!Number.isInteger(testPort) || testPort < 1 || testPort > 65535) {
    throw new Error('ENL_TEST_PORT must be an integer between 1 and 65535.');
}

module.exports = testPort;
