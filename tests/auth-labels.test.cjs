const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const authUiScript = fs.readFileSync(path.join(__dirname, '../js/auth-ui.js'), 'utf8');

test('authentication inputs have explicit labels associated by id', () => {
    const inputIds = [
        'login-email',
        'login-password',
        'register-name',
        'register-email',
        'register-password',
        'password-reset-email'
    ];

    for (const id of inputIds) {
        assert.match(html, new RegExp(`<label\\b[^>]*for=["']${id}["'][^>]*>\\s*[^<]+\\s*</label>`, 'i'), `${id} should have an associated label`);
    }
});

test('registration name limit matches the Firestore profile rule', () => {
    assert.match(html, /id="register-name"[^>]*maxlength="50"/i);
    assert.match(authUiScript, /name\.trim\(\)\.length\s*>\s*50/);
});
