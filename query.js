'use strict';

const { FileSystemWallet, Gateway } = require('fabric-network');
const fs = require('fs');
const client = require('fabric-client');
var fabric_client = new client()
const path = require('path');

const ccpPath = path.resolve(__dirname, 'connection.json');
const ccpJSON = fs.readFileSync(ccpPath, 'utf8');
const ccp = JSON.parse(ccpJSON);
const defaultsPath = path.resolve(__dirname, 'connection.json');
const defaultsJSON = fs.readFileSync(defaultsPath, 'utf8');
const defaults = JSON.parse(defaultsJSON);


async function query(_user, _fcn, _args) {
    try {

        // Create a new file system based wallet for managing identities.
        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = new FileSystemWallet(walletPath);
        console.log(`Wallet path: ${walletPath}`);

        // Check to see if we've already enrolled the user.
        const userExists = await wallet.exists(_user);
        if (!userExists) {
            console.log('An identity for the user ' + _user + ' does not exist in the wallet');
            return { success: false, msg: 'An identity for the user ' + _user + ' does not exist in the wallet' };
        }

        // Create a new gateway for connecting to our peer node.
        const gateway = new Gateway();
        await gateway.connect(ccp, { wallet, identity: _user, discovery: { enabled: false } });

        // Get the network (channel) our contract is deployed to.
        const network = await gateway.getNetwork(defaults["ChannelName"]);

        // Get the contract from the network.
        const contract = network.getContract(defaults["ChaincodeName"]);

        const result = await contract.evaluateTransaction(_fcn, _args);
        console.log(`Transaction has been evaluated, result is: ${result.toString()}`);
        return { success: true, msg: "Query successful", queryResponse: result.toString() };
    } catch (error) {
        console.error(`Failed to evaluate transaction: ${error}`);
        return { success: false, msg: error };
    }
}


exports.query = query