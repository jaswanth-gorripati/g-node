'use strict';

const { FileSystemWallet, Gateway } = require('fabric-network');
const client = require('fabric-client')
let enroll = require("./enrollment.js")
var query = require('./query.js')
const fs = require('fs');
const path = require('path');
const request = require('request');
const defaultssPath = path.resolve(__dirname, 'connection.json');
const defaultsJSON = fs.readFileSync(defaultsPath, 'utf8');
const defaults = JSON.parse(defaultsJSON);

const ccpPath = path.resolve(__dirname, 'connection.json');
const ccpJSON = fs.readFileSync(ccpPath, 'utf8');
const ccp = JSON.parse(ccpJSON);
const walletPath = path.join(process.cwd(), 'wallet');
console.log(walletPath)
const wallet = new FileSystemWallet(walletPath);
const { SHA3 } = require('sha3');

async function doesUserExists(_user) {
    let userExists = await wallet.exists(_user);
    if (userExists) {
        return true;
    } else {
        return false
    }
}
async function logOut(user) {
    try {
        await wallet.delete(user)
        return { success: true, message: "Logout succesfull" }
    } catch (err) {
        return { success: false, message: "Failed to logout" }
    }

}

async function submitInvoke(user, _fcn, _args) {

    console.info("invoking With admin : ", user)
    if (typeof(_args) != String) {
        return { success: false, message: "Args must be in string format" }
    }
    if (doesUserExists(user)) {
        const gateway = new Gateway();
        try {
            // Create a new gateway for connecting to our peer node.
            await gateway.connect(ccp, { wallet, identity: user, discovery: { enabled: false } });

            // Get the network (channel) our contract is deployed to.
            const network = await gateway.getNetwork(defaults["ChannelName"]);

            // Get the contract from the network.
            const contract = network.getContract(defaults["ChaincodeName"]);
            let result = await contract.submitTransaction(_fcn, _args)
            console.log("result tx id:", result.toString())
            console.log('Transaction has been submitted');
            await gateway.disconnect();
            return { success: true, message: "Transaction successfully sumbmitted. " + result.toString() }

        } catch (error) {
            await gateway.disconnect();
            return { success: false, message: `Failed to submit transaction: ${error}` }
        }
    }
}


async function getFileAddEvent(user) {
    if (!doesUserExists(user)) {
        console.log("user doesnot exxists ,closing process")
        process.exit(1)
    }
    const gateway = new Gateway();
    await gateway.connect(ccp, { wallet, identity: user, discovery: { enabled: false } });
    const network = await gateway.getNetwork(defaults["ChannelName"]);

    let channel = network.getChannel(defaults["ChannelName"]);
    if (!channel) {
        let message = util.format('Channel %s was not defined in the connection profile', channelName);
        throw new Error(message);
    }
    var promises = [];
    let event_hubs = channel.newChannelEventHub('peer1.Hospital1.example.com');
    let regid = null;
    regid = event_hubs.registerChaincodeEvent('hiechain', '^getMshFiles*', (event, block_num, txnid, status) => {
        console.log('Successfully got a chaincode event with transid:' + txnid + ' with status:' + status);
        console.log(event, block_num, txnid, status)
        console.log("event Payload --> ", event.payload.toString())

    }, (err) => {
        console.log(err);
    });
    console.log(regid)
    event_hubs.connect(true)
}

exports.submitInvoke = submitInvoke
exports.getFileAddEvent = getFileAddEvent
exports.logOut = logOut