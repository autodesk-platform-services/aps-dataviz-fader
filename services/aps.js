const fs = require('fs');
const { AuthClientTwoLegged } = require('forge-apis');

const { APS_CLIENT_ID, APS_CLIENT_SECRET } = process.env;
if (!APS_CLIENT_ID || !APS_CLIENT_SECRET) {
    console.warn('Missing some of the environment variables.');
    process.exit(1);
}

const PUBLIC_TOKEN_SCOPES = ['viewables:read'];

let publicAuthClient = new AuthClientTwoLegged(APS_CLIENT_ID, APS_CLIENT_SECRET, PUBLIC_TOKEN_SCOPES, true);

async function getPublicToken() {
    if (!publicAuthClient.isAuthorized()) {
        await publicAuthClient.authenticate();
    }
    return publicAuthClient.getCredentials();
}

module.exports = {
    getPublicToken
};
