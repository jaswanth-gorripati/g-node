'use strict';

const FabricCAServices = require('fabric-ca-client');
const { FileSystemWallet, X509WalletMixin, Gateway } = require('fabric-network');
const fs = require('fs');
const path = require('path');

const ccpPath = path.resolve(__dirname, 'connection.json');
const ccpJSON = fs.readFileSync(ccpPath, 'utf8');
const ccp = JSON.parse(ccpJSON);
const defaultsPath = path.resolve(__dirname, 'defaults.json');
const defaultsJSON = fs.readFileSync(defaultsPath, 'utf8');
const defaults = JSON.parse(defaultsJSON);
let Org = defaults["Organisation"]
const caURL = ccp.certificateAuthorities['ca_peer' + Org].url;
const ca = new FabricCAServices(caURL);
const walletPath = path.join(process.cwd(), 'wallet');
const wallet = new FileSystemWallet(walletPath);


async function enrollUser(user, secret) {
    try {
        const userExists = await wallet.exists(user);
        if (userExists) {
            console.log('An identity for the ' + user + ' already exists in the wallet');
            return { "success": true, "message": "Login Success" }
        }
        try {
            var enrollment = await ca.enroll({ enrollmentID: user, enrollmentSecret: secret, attr_reqs: [{ name: "participantId", optional: true }] });
        } catch (err) {
            return { "success": false, "message": "Username or password invalid" }
        }
        const identity = X509WalletMixin.createIdentity(Org + 'MSP', enrollment.certificate, enrollment.key.toBytes());
        wallet.import(user, identity);
        console.log('Successfully enrolled ' + user + ' and imported it into the wallet');
        return { "success": true, "message": 'Successfully enrolled ' + user + ' and imported it into the wallet' }

    } catch (error) {
        console.error(`Failed to enroll : ${user} "ERROR:" ${error}`);
        return { "success": false, "message": `Failed to enroll : ${user} "ERROR:" ${error}` }
    }
}

async function registerUser(user, secret, isAdminUser, fcn, args) {
    try {
        const userExists = await wallet.exists(user);
        if (userExists) {
            console.log('An identity for the' + user + ' already exists in the wallet');
            return { "success": false, "messsage": user + " Already exists in the network" };
        }

        const adminExists = await wallet.exists('admin');
        if (!adminExists) {
            console.log('An identity for the admin user "admin" does not exist in the wallet');
            console.log('Enrolling admin to register  other users');
            let adminEnrolled = await enrollUser(defaults["AdminName"], defaults["AdminPassword"])
            if (adminEnrolled.success) {
                return await register(user, secret, isAdminUser, fcn, args)
            } else {
                return { "success": false, "message": `Failed to register ${user} due to admin enrollment failure` }
            }
        } else {
            return await register(user, secret, isAdminUser, fcn, args)
        }
    } catch (err) {
        console.error(`Failed to register ${user} error: ${error}`);
        return { "success": false, "message": `Failed to register ${user} error: ${error}` }
    }
}
async function register(user, secret, isAdminUser, fcn, args) {
    try {
        // Create a new gateway for connecting to our peer node.
        const gateway = new Gateway();
        await gateway.connect(ccp, { wallet, identity: 'admin', discovery: { enabled: false } });

        // Get the CA client object from the gateway for interacting with the CA.
        const ca = gateway.getClient().getCertificateAuthority();
        const adminIdentity = gateway.getCurrentIdentity();
        if (!isAdminUser) {
            const network = await gateway.getNetwork(defaults["ChannelName"]);

            // Get the contract from the network.
            const contract = network.getContract(defaults["ChaincodeName"]);
            try {
                await contract.submitTransaction(fcn, args);
            } catch (err) {
                return { "success": false, "messagae": `Transaction exited with Error: ${err}` }
            }
            console.log('Transaction has been submitted');
            return await genAndStoreCert(user, secret, ca, wallet.user)
        } else {
            return await genAndStoreCert(user, secret, ca, wallet, user + "admin")
        }

    } catch (error) {
        console.error(`Failed to register ${user} error: ${error}`);
        //process.exit(1);
        return { "success": false, "message": `Failed to register ${user} error: ${error}` }
    }
}

async function genAndStoreCert(user, secret, ca, wallet, attValue) {
    // Register the user, enroll the user, and import the new identity into the wallet.
    const _secret = await ca.register({ enrollmentID: user, enrollmentSecret: secret, maxEnrollments: -1, attrs: [{ name: "participantId", value: attValue }], role: 'client' }, adminIdentity);
    const enrollment = await ca.enroll({ enrollmentID: user, enrollmentSecret: _secret, attr_reqs: [{ name: "participantId", optional: true }] });
    const userIdentity = X509WalletMixin.createIdentity(Org + 'MSP', enrollment.certificate, enrollment.key.toBytes());
    wallet.import(user, userIdentity);
    console.log('Successfully registered and enrolled ' + user + ' and imported it into the wallet');
    return { "success": true, "messge": 'Successfully registered and enrolled ' + user + ' and imported it into the wallet' }
}

exports.enrollUser = enrollUser;
exports.registerUser = registerUser;
``